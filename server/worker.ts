import { scryptAsync } from "@noble/hashes/scrypt";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { LibraryPrivacyError, libraryAssetHashes, mergeSharedLibraryWrite, sanitizeLibraryVisibility, sharedLibraryView, type LibraryDocument } from "./libraryPrivacy";
import { driveOAuth, driveRoutes, syncLibraryDrives } from "./driveSync";
import { DriveError, type DriveEnv } from "./driveProviders";
import { releaseRoutes, type ReleaseEnv } from "./releases";
import { publicWebsiteRoutes } from "./publicWebsite";
import Stripe from "stripe";

type Env = DriveEnv & ReleaseEnv & {
  ASSETS: Fetcher;
  EMAIL_CODE_ENDPOINT?: string; EMAIL_CODE_TOKEN?: string; EMAIL_CODE_FROM?: string;
  SERENE_RELAY_SUPPORT_ENDPOINT?: string; SERENE_RELAY_SUPPORT_TOKEN?: string; SERENE_RELAY_SUPPORT_TO?: string; SERENE_RELAY_SUPPORT_FROM?: string;
  STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string; STRIPE_AUTOMATIC_TAX_ENABLED?: string; KINFORGE_PUBLIC_ORIGIN?: string;
};
type Account = { id: string; email: string; name: string; password: string; recovery_hash: string };
type Library = { id: string; owner_id: string; name: string; revision: number; object_key: string | null; updated_at: number; role: string };
type AuthCodePurpose = "reset" | "login";
const cookieName = "kinforge_session";
const day = 86400000;
const json = (value: unknown, status = 200, headers: HeadersInit = {}) => Response.json(value, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
class Problem extends Error { constructor(public status: number, message: string) { super(message); } }
class StripeProblem extends Problem {}
const secret = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
function randomLetters(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}
const digest = async (value: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
async function passwordHash(password: string, salt = secret()) {
  const hash = await scryptAsync(password, salt, { N: 32768, r: 8, p: 3, dkLen: 32, maxmem: 48 * 1024 * 1024 });
  return `scrypt-v1:${salt}:${bytesToHex(hash)}`;
}
async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split(":");
  return parts.length === 3 && parts[0] === "scrypt-v1" && equal(await passwordHash(password, parts[1]), encoded);
}
function validPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 256) throw new Problem(400, "Use a password between 12 and 256 characters.");
  return value;
}
function emailAddress(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Problem(400, "Enter a valid email address.");
  return email;
}
async function readText(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Problem(413, "This file is too large to sync.");
  if (!request.body) return "";
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let size = 0; let text = "";
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Problem(413, "This file is too large to sync."); } text += decoder.decode(value, { stream: true }); }
  return text + decoder.decode();
}
async function body(request: Request, limit = 16384): Promise<Record<string, any>> {
  try { const data = JSON.parse(await readText(request, limit)); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data; }
  catch (error) { if (error instanceof Problem) throw error; throw new Problem(400, "The request could not be read."); }
}
async function rateLimit(env: Env, request: Request, name: string, limit: number, windowMs: number, account = "") {
  const now = Date.now(); const address = request.headers.get("CF-Connecting-IP") || "local";
  for (const scope of [address, ...(account ? [account] : [])]) {
    const key = await digest(`${name}:${scope}:${Math.floor(now / windowMs)}`);
    const row = await env.DB.prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, now + windowMs).first<{ count: number }>();
    if ((row?.count || 0) > limit) throw new Problem(429, "Too many attempts. Please try again later.");
  }
}
function cookie(token: string, request: Request, age = 30 * 86400) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function sessionToken(env: Env, userId: string) {
  const token = secret();
  await env.DB.prepare("INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)").bind(await digest(token), userId, Date.now() + 30 * day).run();
  return token;
}
const publicAccount = (user: Account) => ({ id: user.id, email: user.email, name: user.name });
function authCodePurpose(value: unknown): AuthCodePurpose {
  if (value === "reset" || value === "login") return value;
  throw new Problem(400, "Choose password reset or email-code login.");
}
function shortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => String(byte % 10)).join("");
}
function authLink(request: Request, email: string, code: string) {
  const url = new URL(request.url);
  return `${url.origin}/#/email-login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}
async function deliverAuthCode(env: Env, request: Request, email: string, purpose: AuthCodePurpose, code: string, delivery: "code" | "link" = "code") {
  if (!env.EMAIL_CODE_ENDPOINT || !env.EMAIL_CODE_TOKEN) return false;
  const link = delivery === "link" && purpose === "login" ? authLink(request, email, code) : "";
  const subject = purpose === "reset" ? "Your KinForge password reset code" : delivery === "link" ? "Your KinForge secret login link" : "Your KinForge login code";
  const text = link
    ? `Open this KinForge secret login link to sign in: ${link}\n\nIt expires in 15 minutes and works once. If you did not request this, ignore this email.`
    : `Your KinForge ${purpose === "reset" ? "password reset" : "login"} code is ${code}. It expires in 15 minutes. If you did not request this, ignore this email.`;
  try {
    const response = await fetch(env.EMAIL_CODE_ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.EMAIL_CODE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, from: env.EMAIL_CODE_FROM || "KinForge <no-reply@kinforge.local>", subject, text, purpose, delivery, link })
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function deliverSupportRequest(env: Env, ticket: Record<string, any>) {
  if (!env.SERENE_RELAY_SUPPORT_ENDPOINT || !env.SERENE_RELAY_SUPPORT_TOKEN) return false;
  const subject = `[KinForge Support] ${String(ticket.subject || ticket.type || "Support request").slice(0, 140)}`;
  const text = [
    `Type: ${ticket.type || "Support request"}`,
    `From: ${ticket.name || "Not provided"} <${ticket.email || "not provided"}>`,
    `Permission to reply: ${ticket.permissionToReply ? "yes" : "no"}`,
    `Device/app: ${ticket.device || "Not provided"}`,
    `Tree: ${ticket.treeTitle || "Not provided"}`,
    ticket.proof ? `Permission proof: ${ticket.proof}` : "",
    "",
    "Message:",
    String(ticket.message || ""),
    "",
    ticket.diagnostics ? `Diagnostics:\n${ticket.diagnostics}` : "Diagnostics: not included"
  ].join("\n");
  try {
    const response = await fetch(env.SERENE_RELAY_SUPPORT_ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.SERENE_RELAY_SUPPORT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: env.SERENE_RELAY_SUPPORT_TO || "Serene Relay Support",
        from: env.SERENE_RELAY_SUPPORT_FROM || "KinForge Support <support@kinforge.local>",
        replyTo: ticket.permissionToReply ? ticket.email : "",
        subject,
        text,
        source: "kinforge-support-form",
        ticket
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function issueAuthCode(env: Env, request: Request, email: string, purpose: AuthCodePurpose, delivery: "code" | "link" = "code") {
  await rateLimit(env, request, `auth-code-${purpose}`, 5, 60 * 60000, email);
  const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
  let delivered = false;
  if (user) {
    const code = shortCode();
    await env.DB.prepare("INSERT INTO auth_codes (hash,account_id,purpose,expires_at,used_at,created_at) VALUES (?,?,?,?,NULL,?)").bind(await digest(`${purpose}:${user.id}:${code}`), user.id, purpose, Date.now() + 15 * 60000, Date.now()).run();
    delivered = await deliverAuthCode(env, request, email, purpose, code, delivery);
  } else if (env.EMAIL_CODE_ENDPOINT && env.EMAIL_CODE_TOKEN) delivered = true;
  return json({
    ok: true,
    deliveryMode: delivery,
    delivery: delivered ? "sent" : "email-not-configured",
    message: delivered
      ? delivery === "link" ? "If that account exists, KinForge sent a short-lived secret login link to its email address." : "If that account exists, KinForge sent a short-lived code to its email address."
      : "Email-code delivery is not configured for this KinForge deployment yet. Use your secret recovery key, or ask the app owner to add an email provider."
  });
}
async function consumeAuthCode(env: Env, user: Account, purpose: AuthCodePurpose, code: unknown) {
  const hash = await digest(`${purpose}:${user.id}:${String(code || "").trim()}`);
  const record = await env.DB.prepare("SELECT hash FROM auth_codes WHERE hash=? AND account_id=? AND purpose=? AND expires_at>? AND used_at IS NULL").bind(hash, user.id, purpose, Date.now()).first<{ hash: string }>();
  if (!record) return false;
  await env.DB.prepare("UPDATE auth_codes SET used_at=? WHERE hash=? AND used_at IS NULL").bind(Date.now(), hash).run();
  return true;
}
function requestToken(request: Request) { return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || ""; }
async function currentAccount(env: Env, request: Request) {
  const token = requestToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Problem(401, "Sign in to your KinForge account.");
  const user = await env.DB.prepare("SELECT a.* FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.hash=? AND s.expires_at>?").bind(await digest(token), Date.now()).first<Account>();
  if (!user) throw new Problem(401, "Your session has expired. Sign in again; your device changes are kept.");
  return user;
}
async function library(env: Env, id: string, user: Account, edit = false, owner = false) {
  const item = await env.DB.prepare("SELECT l.*,m.role FROM libraries l JOIN library_members m ON m.library_id=l.id WHERE l.id=? AND m.user_id=?").bind(id, user.id).first<Library>();
  if (!item) throw new Problem(404, "This library is unavailable or is no longer shared with you.");
  if ((edit && !["owner", "editor"].includes(item.role)) || (owner && item.role !== "owner")) throw new Problem(403, "Your account does not have permission to make this change.");
  return item;
}
const arrayKeys = ["books", "collections", "trees", "people", "relationships", "families", "events", "places", "placeTemplates", "sources", "sourceTemplates", "media", "todos", "dnaMatches", "records", "ideasJournal", "userFeedback", "reportDrafts", "labels", "customEventTypes", "customFactTypes", "customFactTerms", "customFamilyTypes", "customRelationshipSubtypes", "changes"];
function validateDocument(data: any) {
  if (!data || typeof data !== "object" || arrayKeys.some(key => !Array.isArray(data[key])) || !data.chartConfig || typeof data.chartConfig !== "object") throw new Problem(400, "This library has an unsupported format. Your saved library has not changed.");
  if (data.protectionRecords !== undefined && !Array.isArray(data.protectionRecords)) throw new Problem(400, "The protection records need a list of unique records.");
  for (const key of [...arrayKeys.filter(key => !key.startsWith("custom") && key !== "labels"), ...(data.protectionRecords ? ["protectionRecords"] : [])]) {
    const ids = new Set();
    for (const row of data[key]) { if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Problem(400, `The ${key} records need unique identifiers.`); ids.add(row.id); }
  }
}
async function savedDocument(env: Env, item: Library): Promise<LibraryDocument | null> {
  const saved = item.object_key ? await env.BUCKET.get(item.object_key) : null;
  if (item.object_key && !saved) throw new Problem(503, "Your library is temporarily unavailable. Please retry.");
  return saved ? sanitizeLibraryVisibility(await saved.json<LibraryDocument>()) : null;
}
const billingPlans = {
  beta: { name: "KinForge Beta Program", month: 2000, year: 14000 },
  starter: { name: "KinForge Starter", month: 500, year: 50_00 },
  creator: { name: "KinForge Creator", month: 1200, year: 120_00 },
  studio: { name: "KinForge Studio", month: 2500, year: 250_00 }
} as const;
const discountRates: Record<string, { code: string; rate: number; label: string }> = {
  writer: { code: "WRITER10", rate: 10, label: "Writers" },
  dnd: { code: "DND12", rate: 12, label: "DND players" },
  historian: { code: "HISTORY10", rate: 10, label: "Historians" },
  roleplayer: { code: "ROLEPLAYER12", rate: 12, label: "Roleplayers" },
  rpg: { code: "RPG12", rate: 12, label: "RPG players" },
  genealogist: { code: "GENEALOGY10", rate: 10, label: "Genealogists" },
  social_worker: { code: "SOCIALWORK15", rate: 15, label: "Social workers" },
  student: { code: "STUDENT20", rate: 20, label: "Students" },
  nonprofit: { code: "NONPROFIT20", rate: 20, label: "Nonprofits" },
  educator: { code: "EDUCATOR15", rate: 15, label: "Educators" }
};
function stripeClient(env: Env) {
  if (!env.STRIPE_SECRET_KEY) throw new StripeProblem(503, "Stripe is not configured yet.");
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia", httpClient: Stripe.createFetchHttpClient() });
}
async function stripeCustomer(env: Env, stripe: Stripe, user: Account) {
  const saved = await env.DB.prepare("SELECT stripe_customer_id FROM stripe_customers WHERE account_id=?").bind(user.id).first<{ stripe_customer_id: string }>();
  if (saved?.stripe_customer_id) return saved.stripe_customer_id;
  const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { kinforge_account_id: user.id } });
  await env.DB.prepare("INSERT INTO stripe_customers (account_id,stripe_customer_id,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at")
    .bind(user.id, customer.id, Date.now(), Date.now()).run();
  return customer.id;
}
async function billingCheckout(request: Request, env: Env, user: Account) {
  const data = await body(request);
  const planKey = String(data.plan || "beta") as keyof typeof billingPlans;
  const plan = billingPlans[planKey] || billingPlans.beta;
  const interval = data.interval === "year" ? "year" : "month";
  const userType = String(data.userType || "other").trim().toLowerCase();
  if (userType === "special_unpaid") throw new StripeProblem(400, "Special unpaid versions must be requested through the support form, not checkout.");
  const discount = discountRates[userType];
  const stripe = stripeClient(env), origin = env.KINFORGE_PUBLIC_ORIGIN || new URL(request.url).origin;
  const unitAmount = plan[interval];
  const sessionData: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: await stripeCustomer(env, stripe, user),
    client_reference_id: user.id,
    line_items: [{
      price_data: {
        currency: "sgd",
        product_data: { name: plan.name, description: "KinForge subscription for relationship mapping, beta access, cloud library use and product support." },
        recurring: { interval },
        unit_amount: unitAmount
      },
      quantity: 1
    }],
    success_url: `${origin}/website/beta/?checkout=success&session_id={CHECKOUT_SESSION_ID}#register`,
    cancel_url: `${origin}/website/beta/?checkout=cancelled#register`,
    automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX_ENABLED === "1" },
    tax_id_collection: { enabled: true },
    allow_promotion_codes: !discount,
    subscription_data: { metadata: { kinforge_account_id: user.id, plan: planKey, interval, user_type: userType, discount_code: discount?.code || "" } },
    metadata: { kinforge_account_id: user.id, plan: planKey, interval, user_type: userType, discount_code: discount?.code || "", discount_rate: discount ? `${discount.rate}%` : "0%" },
    integration_identifier: `kinforge_${randomLetters(8)}`
  };
  if (discount) {
    const coupon = await stripe.coupons.create({
      percent_off: discount.rate,
      duration: "forever",
      name: `${discount.code} - ${discount.label}`
    });
    sessionData.discounts = [{ coupon: coupon.id }];
  }
  return json({ url: (await stripe.checkout.sessions.create(sessionData)).url, discount });
}
async function billingPortal(request: Request, env: Env, user: Account) {
  const saved = await env.DB.prepare("SELECT stripe_customer_id FROM stripe_customers WHERE account_id=?").bind(user.id).first<{ stripe_customer_id: string }>();
  if (!saved?.stripe_customer_id) throw new StripeProblem(404, "No Stripe customer exists for this account yet.");
  const origin = env.KINFORGE_PUBLIC_ORIGIN || new URL(request.url).origin;
  const session = await stripeClient(env).billingPortal.sessions.create({ customer: saved.stripe_customer_id, return_url: `${origin}/website/beta/#register` });
  return json({ url: session.url });
}
async function recordStripePayment(env: Env, event: Stripe.Event) {
  const object: any = event.data.object, metadata = object.metadata || object.subscription_details?.metadata || {};
  const accountId = metadata.kinforge_account_id || "";
  if (!accountId) return;
  await env.DB.prepare("INSERT INTO beta_payments (id,account_id,stripe_customer_id,stripe_subscription_id,stripe_payment_id,plan,interval,currency,amount,status,discount_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at")
    .bind(event.id, accountId, String(object.customer || ""), String(object.subscription || object.parent?.subscription_details?.subscription || ""), String(object.payment_intent || object.charge || object.id || ""), String(metadata.plan || "unknown"), String(metadata.interval || ""), String(object.currency || "sgd").toLowerCase(), Number(object.amount_total ?? object.amount_paid ?? 0), String(object.payment_status || object.status || "paid"), String(metadata.discount_code || ""), Date.now(), Date.now()).run();
}
async function stripeWebhook(request: Request, env: Env) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new StripeProblem(503, "Stripe webhook signing is not configured yet.");
  const payload = await readText(request, 1024 * 1024), signature = request.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try { event = await stripeClient(env).webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET); }
  catch { throw new StripeProblem(400, "Stripe webhook signature verification failed."); }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "invoice.paid"].includes(event.type)) await recordStripePayment(env, event);
  return json({ received: true });
}
async function api(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  const oauth = await driveOAuth(request, env, ctx); if (oauth) return oauth;
  if (path === "/api/stripe/webhook" && method === "POST") return stripeWebhook(request, env);
  if (method !== "GET" && method !== "HEAD") {
    if (request.headers.get("X-KinForge-Client") !== "1" || (request.headers.get("origin") && request.headers.get("origin") !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new Problem(403, "This request must come from KinForge.");
  }
  if (path === "/api/health") return json({ ok: true, version: "1.3.8" });
  if (path === "/api/support" && method === "POST") {
    const data = await body(request, 32768);
    await rateLimit(env, request, "support", 8, 60 * 60000, String(data.email || ""));
    const email = data.email ? emailAddress(data.email) : "";
    const ticket = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type: String(data.type || "Support request").trim().slice(0, 80),
      subject: String(data.subject || "KinForge support request").trim().slice(0, 160),
      name: String(data.name || "").trim().slice(0, 120),
      email,
      message: String(data.message || "").trim().slice(0, 10000),
      device: String(data.device || "").trim().slice(0, 500),
      treeTitle: String(data.treeTitle || "").trim().slice(0, 200),
      proof: String(data.proof || "").trim().slice(0, 3000),
      permissionToReply: data.permissionToReply !== false,
      diagnostics: String(data.diagnostics || "").trim().slice(0, 5000)
    };
    if (!ticket.message) throw new Problem(400, "Write the support message before sending.");
    const delivered = await deliverSupportRequest(env, ticket);
    return json({
      ok: true,
      id: ticket.id,
      delivery: delivered ? "sent-to-serene-relay" : "serene-relay-not-configured",
      message: delivered ? "Your support request was sent to Serene Relay." : "Serene Relay delivery is not configured yet. Download or save this support request so it is not lost.",
      ticket
    }, delivered ? 201 : 202);
  }
  if (path === "/api/auth/register" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const password = validPassword(data.password);
    if (data.privacyAccepted !== true && data.privacyAccepted !== "on" || data.termsAccepted !== true && data.termsAccepted !== "on") throw new Problem(400, "Agree to both the KinForge Privacy Policy and Terms & Conditions before creating an account.");
    await rateLimit(env, request, "register", 8, day);
    const id = crypto.randomUUID(), libraryId = crypto.randomUUID(), recoveryCode = secret();
    const hash = await passwordHash(password); const recoveryHash = await digest(recoveryCode);
    if (await env.DB.prepare("SELECT id FROM accounts WHERE email=?").bind(email).first()) throw new Problem(409, "This account already exists. Sign in or use your recovery code.");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id,email,name,password,recovery_hash,created_at,terms_accepted_at,terms_version,privacy_accepted_at,privacy_version) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, email, String(data.name || email.split("@")[0]).trim().slice(0, 100), hash, recoveryHash, Date.now(), Date.now(), "kinforge-terms-v1", Date.now(), "kinforge-privacy-v1"),
      env.DB.prepare("INSERT INTO libraries (id,owner_id,name,revision,updated_at) VALUES (?,?,?,0,?)").bind(libraryId, id, "My relationship library", Date.now()),
      env.DB.prepare("INSERT INTO library_members (library_id,user_id,role) VALUES (?,?,'owner')").bind(libraryId, id)
    ]);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE id=?").bind(id).first<Account>();
    return json({ user: publicAccount(user!), recoveryCode }, 201, { "Set-Cookie": cookie(await sessionToken(env, id), request) });
  }
  if (path === "/api/auth/login" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email);
    await rateLimit(env, request, "login", 20, 15 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    const password = typeof data.password === "string" ? data.password.slice(0, 256) : "";
    const encoded = user?.password || `scrypt-v1:${"0".repeat(64)}:${"0".repeat(64)}`;
    if (!await verifyPassword(password, encoded) || !user) throw new Problem(401, "The email or password did not match.");
    return json({ user: publicAccount(user) }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  if (path === "/api/auth/code/request" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const purpose = authCodePurpose(data.purpose);
    const delivery = data.delivery === "link" && purpose === "login" ? "link" : "code";
    return issueAuthCode(env, request, email, purpose, delivery);
  }
  if (path === "/api/auth/code/confirm" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const purpose = authCodePurpose(data.purpose);
    await rateLimit(env, request, `auth-code-confirm-${purpose}`, 10, 15 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    if (!user || !await consumeAuthCode(env, user, purpose, data.code)) throw new Problem(400, "The email or code did not match.");
    if (purpose === "reset") {
      const recoveryCode = secret(); const nextHash = await passwordHash(validPassword(data.password));
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET password=?,recovery_hash=? WHERE id=?").bind(nextHash, await digest(recoveryCode), user.id),
        env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
        env.DB.prepare("UPDATE auth_codes SET used_at=? WHERE account_id=? AND used_at IS NULL").bind(Date.now(), user.id)
      ]);
      return json({ user: publicAccount(user), recoveryCode }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
    }
    return json({ user: publicAccount(user) }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  if (path === "/api/auth/recover" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const password = validPassword(data.password);
    await rateLimit(env, request, "recover", 5, 60 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    if (!user || !equal(await digest(String(data.recoveryCode || "").trim()), user.recovery_hash)) throw new Problem(400, "The email or recovery code did not match.");
    const recoveryCode = secret(); const nextHash = await passwordHash(password);
    await env.DB.batch([
      env.DB.prepare("UPDATE accounts SET password=?,recovery_hash=? WHERE id=?").bind(nextHash, await digest(recoveryCode), user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)
    ]);
    return json({ user: publicAccount(user), recoveryCode }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  const user = await currentAccount(env, request);
  if (path === "/api/auth/me" && method === "GET") return json({ user: publicAccount(user) });
  if (path === "/api/auth/logout" && method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE hash=?").bind(await digest(requestToken(request))).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", request, 0) });
  }
  if (path === "/api/beta/interest" && method === "GET") {
    const interest = await env.DB.prepare("SELECT plan,interval,discount_code,created_at,updated_at FROM beta_interests WHERE account_id=?").bind(user.id).first();
    return json({ interest });
  }
  if (path === "/api/beta/interest" && method === "POST") {
    const data = await body(request);
    const plan = ["beta", "starter", "creator", "studio"].includes(data.plan) ? data.plan : "beta";
    const interval = data.interval === "year" ? "year" : "month";
    const userType = String(data.userType || "other").trim().toLowerCase();
    const discountCode = discountRates[userType]?.code || "";
    if (!data.consent) throw new Problem(400, "Confirm that this is interest registration only.");
    await env.DB.prepare("INSERT INTO beta_interests (account_id,plan,interval,discount_code,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,interval=excluded.interval,discount_code=excluded.discount_code,updated_at=excluded.updated_at")
      .bind(user.id, plan, interval, discountCode || null, Date.now(), Date.now()).run();
    return json({ ok: true, interest: { plan, interval, discountCode: discountCode || null } }, 201);
  }
  if (path === "/api/beta/interest" && method === "DELETE") {
    await env.DB.prepare("DELETE FROM beta_interests WHERE account_id=?").bind(user.id).run();
    return json({ ok: true });
  }
  if (path === "/api/billing/history" && method === "GET") {
    const payments = await env.DB.prepare("SELECT id,plan,interval,currency,amount,status,discount_code,created_at FROM beta_payments WHERE account_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
    const totals = await env.DB.prepare("SELECT currency,status,SUM(amount) AS amount,COUNT(*) AS count FROM beta_payments WHERE account_id=? GROUP BY currency,status ORDER BY currency,status").bind(user.id).all();
    return json({ payments: payments.results, totals: totals.results, syncedAt: Date.now() });
  }
  if (path === "/api/billing/checkout" && method === "POST") return billingCheckout(request, env, user);
  if (path === "/api/billing/portal" && method === "POST") return billingPortal(request, env, user);
  if (path === "/api/admin/revenue" && method === "GET") {
    const admins = new Set(String(env.KINFORGE_ADMIN_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
    if (!admins.has(user.email)) throw new Problem(403, "Only KinForge admins can view revenue.");
    const payments = await env.DB.prepare("SELECT p.id,p.account_id,a.email,p.plan,p.interval,p.currency,p.amount,p.status,p.discount_code,p.created_at FROM beta_payments p JOIN accounts a ON a.id=p.account_id ORDER BY p.created_at DESC LIMIT 500").all();
    const totals = await env.DB.prepare("SELECT currency,status,SUM(amount) AS amount,COUNT(*) AS count FROM beta_payments GROUP BY currency,status ORDER BY currency,status").all();
    return json({ payments: payments.results, totals: totals.results });
  }
  if (path === "/api/libraries" && method === "GET") {
    const result = await env.DB.prepare("SELECT l.id,l.name,l.revision,l.updated_at,m.role,a.email AS owner_email FROM libraries l JOIN library_members m ON m.library_id=l.id JOIN accounts a ON a.id=l.owner_id WHERE m.user_id=? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,l.name").bind(user.id).all();
    return json({ libraries: result.results });
  }
  if (path === "/api/invitations/accept" && method === "POST") {
    const data = await body(request); const hash = await digest(String(data.code || "").trim());
    await rateLimit(env, request, "invite", 30, 15 * 60000, user.id);
    const invitation = await env.DB.prepare("SELECT * FROM library_invitations WHERE hash=? AND expires_at>? AND (used_by IS NULL OR used_by=?)").bind(hash, Date.now(), user.id).first<{ library_id: string; role: string }>();
    if (!invitation) throw new Problem(404, "This invitation is invalid, expired, revoked, or already used.");
    await env.DB.batch([
      env.DB.prepare("UPDATE library_invitations SET used_by=? WHERE hash=? AND (used_by IS NULL OR used_by=?)").bind(user.id, hash, user.id),
      env.DB.prepare("INSERT INTO library_members (library_id,user_id,role) SELECT library_id,?,role FROM library_invitations WHERE hash=? AND used_by=? ON CONFLICT(library_id,user_id) DO NOTHING").bind(user.id, hash, user.id)
    ]);
    if (!await env.DB.prepare("SELECT role FROM library_members WHERE library_id=? AND user_id=?").bind(invitation.library_id, user.id).first()) throw new Problem(409, "This invitation was already used.");
    return json({ libraryId: invitation.library_id });
  }
  const match = /^\/api\/libraries\/([a-f0-9-]+)(?:\/(.*))?$/.exec(path);
  if (!match) throw new Problem(404, "This action was not found.");
  const [, id, action = ""] = match;
  const driveAction = action === "drives" || action.startsWith("drives/") || action === "exports" || action.startsWith("exports/");
  const item = await library(env, id, user, method === "PUT", driveAction || action === "sharing" || action.startsWith("members/") || action.startsWith("invitations/"));
  if (driveAction) {
    if (method === "POST" && action.endsWith("/connect")) await rateLimit(env, request, "drive-connect", 20, 3600000, user.id);
    return driveRoutes(request, env, ctx, item, action, await digest(requestToken(request)), limit => body(request, limit), validateDocument);
  }
  if (!action && method === "GET") {
    if (url.searchParams.get("since") === String(item.revision)) return json({ unchanged: true, revision: item.revision });
    const saved = await savedDocument(env, item);
    return json({ revision: item.revision, state: saved && user.id !== item.owner_id ? sharedLibraryView(saved).state : saved, updatedAt: item.updated_at });
  }
  if (!action && method === "PUT") {
    const data = await body(request, 16 * 1024 * 1024); validateDocument(data.state);
    if (!Number.isSafeInteger(data.revision) || data.revision !== item.revision) throw new Problem(409, "Another device saved changes. Refresh and merge before saving.");
    sanitizeLibraryVisibility(data.state);
    if (user.id !== item.owner_id) {
      const saved = await savedDocument(env, item);
      const visibleAssets = libraryAssetHashes(saved ? sharedLibraryView(saved).state : null);
      // A guessed, unreferenced owner asset cannot be made readable by adding its hash.
      for (const hash of libraryAssetHashes(data.state)) if (!visibleAssets.has(hash) &&
        !await env.BUCKET.head(`libraries/${id}/asset-writers/${user.id}/${hash}`)) throw new LibraryPrivacyError();
      data.state = mergeSharedLibraryWrite(saved ?? Object.fromEntries(arrayKeys.map(key => [key, []])), data.state);
    }
    const key = `libraries/${id}/snapshots/${crypto.randomUUID()}.json`;
    await env.BUCKET.put(key, JSON.stringify(data.state), { httpMetadata: { contentType: "application/json" } });
    const updatedAt = Date.now();
    const result = await env.DB.prepare("UPDATE libraries SET revision=revision+1,object_key=?,updated_at=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM library_members WHERE library_id=? AND user_id=? AND role IN ('owner','editor'))").bind(key, updatedAt, id, data.revision, id, user.id).run();
    if (result.meta.changes !== 1) { ctx.waitUntil(env.BUCKET.delete(key)); throw new Problem(409, "Another device saved changes. Refresh and merge before saving."); }
    // Old snapshots are retained so acknowledged versions remain recoverable.
    ctx.waitUntil(syncLibraryDrives(env, id));
    return json({ revision: data.revision + 1, updatedAt });
  }
  const asset = /^assets\/([a-f0-9]{64})$/.exec(action);
  if (asset) {
    const key = `libraries/${id}/assets/${asset[1]}`;
    if (method === "PUT") {
      const text = await readText(request, 50 * 1024 * 1024);
      if (!text.startsWith("data:") || await digest(text) !== asset[1]) throw new Problem(400, "The attachment checksum did not match.");
      await env.BUCKET.put(key, text);
      if (user.id !== item.owner_id) await env.BUCKET.put(`libraries/${id}/asset-writers/${user.id}/${asset[1]}`, "1");
      return json({ ok: true });
    }
    if (method === "GET") {
      if (user.id !== item.owner_id) {
        const saved = await savedDocument(env, item);
        if (!saved || !libraryAssetHashes(sharedLibraryView(saved).state).has(asset[1])) throw new Problem(404, "This attachment is unavailable.");
      }
      const file = await env.BUCKET.get(key);
      if (!file) throw new Problem(404, "This attachment is unavailable.");
      return new Response(file.body, { headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
  }
  if (action === "sharing" && method === "GET") {
    const members = await env.DB.prepare("SELECT m.user_id,m.role,a.email,a.name FROM library_members m JOIN accounts a ON a.id=m.user_id WHERE m.library_id=?").bind(id).all();
    const invites = await env.DB.prepare("SELECT hash,role,expires_at FROM library_invitations WHERE library_id=? AND used_by IS NULL AND expires_at>?").bind(id, Date.now()).all();
    return json({ members: members.results, invitations: invites.results });
  }
  if (action === "sharing" && method === "POST") {
    const data = await body(request); if (!["viewer", "editor"].includes(data.role)) throw new Problem(400, "Choose view or edit access.");
    const code = secret(); const expiresAt = Date.now() + 7 * day;
    await env.DB.prepare("INSERT INTO library_invitations (hash,library_id,role,expires_at) VALUES (?,?,?,?)").bind(await digest(code), id, data.role, expiresAt).run();
    return json({ code, expiresAt });
  }
  if (action.startsWith("members/") && method === "DELETE") {
    const target = action.slice("members/".length); if (target === item.owner_id) throw new Problem(400, "The library owner cannot be removed.");
    await env.DB.prepare("DELETE FROM library_members WHERE library_id=? AND user_id=?").bind(id, target).run(); return json({ ok: true });
  }
  if (action.startsWith("invitations/") && method === "DELETE") {
    await env.DB.prepare("DELETE FROM library_invitations WHERE library_id=? AND hash=?").bind(id, action.slice("invitations/".length)).run(); return json({ ok: true });
  }
  throw new Problem(405, "This action is not supported.");
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const release = await releaseRoutes(request, env); if (release) return release;
    const website = publicWebsiteRoutes(request); if (website) return website;
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, ctx); }
      catch (error) { if (error instanceof Problem || error instanceof DriveError) return json({ error: error.message }, error.status); if (error instanceof LibraryPrivacyError) return json({ error: error.message, code: error.code }, 403); console.error("KinForge API failure", error instanceof Error ? error.message : "Unknown error"); return json({ error: "Cloud storage is temporarily unavailable. Your device changes are kept. Please retry." }, 503); }
    }
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) { url.pathname = url.pathname.replace(/^\/app\/?/, "/"); return env.ASSETS.fetch(new Request(url, request)); }
    return env.ASSETS.fetch(request);
  }
};

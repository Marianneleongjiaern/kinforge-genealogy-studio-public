import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { release } from "./releaseManifest";
import { PUBLIC_EXPORT_COPYRIGHT, PUBLIC_EXPORT_CREDIT, PUBLIC_EXPORT_PERMISSION } from "../src/exportAttribution";
import { siteOrigin } from "./publicWebsite";

export type ReleaseEnv = { BUCKET: R2Bucket; RELEASE_UPLOAD_TOKEN?: string; RELEASE_UPLOAD_EXPIRES?: string; SPECIAL_ACCESS_CODE?: string; KINFORGE_SPECIAL_ACCESS_CODE?: string };
const partSize = 8 * 1024 * 1024;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const keyFor = (hash: string) => `releases/${release.version}/${hash}`;
const equal = (a: string, b: string) => { let different = a.length ^ b.length; for (let i = 0; i < 64; i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return different === 0; };
async function releaseFiles(env: ReleaseEnv) {
  return Promise.all(release.files.map(async file => ({ ...file, available: !!await env.BUCKET.head(`${keyFor(file.sha256)}.verified`), url: `/api/releases/${release.version}/${file.id}` })));
}
async function releaseSummary(env: ReleaseEnv) {
  return {
    version: release.version,
    cadence: "monthly",
    cadenceDays: 30,
    policy: "KinForge checks monthly for published, verified updates. Critical fixes can be published sooner.",
    agent: {
      name: "Monthly Update Agent",
      purpose: "Checks published app installers, keeps a local feedback and bug queue, and prepares competitor SWOT review prompts so KinForge keeps improving without requiring Codex for routine updates.",
      safety: "The app downloads verified published packages; it updates the KinForge app, not the user's library data, and it does not silently rewrite its own executable."
    },
    notes: [
      "Bug fixes, security hardening, accessibility improvements and new relationship-mapping features arrive through versioned app updates.",
      "Use the in-app Update Agent to download the newest Apple Silicon, Intel or Windows package when it is available. The installer updates the app, not your library data."
    ],
    files: await releaseFiles(env)
  };
}
async function bytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request is too large.");
  const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
  if (reader) for (;;) { const value = await reader.read(); if (value.done) break; size += value.value.length; if (size > limit) { await reader.cancel(); throw new Error("Request is too large."); } chunks.push(value.value); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
async function hashBody(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(), hash = sha256.create();
  for (;;) { const { value, done } = await reader.read(); if (done) break; hash.update(value); }
  return bytesToHex(hash.digest());
}
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const downloadPaths = new Set(["/downloads", "/downloads/", "/downloads/trial", "/downloads/trial/", "/downloads/paid", "/downloads/paid/", "/downloads/special", "/downloads/special/", "/downloads/special-access", "/downloads/special-access/"]);
const pageHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };

function hasSpecialCookie(request: Request) {
  return /(?:^|;\s*)kinforge_special_access=1(?:;|$)/.test(request.headers.get("Cookie") || "");
}

function downloadDocument(title: string, description: string, canonicalPath: string, body: string) {
  const schema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "KinForge Genealogy Studio", softwareVersion: release.version, operatingSystem: "macOS, Windows, Web", applicationCategory: "LifestyleApplication", url: `${siteOrigin}/website/app/`, downloadUrl: `${siteOrigin}/downloads`, publisher: { "@type": "Organization", name: "Dreams of Serene Landscapes" } };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | KinForge</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="googlebot" content="index,follow"><link rel="canonical" href="${siteOrigin}${canonicalPath}"><meta property="og:site_name" content="KinForge Genealogy Studio"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${siteOrigin}${canonicalPath}"><meta name="twitter:card" content="summary"><link rel="icon" href="/website/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/website/styles.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/website/"><img src="/website/icon.svg" width="42" height="42" alt=""><span>KinForge<small>Genealogy Studio</small></span></a><nav class="desktop-nav" aria-label="Website"><a href="/website/">Overview</a><a href="/website/app/">Official app</a><a href="/website/features/">Use cases</a><a href="/website/tutorials/">Tutorials</a><a href="/downloads" aria-current="page">Download</a><a href="/website/beta/">Beta</a><a href="/website/support/">Support</a></nav><a class="button small" href="/">Open app</a></header><main id="main" class="wrap section prose">${body}</main><footer><div><a class="brand" href="/website/"><img src="/website/icon.svg" width="36" height="36" alt="">KinForge</a><p>Product of Dreams of Serene Landscapes</p><small>Copyright &copy; 2026 Dreams of Serene Landscapes.</small></div><nav aria-label="Footer"><a href="/website/app/">Official app</a><a href="/downloads">Downloads</a><a href="/website/tutorials/">Tutorials</a><a href="/website/privacy-policy/">Privacy Policy</a><a href="/website/terms/">Terms</a><a href="/website/support/">Help &amp; support</a></nav></footer></body></html>`;
}

function downloadGroups(files: Awaited<ReturnType<typeof releaseFiles>>) {
  return ["Apple Silicon", "Intel", "Windows"].map(platform => `<section><h2>${platform}</h2><ul>${files.filter(file => file.platform === platform).map(file => `<li>${file.available ? `<form action="${file.url}" method="get"><label class="check"><input type="checkbox" required> I agree to the KinForge copyright, export and download terms.</label><button type="submit">${escape(file.format.toUpperCase())} download</button></form>` : `<span>${escape(file.format.toUpperCase())}: preparing download</span>`}<span>${(file.size / 1048576).toFixed(1)} MB</span><details><summary>SHA-256 checksum</summary><code>${file.sha256}</code></details></li>`).join("")}</ul></section>`).join("");
}

function accountActions() {
  return `<section class="band"><div class="wrap"><h2>Start your KinForge workspace</h2><p>Create a free KinForge account for your private cloud library, or start the 4-day free trial first and upgrade when you are ready.</p><div class="actions left"><a class="button" href="/#/create-account">Create free account</a><a class="button secondary" href="/">Get started free</a></div></div></section>`;
}

function appDescription() {
  return `<section><h2>Why KinForge exists</h2><p>KinForge Genealogy Studio was created by Dreams of Serene Landscapes after months of trying other genealogy and relationship-mapping tools and finding that many were too limited, too rigid, or priced beyond what many users could reasonably afford.</p><p>Dreams of Serene Landscapes built KinForge with a mission to make genealogy, genograms, family history, fictional lineages, historical networks, and worldbuilding more accessible, inclusive, and practical.</p><h2>Their Story</h2><p>KinForge began when Dreams of Serene Landscapes spent months trying to make existing genealogy and relationship tools work for real needs: family history, complicated relationships, creative worlds, records, reports, accessibility, and affordability. The available options often felt too narrow, too expensive, or not built for the people who needed them most.</p><p>Instead of accepting those limits, Dreams of Serene Landscapes chose to build a new kind of relationship studio: one that could respect genealogy while also serving social workers, writers, historians, roleplayers, RPG players, students, educators, nonprofits, and families. KinForge is their answer to the belief that people deserve better tools for understanding where they come from, who they are connected to, and the stories they are trying to preserve or create.</p><h2>Mission</h2><p>To give people a fairer, clearer, and more capable way to understand relationships, preserve stories, map communities, and build worlds without being blocked by inaccessible tools or unreasonable pricing.</p><h2>Vision</h2><p>A world where family history, care context, historical memory, fictional continuity, and creative worldbuilding are easier to protect, understand, and share responsibly.</p><h2>Values</h2><ul><li><strong>Accessibility:</strong> make KinForge accessible to as many people as possible, including people with special needs, disabilities, and different ways of learning or working.</li><li><strong>Affordable pricing:</strong> fairer paths for people who need genealogy and relationship tools without unreasonable plan costs.</li><li><strong>Genealogy matters:</strong> bring light to the importance of genealogy, family history, identity, cultural memory, and the stories that connect people across generations.</li><li><strong>Inclusivity:</strong> support for families, care networks, histories, fiction, roleplay, and RPG worlds.</li><li><strong>User ownership:</strong> clear control over accounts, exports, backups, and work.</li><li><strong>Respectful records:</strong> care for real people, sensitive information, and private histories.</li><li><strong>Better tools:</strong> continued improvements where existing services feel too limited or too expensive.</li></ul><p>Subscriptions help keep KinForge improving and support a better relationship-mapping tool for everyone, one step at a time.</p></section>`;
}

export async function releaseRoutes(request: Request, env: ReleaseEnv): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname;
  if (!downloadPaths.has(path) && path !== "/api/special-access/unlock" && !path.startsWith("/api/releases/") && !path.startsWith("/api/release-upload/")) return null;
  try {
    if (path === "/downloads/") return new Response(null, { status: 308, headers: { Location: "/downloads" } });
    if (path.endsWith("/") && downloadPaths.has(path) && path !== "/downloads/") return new Response(null, { status: 308, headers: { Location: path.slice(0, -1) } });
    if (path === "/api/special-access/unlock") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const type = request.headers.get("Content-Type") || "";
      const code = type.includes("application/json") ? String((await request.json() as { code?: string }).code || "") : String((await request.formData()).get("code") || "");
      const expected = env.SPECIAL_ACCESS_CODE || env.KINFORGE_SPECIAL_ACCESS_CODE || "KINFORGE-SPECIAL-ACCESS-2026";
      if (!code || code !== expected) return new Response(downloadDocument("Special access code", "Enter the special access code to open the full-feature free download page.", "/downloads/special-access", `<p class="eyebrow">Special access</p><h1>That code did not work</h1><p>Check the code Dreams of Serene Landscapes gave you, or use the support form to request special access.</p><p><a class="button" href="/downloads/special-access">Try again</a> <a class="button secondary" href="/website/support/">Request special access</a></p>`), { status: 403, headers: pageHeaders });
      return new Response(null, { status: 303, headers: { Location: "/downloads/special", "Set-Cookie": "kinforge_special_access=1; Max-Age=3600; Path=/downloads; HttpOnly; Secure; SameSite=Strict" } });
    }
    if (path === "/api/releases/latest" || path === "/api/releases/latest/") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      return json(request.method === "HEAD" ? null : await releaseSummary(env));
    }
    if (downloadPaths.has(path) || path === `/api/releases/${release.version}`) {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      const files = await releaseFiles(env);
      if (path === `/api/releases/${release.version}`) return json({ version: release.version, files });
      const specialLocked = path === "/downloads/special" && !hasSpecialCookie(request);
      if (specialLocked) return new Response(null, { status: 302, headers: { Location: "/downloads/special-access" } });
      const agreement = `${PUBLIC_EXPORT_COPYRIGHT} ${PUBLIC_EXPORT_CREDIT} ${PUBLIC_EXPORT_PERMISSION}`;
      const groups = downloadGroups(files);
      if (path === "/downloads/special-access") {
        const body = `<p class="eyebrow">Special access</p><h1>Open the special full-feature download page</h1><p class="lead">If Dreams of Serene Landscapes gave you special permission, enter the code here. If you do not have a code, request special access through support with real, non-AI proof.</p><form action="/api/special-access/unlock" method="post" class="signup-panel"><label>Special access code<input name="code" autocomplete="off" required></label><button type="submit">Unlock special downloads</button></form><p><a href="/website/support/">Request special access</a></p><div class="notice"><strong>Copyright still applies.</strong> ${escape(agreement)}</div>`;
        return new Response(request.method === "HEAD" ? null : downloadDocument("Special access downloads", "Enter the special access code for KinForge full-feature free downloads.", "/downloads/special-access", body), { headers: pageHeaders });
      }
      const mode = path === "/downloads/trial" ? "trial" : path === "/downloads/paid" ? "paid" : path === "/downloads/special" ? "special" : "hub";
      const intro = mode === "trial"
        ? `<p class="eyebrow">4-day free trial</p><h1>Try KinForge before you commit</h1><p class="lead">Download the trial and start mapping families, cases, casts, campaigns, histories, and story worlds with simplified access to the core tools. After four days, choose a Suite plan or request special access.</p>`
        : mode === "paid"
          ? `<p class="eyebrow">KinForge Genealogy Studio Suite</p><h1>Unlock the fuller KinForge workspace</h1><p class="lead">Use this page after choosing a tier. KinForge Genealogy Studio Suite unlocks more capacity, richer organization, and fuller export/report workflows while keeping the KinForge credit and Dreams of Serene Landscapes copyright on exports and downloads.</p>`
          : mode === "special"
            ? `<p class="eyebrow">Special access</p><h1>Special full-feature free downloads</h1><p class="lead">This page is for approved close or special people who have permission for the free full-feature version. The KinForge/Dreams copyright and credit still apply.</p>`
            : `<p class="eyebrow">Official KinForge downloads</p><h1>Download KinForge ${release.version}</h1><p class="lead">Start your relationship studio on Mac, Windows, or the web. Build family trees, social-work genograms, fictional casts, historical networks, RPG campaigns, and long-running story worlds from one private KinForge account.</p><div class="feature-columns"><article><h2>Free trial</h2><p>Four days with simplified access so new users can try the core workspace first.</p><a class="button" href="/downloads/trial">Free trial downloads</a></article><article><h2>KinForge Genealogy Studio Suite</h2><p>Upgrade for fuller feature access, richer reports, and more workspace capacity.</p><a class="button" href="/downloads/paid">Suite downloads</a></article><article><h2>Special access</h2><p>Approved full-feature free access requires support approval and a private code.</p><a class="button" href="/downloads/special-access">Enter special code</a></article></div>`;
      const body = `${intro}${appDescription()}<div class="actions left"><a class="button" href="/#/create-account">Create free account</a><a class="button secondary" href="/">Get started free</a><a class="button secondary" href="/website/beta/">Plans</a><a class="button secondary" href="/website/tutorials/">Tutorials</a></div><div class="notice"><strong>Required before download.</strong> ${escape(agreement)}</div><p>Installing an update changes KinForge itself, not your library, trees, books, collections, media, or reports. Mac apps are locally signed, but not Apple-notarized. Windows packages are not publisher-signed, so your operating system may ask for permission before opening them.</p><div class="download-grid">${groups}</div>${accountActions()}<p>Sign in with your KinForge account to access your cloud library. Accounts use KinForge email and password, not ChatGPT login.</p>`;
      const title = mode === "trial" ? "Free trial downloads" : mode === "paid" ? "Suite downloads" : mode === "special" ? "Special access downloads" : `Download KinForge ${release.version}`;
      const description = mode === "trial" ? "Download the 4-day free KinForge trial for Mac, Windows, and web." : "Official KinForge Genealogy Studio downloads for Apple Silicon Mac, Intel Mac and Windows, with checksums and copyright terms.";
      return new Response(request.method === "HEAD" ? null : downloadDocument(title, description, path, body), { headers: pageHeaders });
    }
    const download = path.match(/^\/api\/releases\/([^/]+)\/([^/]+)$/);
    if (download) {
      if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
      const file = release.files.find(file => file.id === download[2]);
      if (download[1] !== release.version || !file || !await env.BUCKET.head(`${keyFor(file.sha256)}.verified`)) return json({ error: "This installer is not published yet." }, 404);
      const key = keyFor(file.sha256), range = request.headers.get("Range");
      if (range && !/^bytes=\d+-\d*$/.test(range)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
      let selected: { offset: number; length: number } | undefined;
      if (range) { const [start, end] = range.slice(6).split("-"); const offset = Number(start), last = end ? Math.min(Number(end), file.size - 1) : file.size - 1; if (!Number.isSafeInteger(offset) || offset >= file.size || last < offset) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } }); selected = { offset, length: last - offset + 1 }; }
      const object = request.method === "HEAD" ? await env.BUCKET.head(key) : await env.BUCKET.get(key, selected ? { range: selected } : {});
      if (!object || object.size !== file.size) return json({ error: "Installer temporarily unavailable." }, 503);
      const headers = new Headers({ "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${file.name}"`, "Content-Length": String(selected?.length ?? file.size), "Accept-Ranges": "bytes", "ETag": `"${file.sha256}"`, "X-Checksum-SHA256": file.sha256, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600, immutable" });
      if (selected) headers.set("Content-Range", `bytes ${selected.offset}-${selected.offset + selected.length - 1}/${file.size}`);
      return new Response(request.method === "HEAD" ? null : (object as R2ObjectBody).body, { status: selected ? 206 : 200, headers });
    }
    const upload = path.match(/^\/api\/release-upload\/([^/]+)\/(start|complete|part\/\d+)$/);
    if (!upload) return json({ error: "Not found." }, 404);
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!env.RELEASE_UPLOAD_TOKEN || !/^[a-f0-9]{64}$/.test(token) || !equal(token, env.RELEASE_UPLOAD_TOKEN) || !(Number(env.RELEASE_UPLOAD_EXPIRES) > Date.now())) return json({ error: "Release publisher authorization required." }, 403);
    if (request.headers.has("Origin") && request.headers.get("Origin") !== url.origin) return json({ error: "Origin rejected." }, 403);
    const file = release.files.find(file => file.id === upload[1]);
    if (!file) return json({ error: "Unknown installer." }, 404);
    if (request.method !== (upload[2].startsWith("part/") ? "PUT" : "POST")) return json({ error: "Method not allowed." }, 405);
    const key = keyFor(file.sha256), sessionKey = `${key}.upload`, verifiedKey = `${key}.verified`;
    if (upload[2] === "start") {
      if (await env.BUCKET.head(verifiedKey)) return json({ complete: true });
      const saved = await env.BUCKET.get(sessionKey);
      if (saved) await env.BUCKET.delete(sessionKey);
      const session = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: "application/octet-stream" } });
      await env.BUCKET.put(sessionKey, JSON.stringify({ uploadId: session.uploadId }));
      return json({ uploadId: session.uploadId, partSize });
    }
    const session = await env.BUCKET.get(sessionKey);
    if (!session) return json({ error: "Start the upload first." }, 409);
    const { uploadId } = await session.json<{ uploadId: string }>();
    const multipart = env.BUCKET.resumeMultipartUpload(key, uploadId), partCount = Math.ceil(file.size / partSize);
    if (upload[2].startsWith("part/")) {
      const partNumber = Number(upload[2].slice(5));
      if (partNumber < 1 || partNumber > partCount) return json({ error: "Invalid part number." }, 400);
      const content = await bytes(request, partSize), expectedSize = partNumber === partCount ? file.size - (partCount - 1) * partSize : partSize;
      if (content.length !== expectedSize) return json({ error: "Incorrect part length." }, 400);
      return json(await multipart.uploadPart(partNumber, content));
    }
    const input = JSON.parse(new TextDecoder().decode(await bytes(request, 16384)));
    if (!Array.isArray(input.parts) || input.parts.length !== partCount || input.parts.some((part: R2UploadedPart, index: number) => part.partNumber !== index + 1 || typeof part.etag !== "string" || part.etag.length > 200)) return json({ error: "All ordered upload parts are required." }, 400);
    await multipart.complete(input.parts);
    await env.BUCKET.delete(sessionKey);
    const object = await env.BUCKET.get(key);
    if (!object || object.size !== file.size || await hashBody(object.body) !== file.sha256) { await env.BUCKET.delete(key); return json({ error: "Installer checksum failed. Start a fresh upload." }, 422); }
    await env.BUCKET.put(verifiedKey, file.sha256);
    return json({ complete: true, sha256: file.sha256 });
  } catch (error) {
    console.error("Release transfer failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Release transfer failed. Retry the current step." }, 503);
  }
}

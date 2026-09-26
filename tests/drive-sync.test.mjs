import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, Response as WorkerResponse } from "miniflare";
import { createDomainFixture } from "./helpers/domain-fixture.mjs";
import { createHash, randomUUID } from "node:crypto";

let mf, db, owner, other, fixture;
const cloud = "https://kinforge.example.test";
const remote = { google: new Map(), onedrive: new Map() };
const pendingUploads = new Map();
const requests = [];
const digest = text => createHash("sha256").update(text).digest("hex");
let failProvider = "";
let outboundHook = async () => {};
function reply(statusCode, data = {}, headers = {}) { return { statusCode, data: typeof data === "string" ? data : JSON.stringify(data), responseOptions: { headers: { "content-type": "application/json", ...headers } } }; }
function apiMock(provider, opts) {
  requests.push({ provider, path: opts.path, method: opts.method });
  if (failProvider === provider) return reply(429, {}, { "retry-after": "60" });
  const files = remote[provider], url = new URL(opts.path, provider === "google" ? "https://www.googleapis.com" : "https://graph.microsoft.com");
  const body = opts.body ? Buffer.from(opts.body).toString() : "";
  const create = (name, parent, content = "") => { const id = randomUUID(); const value = { id, name, parent, content }; files.set(id, value); return value; };
  if (provider === "google") {
    if (url.pathname === "/drive/v3/files" && opts.method === "GET") {
      const q = url.searchParams.get("q"); const match = /'([^']+)' in parents(?: and name='([^']+)')?/.exec(q);
      return reply(200, { files: [...files.values()].filter(f => f.parent === match?.[1] && (!match?.[2] || f.name === match[2])).map(({ id, name, content }) => ({ id, name, version: digest(content) })) });
    }
    if (url.pathname === "/drive/v3/files" && opts.method === "POST") { const value = JSON.parse(body); return reply(200, create(value.name, value.parents[0])); }
    if (url.pathname.startsWith("/upload/drive/v3/files")) {
      const value = JSON.parse(body); const id = url.pathname.split("/")[5];
      const key = randomUUID(); pendingUploads.set(key, { provider, id, value });
      return reply(200, {}, { location: `https://www.googleapis.com/mock-upload/${key}` });
    }
    if (url.pathname.startsWith("/mock-upload/")) {
      const { id, value } = pendingUploads.get(url.pathname.split("/").at(-1));
      const file = id ? files.get(id) : create(value.name, value.parents[0]); file.content = body; return reply(200, { id: file.id });
    }
    const file = files.get(decodeURIComponent(url.pathname.split("/").at(-1)));
    if (file && opts.method === "DELETE") { files.delete(file.id); return reply(204, ""); }
    if (file && opts.method === "GET") return reply(200, url.searchParams.get("alt") === "media" ? file.content : { id: file.id, name: file.name, version: digest(file.content) }, { etag: digest(file.content) });
  } else {
    if (url.pathname.endsWith("/special/approot")) return reply(200, { id: "root" });
    const match = /\/items\/([^/:]+)(?::\/([^:]+))?(?::\/content|\/(children|content))?$/.exec(decodeURIComponent(url.pathname));
    if (match) {
      const [, id, name, action] = match;
      if (action === "children") {
        if (opts.method === "GET") return reply(200, { value: [...files.values()].filter(file => file.parent === id).map(file => ({ id: file.id, name: file.name, eTag: digest(file.content) })) });
        const value = JSON.parse(body); return reply(201, create(value.name, id));
      }
      if (opts.method === "PUT") { const file = name ? create(name, id) : files.get(id); if (file.name === "Library.json" && !name) { assert.ok(opts.headers.get("if-match"), "Manifest replacements require a version"); if (opts.headers.get("if-match") !== digest(file.content)) return reply(412); } file.content = body; return reply(200, { id: file.id }); }
      const file = name ? [...files.values()].find(f => f.parent === id && f.name === name) : files.get(id);
      if (!file) return reply(404);
      if (opts.method === "DELETE") { files.delete(file.id); return reply(204, ""); }
      return action === "content" ? reply(302, "", { location: `https://files.1drv.com/download/${file.id}` }) : reply(200, { id: file.id, name: file.name, eTag: digest(file.content) });
    }
  }
  return reply(404, { error: `Unmatched fixture: ${provider} ${opts.method} ${url.pathname}` });
}
async function call(path, method = "GET", data, cookie = "", headers = {}) {
  const response = await mf.dispatchFetch(`${cloud}${path}`, { method, headers: { "X-KinForge-Client": "1", "Content-Type": "application/json", cookie, ...headers }, redirect: "manual", ...(data === undefined ? {} : { body: typeof data === "string" ? data : JSON.stringify(data) }) });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
}
async function account(email) {
  const result = await call("/api/auth/register", "POST", { email, password: "Drive-tests-password-42" }); assert.equal(result.status, 201);
  return { ...result, library: (await call("/api/libraries", "GET", undefined, result.cookie)).body.libraries[0].id };
}
async function waitStatus(provider, expected) {
  for (let i = 0; i < 100; i++) { const row = await db.prepare("SELECT * FROM drive_connections WHERE library_id=? AND provider=?").bind(owner.library, provider).first(); if (expected.includes(row?.status) && !row.lease) return row; await new Promise(resolve => setTimeout(resolve, 50)); }
  assert.fail(JSON.stringify({ provider, row: await db.prepare("SELECT status,error,lease FROM drive_connections WHERE provider=?").bind(provider).first(), requests: requests.slice(-12) }));
}
async function connect(provider) {
  const start = await call(`/api/libraries/${owner.library}/drives/${provider}/connect`, "POST", {}, owner.cookie); assert.equal(start.status, 200, JSON.stringify(start.body));
  const url = new URL(start.body.url); const token = url.searchParams.get("ticket");
  const consent = await call(url.pathname + url.search); assert.equal(consent.status, 302);
  const authorization = new URL(consent.headers.get("location"));
  assert.equal(authorization.searchParams.get("state"), token); assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorization.searchParams.get("code_challenge"));
  assert.equal((await call(url.pathname + url.search)).status, 400);
  assert.equal((await call(`/api/drive-oauth/${provider}/callback?state=${token}&code=test`)).status, 403);
  const done = await call(`/api/drive-oauth/${provider}/callback?state=${token}&code=test`, "GET", undefined, consent.cookie);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((await call(`/api/drive-oauth/${provider}/callback?state=${token}&code=test`, "GET", undefined, consent.cookie)).status, 400);
  return waitStatus(provider, ["synced"]);
}
before(async () => {
  fixture = await createDomainFixture();
  const outboundService = async request => {
    const url = new URL(request.url); let result;
    await outboundHook(request);
    if (["oauth2.googleapis.com", "login.microsoftonline.com"].includes(url.hostname)) result = reply(200, { access_token: "synthetic-access-token", refresh_token: "synthetic-refresh-token", expires_in: 3600 });
    else if (url.hostname === "files.1drv.com") { assert.equal(request.headers.get("authorization"), null); result = reply(200, remote.onedrive.get(url.pathname.split("/").at(-1)).content); }
    else {
      assert.ok(["www.googleapis.com", "graph.microsoft.com"].includes(url.hostname), `Unexpected network destination ${url.hostname}`);
      result = apiMock(url.hostname === "www.googleapis.com" ? "google" : "onedrive", { path: url.pathname + url.search, method: request.method, body: await request.text(), headers: request.headers });
    }
    return new WorkerResponse(result.statusCode === 204 ? null : result.data, { status: result.statusCode, headers: result.responseOptions.headers });
  };
  mf = new Miniflare({ modules: true, scriptPath: "dist/server/index.js", compatibilityDate: "2024-11-01", d1Databases: ["DB"], r2Buckets: ["BUCKET"], outboundService, bindings: { DRIVE_TOKEN_KEY: "ab".repeat(32), DRIVE_PUBLIC_ORIGIN: cloud, GOOGLE_DRIVE_CLIENT_ID: "google-test", GOOGLE_DRIVE_CLIENT_SECRET: "synthetic-google-secret", ONEDRIVE_CLIENT_ID: "microsoft-test", ONEDRIVE_CLIENT_SECRET: "synthetic-microsoft-secret" } });
  db = await mf.getD1Database("DB");
  for (const name of (await readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) for (const sql of (await readFile(`drizzle/${name}`, "utf8")).split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(sql.trim()).run();
  owner = await account("drive-owner@example.test"); other = await account("drive-other@example.test");
  const data = `data:image/png;base64,${Buffer.from("Synthetic portrait bytes").toString("base64")}`; const hash = digest(data);
  await call(`/api/libraries/${owner.library}/assets/${hash}`, "PUT", data, owner.cookie);
  fixture.people[0].portrait = `kinforge-asset:${hash}`;
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: 0, state: fixture }, owner.cookie)).status, 200);
});
after(async () => { await mf?.dispose(); });

test("drive and export access is owner-only, including shared editors and guests", async () => {
  assert.equal((await call(`/api/libraries/${owner.library}/drives`)).status, 401);
  assert.equal((await call(`/api/libraries/${owner.library}/drives`, "GET", undefined, other.cookie)).status, 404);
  const invitation = await call(`/api/libraries/${owner.library}/sharing`, "POST", { role: "editor" }, owner.cookie);
  await call("/api/invitations/accept", "POST", { code: invitation.body.code }, other.cookie);
  for (const action of ["drives", "exports"]) assert.equal((await call(`/api/libraries/${owner.library}/${action}`, "GET", undefined, other.cookie)).status, 403);
  assert.equal((await call(`/api/libraries/${owner.library}/drives/google/connect`, "POST", {}, owner.cookie, { origin: "https://other.test" })).status, 403);
});
test("both providers use single-use, browser-bound PKCE authorization and mirror complete library plus media", async () => {
  for (const provider of ["google", "onedrive"]) {
    const row = await connect(provider);
    assert.equal(row.synced_revision, 1); assert.ok(!row.credentials.includes("synthetic-access-token"));
    const snapshot = JSON.parse(remote[provider].get(row.manifest_id).content);
    assert.deepEqual(snapshot.state, fixture); assert.equal(snapshot.libraryId, owner.library); assert.equal(Object.keys(snapshot.assets).length, 1);
    const hash = Object.keys(snapshot.assets)[0]; assert.equal(digest(remote[provider].get(snapshot.assets[hash]).content), hash);
  }
  const status = await call(`/api/libraries/${owner.library}/drives`, "GET", undefined, owner.cookie);
  assert.ok(!JSON.stringify(status.body).includes("credentials")); assert.ok(!JSON.stringify(status.body).includes("synthetic-access-token"));
});
test("exports are idempotent, retain original bytes, and sync automatically to both drives", async () => {
  const id = randomUUID(); const data = { name: "Person report.pdf", category: "Reports", dataUrl: `data:application/pdf;base64,${Buffer.from("%PDF synthetic report").toString("base64")}` };
  for (let n = 0; n < 2; n++) assert.equal((await call(`/api/libraries/${owner.library}/exports/${id}`, "PUT", data, owner.cookie)).status, 200);
  for (const provider of ["google", "onedrive"]) {
    const row = await waitStatus(provider, ["synced"]); const snapshot = JSON.parse(remote[provider].get(row.manifest_id).content);
    assert.equal(snapshot.exports.length, 1); assert.equal(remote[provider].get(snapshot.exports[0].remoteId).content, "%PDF synthetic report");
  }
  assert.equal((await call(`/api/libraries/${owner.library}/exports`, "GET", undefined, owner.cookie)).body.files.length, 1);
  assert.equal((await call(`/api/libraries/${owner.library}/exports/${id}`, "PUT", { ...data, dataUrl: "invalid" }, owner.cookie)).status, 400);
  assert.equal((await call(`/api/libraries/${owner.library}/exports/${id}`, "GET", undefined, other.cookie)).status, 403);
});
test("accepted edits and deletions reach drives; pause retains data and resume catches up", async () => {
  await call(`/api/libraries/${owner.library}/drives/google`, "POST", { enabled: false }, owner.cookie);
  fixture.people[0].biography = "Edited from another device"; fixture.people.pop();
  await call(`/api/libraries/${owner.library}`, "PUT", { revision: 1, state: fixture }, owner.cookie);
  const one = await waitStatus("onedrive", ["synced"]); assert.equal(one.synced_revision, 2);
  const google = await db.prepare("SELECT * FROM drive_connections WHERE provider='google'").first(); assert.equal(google.synced_revision, 1);
  await call(`/api/libraries/${owner.library}/drives/google`, "POST", { enabled: true }, owner.cookie);
  const updated = await waitStatus("google", ["synced"]); assert.equal(updated.synced_revision, 2);
  assert.deepEqual(JSON.parse(remote.google.get(updated.manifest_id).content).state, fixture);
});
test("externally edited copies pause sync, reject stale decisions and can restore without silent overwrite", async () => {
  let row = await db.prepare("SELECT * FROM drive_connections WHERE provider='google'").first();
  const file = remote.google.get(row.manifest_id); const changed = JSON.parse(file.content); changed.state.people[0].biography = "Changed drive copy"; file.content = JSON.stringify(changed);
  await call(`/api/libraries/${owner.library}/drives/sync`, "POST", {}, owner.cookie);
  await waitStatus("google", ["conflict"]); await waitStatus("onedrive", ["synced"]);
  const review = await call(`/api/libraries/${owner.library}/drives/google/resolve`, "GET", undefined, owner.cookie); assert.equal(review.status, 200);
  assert.equal((await call(`/api/libraries/${owner.library}/drives/google/resolve`, "POST", { ...review.body, hash: "old", choice: "drive" }, owner.cookie)).status, 409);
  assert.equal((await call(`/api/libraries/${owner.library}/drives/google/resolve`, "POST", { ...review.body, choice: "drive" }, owner.cookie)).status, 200);
  row = await waitStatus("google", ["synced"]); await waitStatus("onedrive", ["synced"]);
  const saved = await call(`/api/libraries/${owner.library}`, "GET", undefined, owner.cookie); assert.equal(saved.body.state.people[0].biography, "Changed drive copy");
});
test("provider failures do not block library saves or the other provider", async () => {
  failProvider = "google";
  const saved = await call(`/api/libraries/${owner.library}`, "GET", undefined, owner.cookie); saved.body.state.labels.push("Still saved");
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { state: saved.body.state, revision: saved.body.revision }, owner.cookie)).status, 200);
  const row = await waitStatus("google", ["error"]); assert.ok(row.retry_at > Date.now());
  await waitStatus("onedrive", ["synced"]); failProvider = "";
});
test("missing attachments are rebuilt and externally edited exports are preserved as separate files", async () => {
  const row = await db.prepare("SELECT * FROM drive_connections WHERE provider='onedrive'").first();
  const before = JSON.parse(remote.onedrive.get(row.manifest_id).content);
  const [hash, mediaId] = Object.entries(before.assets)[0]; remote.onedrive.delete(mediaId);
  const changedExport = remote.onedrive.get(before.exports[0].remoteId); changedExport.content = "Edited PDF outside KinForge";
  await call(`/api/libraries/${owner.library}/drives/sync`, "POST", {}, owner.cookie); await waitStatus("onedrive", ["synced"]);
  const after = JSON.parse(remote.onedrive.get(row.manifest_id).content);
  assert.notEqual(after.assets[hash], mediaId); assert.equal(digest(remote.onedrive.get(after.assets[hash]).content), hash);
  assert.notEqual(after.exports[0].remoteId, changedExport.id); assert.equal(remote.onedrive.get(changedExport.id).content, "Edited PDF outside KinForge");
});
test("pause during the final manifest read prevents the following private upload", async () => {
  const row = await db.prepare("SELECT * FROM drive_connections WHERE provider='onedrive'").first();
  let entered; const reached = new Promise(resolve => { entered = resolve; }); let release; const gate = new Promise(resolve => { release = resolve; }); let reads = 0;
  outboundHook = async request => { if (request.method === "GET" && new URL(request.url).pathname.endsWith(`/${row.manifest_id}/content`) && ++reads === 2) { entered(); await gate; } };
  const saved = await call(`/api/libraries/${owner.library}`, "GET", undefined, owner.cookie); saved.body.state.labels.push("Pause during upload");
  const before = remote.onedrive.get(row.manifest_id).content;
  try {
    await call(`/api/libraries/${owner.library}`, "PUT", { revision: saved.body.revision, state: saved.body.state }, owner.cookie); await reached;
    await call(`/api/libraries/${owner.library}/drives/onedrive`, "POST", { enabled: false }, owner.cookie); release();
    await new Promise(resolve => setTimeout(resolve, 150)); assert.equal(remote.onedrive.get(row.manifest_id).content, before);
  } finally { release(); outboundHook = async () => {}; }
  await call(`/api/libraries/${owner.library}/drives/onedrive`, "POST", { enabled: true }, owner.cookie); await waitStatus("onedrive", ["synced"]);
});
test("disconnect forgets credentials without deleting existing drive copies", async () => {
  const size = remote.google.size;
  assert.equal((await call(`/api/libraries/${owner.library}/drives/google`, "DELETE", undefined, owner.cookie)).status, 200);
  assert.equal(await db.prepare("SELECT id FROM drive_connections WHERE provider='google'").first(), null); assert.equal(remote.google.size, size);
});
test("a disconnect during token exchange cancels authorization permanently", async () => {
  const start = await call(`/api/libraries/${owner.library}/drives/google/connect`, "POST", {}, owner.cookie);
  const url = new URL(start.body.url); const token = url.searchParams.get("ticket"); const consent = await call(url.pathname + url.search);
  let entered; const reached = new Promise(resolve => { entered = resolve; }); let release; const gate = new Promise(resolve => { release = resolve; });
  outboundHook = async request => { if (new URL(request.url).hostname === "oauth2.googleapis.com") { entered(); await gate; } };
  try {
    const callback = call(`/api/drive-oauth/google/callback?state=${token}&code=test`, "GET", undefined, consent.cookie);
    await reached;
    assert.equal((await call(`/api/libraries/${owner.library}/drives/google`, "DELETE", undefined, owner.cookie)).status, 200);
    release(); assert.equal((await callback).status, 409);
    assert.equal(await db.prepare("SELECT id FROM drive_connections WHERE provider='google'").first(), null);
  } finally { release(); outboundHook = async () => {}; }
});

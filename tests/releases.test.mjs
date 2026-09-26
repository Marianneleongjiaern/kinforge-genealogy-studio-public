import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { Miniflare } from "miniflare";

const token = "a".repeat(64), payload = "verified installer", sha256 = createHash("sha256").update(payload).digest("hex");
const file = { id: "apple-silicon-dmg", platform: "Apple Silicon", format: "dmg", name: "KinForge.dmg", size: payload.length, sha256 };
let mf, options;
const request = (path, options = {}) => mf.dispatchFetch(`https://kinforge.test${path}`, options);
const upload = (action, body, headers = {}) => request(`/api/release-upload/${file.id}/${action}`, { method: action.startsWith("part/") ? "PUT" : "POST", headers: { Authorization: `Bearer ${token}`, ...headers }, body });
before(async () => {
  const bundle = await build({ stdin: { contents: 'import { releaseRoutes } from "./server/releases"; export default { fetch: (request, env) => releaseRoutes(request, env) };', resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "browser", plugins: [{ name: "test-artifacts", setup(build) { build.onLoad({ filter: /releaseManifest\.ts$/ }, () => ({ contents: `export const release = ${JSON.stringify({ version: "1.3.0", files: [file] })};`, loader: "ts" })); } }] });
  options = { modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2024-11-01", r2Buckets: ["BUCKET"], bindings: { RELEASE_UPLOAD_TOKEN: token, RELEASE_UPLOAD_EXPIRES: String(Date.now() + 60000) } };
  mf = new Miniflare(options);
});
after(async () => { await mf?.dispose(); });

test("only explicit release entries are listed, and incomplete installers are not public", async () => {
  const result = await request("/api/releases/1.3.0"); assert.equal(result.status, 200);
  assert.equal((await result.json()).files[0].available, false);
  const latest = await (await request("/api/releases/latest")).json();
  assert.equal(latest.version, "1.3.0");
  assert.equal(latest.cadenceDays, 30);
  assert.equal(latest.agent.name, "Monthly Update Agent");
  assert.match(latest.policy, /monthly/i);
  assert.equal(latest.files[0].available, false);
  assert.equal((await request(`/api/releases/1.3.0/${file.id}`)).status, 404);
  assert.equal((await request("/api/releases/1.3.0/library-secret")).status, 404);
});
test("publisher access rejects guest, wrong token, cross-origin and expired authorization", async () => {
  assert.equal((await upload("start", undefined, { Authorization: "" })).status, 403);
  assert.equal((await upload("start", undefined, { Authorization: `Bearer ${"b".repeat(64)}` })).status, 403);
  assert.equal((await upload("start", undefined, { Origin: "https://other.test" })).status, 403);
  assert.equal((await request("/api/release-upload/unknown/start", { method: "POST", headers: { Authorization: `Bearer ${token}` } })).status, 404);
});
test("multipart validation rejects missing parts, bad lengths and invalid numbers", async () => {
  assert.equal((await upload("start")).status, 200);
  assert.equal((await upload("part/0", payload)).status, 400);
  assert.equal((await upload("part/2", payload)).status, 400);
  assert.equal((await upload("part/1", "short")).status, 400);
  assert.equal((await upload("complete", JSON.stringify({ parts: [] }))).status, 400);
});
test("wrong bytes cannot become a published installer", async () => {
  const part = await (await upload("part/1", "x".repeat(payload.length))).json();
  assert.equal((await upload("complete", JSON.stringify({ parts: [part] }))).status, 422);
  assert.equal((await request(`/api/releases/1.3.0/${file.id}`)).status, 404);
});
test("verified upload becomes a working download and supports restart without replacement", async () => {
  await upload("start"); const part = await (await upload("part/1", payload)).json();
  assert.equal((await upload("complete", JSON.stringify({ parts: [part] }))).status, 200);
  const result = await request(`/api/releases/1.3.0/${file.id}`); assert.equal(result.status, 200);
  assert.equal(result.headers.get("x-checksum-sha256"), sha256); assert.equal(await result.text(), payload);
  const latest = await (await request("/api/releases/latest")).json();
  assert.equal(latest.files[0].available, true);
  assert.equal((await (await upload("start")).json()).complete, true);
});
test("downloads support HEAD and byte ranges without exposing other bucket objects", async () => {
  const path = `/api/releases/1.3.0/${file.id}`;
  const head = await request(path, { method: "HEAD" }); assert.equal(head.headers.get("content-length"), String(payload.length)); assert.equal(await head.text(), "");
  const range = await request(path, { headers: { Range: "bytes=2-5" } }); assert.equal(range.status, 206); assert.equal(await range.text(), payload.slice(2, 6));
  assert.equal((await request(path, { headers: { Range: "bytes=100-200" } })).status, 416);
  assert.equal((await request(path, { headers: { Range: "bytes=0-1,3-4" } })).status, 416);
  assert.equal((await request(path, { method: "DELETE" })).status, 405);
});
test("the public downloads page offers platform labels, checksum and signing disclosure", async () => {
  const page = await request("/downloads"); const html = await page.text();
  assert.match(html, /Apple Silicon/); assert.match(html, /Intel/); assert.match(html, /Windows/); assert.match(html, /not Apple-notarized/); assert.match(html, /DMG download/); assert.match(html, new RegExp(sha256));
});
test("expired publisher credentials cannot write while published downloads remain available", async () => {
  await mf.setOptions({ ...options, bindings: { RELEASE_UPLOAD_TOKEN: token, RELEASE_UPLOAD_EXPIRES: "1" } });
  assert.equal((await upload("start")).status, 403);
  assert.equal((await request(`/api/releases/1.3.0/${file.id}`)).status, 200);
});

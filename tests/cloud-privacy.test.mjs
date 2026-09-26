import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

let mf, db, bucket, owner, editor, viewer, outsider, fixture;
const files = Object.fromEntries(["private", "shared", "public", "event", "orphan", "new-editor", "report"].map(name => {
  const data = `data:text/plain;base64,${Buffer.from(`Synthetic ${name} attachment`).toString("base64")}`;
  const hash = createHash("sha256").update(data).digest("hex");
  return [name, { data, hash, marker: `kinforge-asset:${hash}` }];
}));
async function call(path, method = "GET", data, account, extras = {}) {
  const response = await mf.dispatchFetch(`http://localhost${path}`, {
    method, headers: { "X-KinForge-Client": "1", "Content-Type": "application/json", cookie: account?.cookie ?? "", ...extras },
    ...(data === undefined ? {} : { body: typeof data === "string" ? data : JSON.stringify(data) })
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text, headers: response.headers, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const path = () => `/api/libraries/${owner.library}`;
const get = account => call(path(), "GET", undefined, account);
const put = (account, state, revision) => call(path(), "PUT", { state, revision }, account);
const asset = (account, name, method = "GET") => call(`${path()}/assets/${files[name].hash}`, method, method === "PUT" ? files[name].data : undefined, account);
async function account(name) {
  const result = await call("/api/auth/register", "POST", { email: `${name}@privacy.test`, name, password: "Private-library-password-42" });
  assert.equal(result.status, 201, result.text);
  const libraries = await call("/api/libraries", "GET", undefined, result);
  return { ...result, library: libraries.body.libraries[0].id, id: result.body.user.id };
}
async function invite(member, role) {
  const invitation = await call(`${path()}/sharing`, "POST", { role }, owner);
  assert.equal(invitation.status, 200, invitation.text);
  assert.equal((await call("/api/invitations/accept", "POST", { code: invitation.body.code }, member)).status, 200);
}
function makeFixture() {
  const state = Object.fromEntries(["books", "collections", "trees", "people", "relationships", "families", "events", "places", "placeTemplates", "sources", "sourceTemplates", "media", "todos", "dnaMatches", "records", "reportDrafts", "labels", "customEventTypes", "customFactTypes", "customFamilyTypes", "customRelationshipSubtypes", "changes"].map(key => [key, []]));
  const person = (id, extra = {}) => ({ id, treeId: "tree", givenName: id, familyName: "Example", facts: [], eventIds: [], sourceIds: [], mediaIds: [], government: {}, ...extra });
  const source = (id, mediaIds = []) => ({ id, treeId: "tree", title: id, fields: {}, citation: id, mediaIds });
  const media = (id, file, extra = {}) => ({ id, treeId: "tree", title: id, dataUrl: files[file].marker, tags: [], assignedTo: [], ...extra });
  const protection = (id, entityKind, entityId, extra = {}) => ({ id, treeId: "tree", entityKind, entityId, type: "custody", status: "recorded", notes: id, sourceIds: [], mediaIds: [], ...extra });
  return { ...state, chartConfig: {}, customFactTerms: [],
    books: [{ id: "book", title: "Family archive" }],
    collections: [{ id: "collection", bookId: "book", name: "Research" }],
    trees: [{ id: "tree", bookId: "book", collectionId: "collection", title: "Family tree" }],
    people: [
      person("person", { government: { caseNumber: "SECRET-CASE", protectiveServices: true, custodyNotes: "SECRET-CUSTODY" },
        eventIds: ["public-event", "private-event"], sourceIds: ["public-source", "secret-source"], mediaIds: ["public-media", "secret-media"], profileMediaId: "secret-media",
        facts: [{ id: "public-fact", type: "Occupation", value: "Teacher", sourceIds: [] }, { id: "secret-fact", private: true, value: "SECRET-FACT", sourceIds: ["fact-source"] }],
        accessNeeds: [{ id: "secret-need", private: true, label: "SECRET-NEED", sourceId: "need-source" }] }),
      person("shared-person", { sensitiveVisibility: "shared", government: { caseNumber: "SHARED-CASE" },
        eventIds: ["shared-event"], facts: [{ id: "shared-fact", private: true, value: "SHARED-FACT", sourceIds: ["shared-source"] }],
        accessNeeds: [{ id: "shared-need", private: true, label: "SHARED-NEED" }] })
    ],
    families: [{ id: "family", treeId: "tree", name: "Example family", partnerIds: ["person", "shared-person"], childIds: [], eventIds: ["public-event"], sourceIds: ["secret-source"] }],
    relationships: [{ id: "relationship", treeId: "tree", fromId: "person", toId: "shared-person", type: "spouse", sourceIds: [] }],
    events: [
      { id: "public-event", type: "Marriage", description: "Public genealogy", sourceIds: [], mediaIds: [] },
      { id: "private-event", private: true, description: "SECRET-EVENT", sourceIds: ["event-source"], mediaIds: ["event-media"] },
      { id: "shared-event", private: false, description: "SHARED-EVENT", sourceIds: ["shared-source"], mediaIds: [] },
      { id: "orphan-event", private: true, description: "SECRET-ORPHAN-EVENT", sourceIds: [], mediaIds: [] }
    ],
    protectionRecords: [
      protection("secret-record", "person", "person", { sourceIds: ["secret-source"], mediaIds: ["evidence-media"] }),
      protection("secret-family-record", "family", "family", { visibility: "private" }),
      protection("secret-relationship-record", "relationship", "relationship", { visibility: "private" }),
      protection("shared-record", "person", "shared-person", { visibility: "shared", sourceIds: ["shared-source"], mediaIds: ["shared-media"] })
    ],
    sources: [source("public-source"), source("secret-source", ["evidence-media"]), source("fact-source"), source("need-source"), source("event-source"), source("shared-source")],
    media: [media("secret-media", "private", { tags: ["government-file", "Custody"], transcript: "SECRET-TRANSCRIPT" }),
      media("evidence-media", "private"), media("event-media", "event"),
      media("shared-media", "shared", { tags: ["government-file"], visibility: "shared", transcript: "SHARED-TRANSCRIPT" }),
      media("public-media", "public")],
    reportDrafts: [{ id: "report", treeId: "tree", title: "Shared family report", body: "Ordinary saved report content" }],
    changes: [{ id: "secret-history", treeId: "tree", label: "Private record changed", before: "SECRET-OLD-CASE", after: "SECRET-NEW-CASE" }]
  };
}
before(async () => {
  // Bundle the actual worker in memory so other agents' build artifacts stay untouched.
  const bundled = await build({ entryPoints: ["server/worker.ts"], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  mf = new Miniflare({ modules: true, script: bundled.outputFiles[0].text, compatibilityDate: "2024-11-01", d1Databases: ["DB"], r2Buckets: ["BUCKET"] });
  db = await mf.getD1Database("DB"); bucket = await mf.getR2Bucket("BUCKET");
  for (const name of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) {
    for (const sql of (await readFile(`drizzle/${name}`, "utf8")).split("--> statement-breakpoint").filter(sql => sql.trim())) await db.prepare(sql.trim()).run();
  }
  owner = await account("owner"); editor = await account("editor"); viewer = await account("viewer"); outsider = await account("outsider");
  await invite(editor, "editor"); await invite(viewer, "viewer");
  for (const name of Object.keys(files)) assert.equal((await asset(owner, name, "PUT")).status, 200);
});
beforeEach(async () => {
  fixture = makeFixture();
  const current = await get(owner);
  const saved = await put(owner, fixture, current.body.revision);
  assert.equal(saved.status, 200, saved.text);
});
after(async () => { await mf?.dispose(); });

test("anonymous guests and unrelated signed-in accounts cannot read any library documents or files", async () => {
  for (const guest of [undefined, { cookie: `kinforge_session=${"0".repeat(64)}` }]) {
    assert.equal((await get(guest)).status, 401);
    assert.equal((await call(`${path()}?since=1`, "GET", undefined, guest)).status, 401);
    for (const name of ["private", "shared", "public"]) assert.equal((await asset(guest, name)).status, 401);
  }
  assert.equal((await get(outsider)).status, 404);
  for (const name of ["private", "shared", "public"]) assert.equal((await asset(outsider, name)).status, 404);
});

test("owner retains private details and files; members get only shared sensitive details and normal genealogy", async () => {
  const owned = await get(owner);
  assert.deepEqual(owned.body.state, fixture);
  assert.equal((await asset(owner, "private")).body, files.private.data);
  for (const member of [editor, viewer]) {
    const response = await get(member), state = response.body.state;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.doesNotMatch(response.text, /SECRET-|secret-|fact-source|need-source|event-source|private-event|orphan-event|event-media|evidence-media/);
    assert.ok(!response.text.includes(files.private.hash));
    assert.deepEqual(state.protectionRecords.map(row => row.id), ["shared-record"]);
    assert.equal(state.people[0].government.caseNumber, "");
    assert.equal(state.people[0].government.protectiveServices, false);
    assert.equal(state.people[0].facts.length, 1);
    assert.deepEqual(state.people[0].accessNeeds, []);
    assert.deepEqual(state.people[0].eventIds, ["public-event"]);
    assert.deepEqual(state.people[0].mediaIds, ["public-media"]);
    assert.deepEqual(state.people[0].sourceIds, ["public-source"]);
    assert.equal(state.people[0].profileMediaId, undefined);
    assert.deepEqual(state.families[0].sourceIds, []);
    assert.equal(state.people.length, 2); assert.equal(state.families.length, 1); assert.equal(state.relationships.length, 1);
    assert.equal(state.people[1].government.caseNumber, "SHARED-CASE");
    assert.equal(state.people[1].facts[0].value, "SHARED-FACT");
    assert.equal(state.people[1].accessNeeds[0].label, "SHARED-NEED");
    assert.ok(state.events.some(row => row.description === "SHARED-EVENT"));
    assert.deepEqual(state.reportDrafts, fixture.reportDrafts);
    assert.deepEqual(state.changes, []);
    for (const name of ["private", "event", "orphan"]) assert.equal((await asset(member, name)).status, 404);
    for (const name of ["public", "shared"]) assert.equal((await asset(member, name)).body, files[name].data);
  }
});

test("shared editor edits preserve every hidden field, record, attachment and reference", async () => {
  const before = await get(owner), visible = await get(editor);
  const state = visible.body.state;
  state.people[0].givenName = "Edited name";
  state.people[0].facts[0].value = "Historian";
  state.people[1].government.caseNumber = "Edited shared case";
  state.protectionRecords[0].status = "reviewed";
  state.reportDrafts[0].body = "Edited shared report";
  state.media.find(row => row.id === "public-media").title = "Edited public photo";
  state.changes.push({ id: "editor-change", label: "Edited family archive" });
  const saved = await put(editor, state, visible.body.revision);
  assert.equal(saved.status, 200, saved.text);
  const after = (await get(owner)).body.state;
  assert.equal(after.people[0].givenName, "Edited name");
  assert.deepEqual(after.people[0].government, before.body.state.people[0].government);
  assert.deepEqual(after.people[0].accessNeeds, before.body.state.people[0].accessNeeds);
  assert.deepEqual(after.people[0].facts.find(row => row.id === "secret-fact"), fixture.people[0].facts[1]);
  assert.equal(after.people[0].facts[0].value, "Historian");
  for (const field of ["eventIds", "sourceIds", "mediaIds", "profileMediaId"]) assert.deepEqual(after.people[0][field], fixture.people[0][field]);
  assert.deepEqual(after.protectionRecords.filter(row => row.visibility !== "shared"), fixture.protectionRecords.filter(row => row.visibility !== "shared"));
  assert.equal(after.protectionRecords.find(row => row.id === "shared-record").status, "reviewed");
  assert.equal(after.people[1].government.caseNumber, "Edited shared case");
  assert.equal(after.reportDrafts[0].body, "Edited shared report");
  for (const key of ["events", "sources", "media"]) for (const row of fixture[key].filter(row => !visible.body.state[key].some(visibleRow => visibleRow.id === row.id))) assert.deepEqual(after[key].find(item => item.id === row.id), row);
  assert.deepEqual(after.changes.find(row => row.id === "secret-history"), fixture.changes[0]);
  assert.equal((await asset(editor, "private")).status, 404);
  // CloudSync retains the last submitted draft, including its own audit entry, until a newer revision arrives.
  state.people[0].givenName = "Second edit from the same cached draft";
  const secondSave = await put(editor, state, saved.body.revision);
  assert.equal(secondSave.status, 200, secondSave.text);
  const twiceSaved = (await get(owner)).body.state;
  assert.deepEqual(twiceSaved.changes.find(row => row.id === "secret-history"), fixture.changes[0]);
  assert.equal(twiceSaved.people[0].givenName, "Second edit from the same cached draft");
});

test("malicious editor writes cannot reveal or overwrite hidden identifiers, values or privacy flags", async t => {
  const mutations = {
    "hidden protection record": state => state.protectionRecords.push({ ...fixture.protectionRecords[0], visibility: "shared", notes: "overwrite" }),
    "hidden fact": state => state.people[0].facts.push({ id: "secret-fact", value: "overwrite" }),
    "hidden event": state => state.events.push({ id: "private-event", private: false, description: "overwrite" }),
    "hidden source": state => state.sources.push({ id: "secret-source", title: "overwrite" }),
    "hidden media": state => state.media.push({ id: "secret-media", visibility: "shared", dataUrl: files.private.marker }),
    "hidden reference": state => state.people[1].eventIds.push("private-event"),
    "hidden assignment": state => state.media[0].assignedTo.push({ kind: "event", id: "private-event" }),
    "private known hash alias": state => { state.chartConfig.extraText = files.private.marker; },
    "unreferenced owner hash alias": state => { state.chartConfig.extraText = files.orphan.marker; },
    "legacy government overwrite": state => { state.people[0].government.caseNumber = "overwrite"; },
    "new government field on private person": state => { state.people[0].government.agency = "overwrite"; },
    "new access annotation on private person": state => { state.people[0].accessNeeds.push({ id: "new-need", label: "overwrite" }); },
    "person sharing flag": state => { state.people[0].sensitiveVisibility = "shared"; },
    "shared person revocation flag": state => { state.people[1].sensitiveVisibility = "private"; },
    "record sharing flag": state => { state.protectionRecords[0].visibility = "private"; },
    "media sharing flag": state => { state.media.find(row => row.id === "shared-media").visibility = "private"; },
    "event private flag": state => { state.events.find(row => row.id === "shared-event").private = true; },
    "fact private flag": state => { state.people[1].facts[0].private = false; },
    "delete protected person": state => { state.people = state.people.filter(row => row.id !== "person"); },
    "delete protected family": state => { state.families = []; },
    "delete protected relationship": state => { state.relationships = []; },
    "delete protected tree": state => { state.trees = []; },
    "delete protected collection": state => { state.collections = []; },
    "delete protected book": state => { state.books = []; }
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, async () => {
    const before = await get(owner), visible = await get(editor);
    mutate(visible.body.state);
    const result = await put(editor, visible.body.state, visible.body.revision);
    assert.equal(result.status, 403, result.text);
    assert.equal(result.body.code, "LIBRARY_PRIVACY_REVIEW");
    if (name.startsWith("delete protected")) assert.match(result.body.error, /Only the library owner can delete this item\. Undo the deletion/);
    assert.doesNotMatch(result.text, /secret-|SECRET-|[a-f0-9]{64}/);
    assert.deepEqual((await get(owner)).body, before.body);
  });
});

test("editors can create shared records with new identifiers without gaining access to private records", async () => {
  const visible = await get(editor);
  const record = { id: "editor-record", treeId: "tree", entityKind: "person", entityId: "person", type: "Court Record", status: "reviewed", sourceIds: ["public-source"], mediaIds: ["public-media"], visibility: "shared" };
  visible.body.state.protectionRecords.push(record);
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 200);
  assert.deepEqual((await get(viewer)).body.state.protectionRecords.find(row => row.id === record.id), record);
  assert.ok((await get(owner)).body.state.protectionRecords.some(row => row.id === "secret-record"));
  assert.doesNotMatch((await get(viewer)).text, /SECRET-|secret-record/);
});

test("older editor payloads preserve omitted optional records and existing shared visibility flags", async () => {
  const visible = await get(editor);
  delete visible.body.state.protectionRecords;
  delete visible.body.state.people[1].sensitiveVisibility;
  delete visible.body.state.media.find(row => row.id === "shared-media").visibility;
  visible.body.state.people[0].givenName = "Older client edit";
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 200);
  const current = (await get(owner)).body.state;
  assert.deepEqual(new Set(current.protectionRecords.map(row => row.id)), new Set(fixture.protectionRecords.map(row => row.id)));
  assert.equal(current.people[1].sensitiveVisibility, "shared");
  assert.equal(current.media.find(row => row.id === "shared-media").visibility, "shared");
  assert.equal((await asset(viewer, "shared")).status, 200);
});

test("hidden audit entries do not suppress an otherwise shared attachment", async () => {
  const owned = await get(owner);
  owned.body.state.changes.push({ id: "shared-file-history", label: "File changed", after: files.shared.marker });
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 200);
  assert.equal((await asset(viewer, "shared")).body, files.shared.data);
  assert.deepEqual((await get(viewer)).body.state.changes, []);
});

test("report privacy metadata protects private drafts and files while ordinary and explicitly shared reports remain available", async () => {
  const owned = await get(owner);
  const reports = [
    { id: "private-report", treeId: "tree", title: "SECRET-REPORT", body: "SECRET-REPORT-BODY", visibility: "private", file: files.report.marker },
    { id: "generated-private-report", treeId: "tree", title: "SECRET-GENERATED", html: "<p>SECRET-GENERATED-CONTENT</p>", options: { includePrivate: true } },
    { id: "explicitly-shared-report", treeId: "tree", title: "Shared sensitive report", body: "Owner deliberately shared this report", visibility: "shared", options: { includePrivate: true } }
  ];
  owned.body.state.reportDrafts.push(...reports);
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 200);
  const stored = await get(owner);
  assert.equal(stored.body.state.reportDrafts.find(row => row.id === "generated-private-report").visibility, "private");
  assert.equal((await asset(owner, "report")).body, files.report.data);
  for (const member of [viewer, editor]) {
    const visible = await get(member);
    assert.deepEqual(visible.body.state.reportDrafts.map(row => row.id), ["report", "explicitly-shared-report"]);
    assert.doesNotMatch(visible.text, /SECRET-REPORT|SECRET-GENERATED|private-report/);
    assert.ok(!visible.text.includes(files.report.hash));
    assert.equal((await asset(member, "report")).status, 404);
  }
  const visible = await get(editor);
  visible.body.state.reportDrafts[0].body = "Edited ordinary report";
  visible.body.state.reportDrafts[1].body = "Edited shared sensitive report";
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 200);
  const after = await get(owner);
  for (const id of ["private-report", "generated-private-report"]) assert.deepEqual(after.body.state.reportDrafts.find(row => row.id === id), stored.body.state.reportDrafts.find(row => row.id === id));
  for (const mutation of [
    state => state.reportDrafts.push({ ...reports[0], visibility: "shared" }),
    state => { state.reportDrafts[1].visibility = "private"; },
    state => { state.chartConfig.extraText = files.report.marker; }
  ]) {
    const attempt = await get(editor);
    mutation(attempt.body.state);
    assert.equal((await put(editor, attempt.body.state, attempt.body.revision)).status, 403);
  }
});

test("owners can explicitly share, revoke and delete report drafts; invalid visibility remains private", async () => {
  const owned = await get(owner);
  const report = { id: "protected-report", treeId: "tree", title: "Sensitive report", body: "Sensitive content", options: { includePrivate: true }, visibility: "PUBLIC", file: files.report.marker };
  owned.body.state.reportDrafts.push(report);
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 200);
  let current = await get(owner);
  assert.equal(current.body.state.reportDrafts.at(-1).visibility, "private");
  assert.equal((await asset(viewer, "report")).status, 404);
  current.body.state.reportDrafts.at(-1).visibility = "shared";
  assert.equal((await put(owner, current.body.state, current.body.revision)).status, 200);
  assert.equal((await asset(viewer, "report")).status, 200);
  const oldShared = await get(editor);
  current = await get(owner);
  current.body.state.reportDrafts.at(-1).visibility = "private";
  assert.equal((await put(owner, current.body.state, current.body.revision)).status, 200);
  assert.equal((await asset(viewer, "report")).status, 404);
  assert.equal((await put(editor, oldShared.body.state, oldShared.body.revision)).status, 409);
  current = await get(owner);
  current.body.state.reportDrafts = current.body.state.reportDrafts.filter(row => row.id !== report.id);
  assert.equal((await put(owner, current.body.state, current.body.revision)).status, 200);
  assert.ok(!(await get(owner)).body.state.reportDrafts.some(row => row.id === report.id));
});

test("private asset aliases already stored in public fields cannot bypass direct-file privacy", async () => {
  const owned = await get(owner);
  owned.body.state.chartConfig.extraText = files.private.marker;
  owned.body.state.media.push({ id: "aliased-media", treeId: "tree", title: "Duplicate reference", dataUrl: files.private.marker, assignedTo: [], tags: [] });
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 200);
  const visible = await get(editor);
  assert.ok(!visible.text.includes(files.private.hash));
  assert.equal((await asset(editor, "private")).status, 404);
  assert.equal((await asset(editor, "private", "PUT")).status, 200);
  visible.body.state.chartConfig.extraText = files.private.marker;
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 403);
});

test("owner can share then revoke private records and files, and stale editors cannot undo the revocation", async () => {
  const owned = await get(owner), state = owned.body.state;
  state.people[0].sensitiveVisibility = "shared";
  state.protectionRecords[0].visibility = "shared";
  state.events.find(row => row.id === "private-event").private = false;
  for (const row of state.media) if (["secret-media", "evidence-media", "event-media"].includes(row.id)) row.visibility = "shared";
  assert.equal((await put(owner, state, owned.body.revision)).status, 200);
  const shared = await get(editor);
  assert.equal(shared.body.state.people[0].government.caseNumber, "SECRET-CASE");
  assert.ok(shared.body.state.protectionRecords.some(row => row.id === "secret-record"));
  assert.ok(shared.body.state.events.some(row => row.id === "private-event"));
  assert.equal((await asset(viewer, "private")).status, 200);
  state.people[0].sensitiveVisibility = "private";
  state.protectionRecords[0].visibility = "private";
  state.events.find(row => row.id === "private-event").private = true;
  for (const row of state.media) if (["secret-media", "evidence-media", "event-media"].includes(row.id)) row.visibility = "private";
  assert.equal((await put(owner, state, shared.body.revision)).status, 200);
  const revoked = await get(viewer);
  assert.doesNotMatch(revoked.text, /SECRET-|secret-record|private-event/);
  assert.equal((await asset(viewer, "private")).status, 404);
  assert.equal((await put(editor, shared.body.state, shared.body.revision)).status, 409);
  assert.equal((await put(editor, shared.body.state, revoked.body.revision)).status, 403);
});

test("explicit private events remain owner-only even when every linked person shares their sensitive details", async () => {
  const owned = await get(owner);
  owned.body.state.people[0].sensitiveVisibility = "shared";
  owned.body.state.people[1].eventIds.push("private-event");
  owned.body.state.families[0].eventIds.push("orphan-event");
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 200);
  const visible = await get(editor);
  assert.deepEqual(visible.body.state.events.map(row => row.id), ["public-event", "shared-event"]);
  assert.equal(visible.body.state.people[0].government.caseNumber, "SECRET-CASE");
  assert.ok(!visible.body.state.people[0].eventIds.includes("private-event"));
  assert.ok(!visible.body.state.people[1].eventIds.includes("private-event"));
  assert.equal((await asset(viewer, "event")).status, 404);
  visible.body.state.people[1].eventIds.push("private-event");
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 403);
});

test("new editor uploads are readable only after a visible latest-state marker references them", async () => {
  assert.equal((await asset(editor, "new-editor", "PUT")).status, 200);
  assert.equal((await asset(editor, "new-editor")).status, 404);
  const visible = await get(editor);
  visible.body.state.media.push({ id: "new-public-media", treeId: "tree", title: "Editor upload", tags: [], assignedTo: [], dataUrl: files["new-editor"].marker });
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 200);
  assert.equal((await asset(viewer, "new-editor")).body, files["new-editor"].data);
  const current = await get(editor);
  current.body.state.media = current.body.state.media.filter(row => row.id !== "new-public-media");
  assert.equal((await put(editor, current.body.state, current.body.revision)).status, 200);
  assert.equal((await asset(viewer, "new-editor")).status, 404);
  assert.equal((await asset(owner, "new-editor")).status, 200);
});

test("viewer writes, cross-origin writes and revoked memberships remain denied", async () => {
  const visible = await get(viewer);
  const denied = await put(viewer, visible.body.state, visible.body.revision);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, undefined);
  assert.equal((await asset(viewer, "public", "PUT")).status, 403);
  assert.equal((await call(`${path()}/sharing`, "POST", { role: "editor" }, viewer)).status, 403);
  assert.equal((await call(path(), "PUT", { state: fixture, revision: visible.body.revision }, owner, { origin: "https://untrusted.test" })).status, 403);
  assert.equal((await call(`${path()}/members/${viewer.id}`, "DELETE", undefined, owner)).status, 200);
  assert.equal((await get(viewer)).status, 404);
  assert.equal((await asset(viewer, "shared")).status, 404);
  await invite(viewer, "viewer");
});

test("owner deletion is real in the current document while previous private snapshots remain recoverable", async () => {
  const before = await get(owner);
  const old = await db.prepare("SELECT object_key FROM libraries WHERE id=?").bind(owner.library).first();
  const empty = makeFixture();
  for (const key of Object.keys(empty)) if (Array.isArray(empty[key])) empty[key] = [];
  assert.equal((await put(owner, empty, before.body.revision)).status, 200);
  assert.deepEqual((await get(owner)).body.state, empty);
  assert.deepEqual((await get(editor)).body.state, empty);
  assert.equal((await asset(editor, "private")).status, 404);
  assert.equal((await asset(editor, "shared")).status, 404);
  assert.equal((await asset(owner, "private")).status, 200);
  assert.deepEqual(await (await bucket.get(old.object_key)).json(), before.body.state);
});

test("invalid visibility values fail closed and malformed protection record lists are rejected", async () => {
  const owned = await get(owner), state = owned.body.state;
  state.people[1].sensitiveVisibility = "SHARED";
  state.protectionRecords[3].visibility = true;
  state.media.find(row => row.id === "shared-media").visibility = { shared: true };
  assert.equal((await put(owner, state, owned.body.revision)).status, 200);
  const after = await get(owner);
  assert.equal(after.body.state.people[1].sensitiveVisibility, "private");
  assert.equal(after.body.state.protectionRecords[3].visibility, "private");
  assert.equal(after.body.state.media.find(row => row.id === "shared-media").visibility, "private");
  assert.doesNotMatch((await get(viewer)).text, /SHARED-CASE|SHARED-FACT|SHARED-NEED|SHARED-TRANSCRIPT/);
  assert.ok((await get(viewer)).body.state.events.some(row => row.id === "shared-event"));
  assert.equal((await asset(viewer, "shared")).status, 404);
  for (const protectionRecords of [{}, [null], [{ id: "duplicate" }, { id: "duplicate" }]]) {
    assert.equal((await put(owner, { ...state, protectionRecords }, after.body.revision)).status, 400);
  }
});

test("simultaneous private owner writes and public editor writes use the same revision conflict guard", async () => {
  const owned = await get(owner), visible = await get(editor);
  owned.body.state.people[0].government.caseNumber = "SECRET-CONCURRENT";
  visible.body.state.people[0].givenName = "Concurrent public edit";
  const results = await Promise.all([put(owner, owned.body.state, owned.body.revision), put(editor, visible.body.state, visible.body.revision)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const current = await get(owner);
  if (results[0].status === 200) assert.equal(current.body.state.people[0].government.caseNumber, "SECRET-CONCURRENT");
  else {
    assert.equal(current.body.state.people[0].givenName, "Concurrent public edit");
    assert.equal(current.body.state.people[0].government.caseNumber, "SECRET-CASE");
  }
  assert.equal((await put(owner, owned.body.state, owned.body.revision)).status, 409);
  assert.equal((await put(editor, visible.body.state, visible.body.revision)).status, 409);
});

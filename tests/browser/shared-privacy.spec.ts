import { expect, test as base, type BrowserContext, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { createEmptyPerson, createSeedState, type AppState, type MediaItem } from "../../src/domain";
import { createProtectionRecord } from "../../src/protection";

const password = "Privacy-browser-testing-password-42";
const clientHeaders = { "X-KinForge-Client": "1" };
const personId = "person_june";
const sharedPersonId = "person_alex";
const treeId = "tree_demo";
const privateRecordId = "browser-private-record";
const sharedRecordId = "browser-shared-record";
type Account = { context: BrowserContext; id: string; email: string; libraryId: string };
type Document = { state: AppState; revision: number; updatedAt: number };
type Asset = { data: string; hash: string; marker: string };
type Scenario = {
  owner: Account; editor: Account; viewer: Account;
  state: AppState; prefix: string; privateAsset: Asset; sharedAsset: Asset;
  context: () => Promise<BrowserContext>;
};

async function register(context: BrowserContext, email: string): Promise<Account> {
  const response = await context.request.post("/api/auth/register", { headers: clientHeaders, data: { email, password, name: "Privacy test account" } });
  expect(response.status(), await response.text()).toBe(201);
  const { user } = await response.json();
  const libraries = await context.request.get("/api/libraries");
  expect(libraries.status()).toBe(200);
  return { context, id: user.id, email, libraryId: (await libraries.json()).libraries[0].id };
}

async function document(account: Account, libraryId = account.libraryId): Promise<Document> {
  const response = await account.context.request.get(`/api/libraries/${libraryId}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function invite(owner: Account, member: Account, role: "editor" | "viewer") {
  const invitation = await owner.context.request.post(`/api/libraries/${owner.libraryId}/sharing`, { headers: clientHeaders, data: { role } });
  expect(invitation.status(), await invitation.text()).toBe(200);
  const accepted = await member.context.request.post("/api/invitations/accept", { headers: clientHeaders, data: { code: (await invitation.json()).code } });
  expect(accepted.status(), await accepted.text()).toBe(200);
  expect((await accepted.json()).libraryId).toBe(owner.libraryId);
}

function asset(label: string): Asset {
  const data = `data:text/plain;base64,${Buffer.from(label.repeat(200)).toString("base64")}`;
  const hash = createHash("sha256").update(data).digest("hex");
  return { data, hash, marker: `kinforge-asset:${hash}` };
}

function seed(prefix: string, privateAsset: Asset, sharedAsset: Asset): AppState {
  const state = createSeedState();
  state.trees[0].title = `${prefix} family archive`;
  state.books[0].title = `${prefix} account book`;
  const person = state.people.find(row => row.id === personId)!;
  const sharedPerson = state.people.find(row => row.id === sharedPersonId)!;
  person.givenName = `${prefix} June`;
  person.sensitiveVisibility = "private";
  person.government.caseNumber = `${prefix}-PRIVATE-CASE`;
  person.government.custodyNotes = `${prefix}-PRIVATE-CUSTODY`;
  person.facts.push({ id: "browser-private-fact", type: "Medical note", value: `${prefix}-PRIVATE-FACT`, private: true, sourceIds: ["browser-private-source"] });
  person.accessNeeds = [{ id: "browser-private-need", glyphId: "need-blind", label: "Blind", detail: `${prefix}-PRIVATE-NEED`, private: true }];
  sharedPerson.sensitiveVisibility = "shared";
  sharedPerson.government.caseNumber = `${prefix}-SHARED-CASE`;
  sharedPerson.facts.push({ id: "browser-shared-fact", type: "Medical note", value: `${prefix}-SHARED-FACT`, private: true, sourceIds: [] });
  sharedPerson.accessNeeds = [{ id: "browser-shared-need", glyphId: "need-blind", label: "Blind", detail: `${prefix}-SHARED-NEED`, private: true }];
  state.events.push(
    { id: "browser-private-event", type: "Medical Event", date: "2026-01-01", description: `${prefix}-PRIVATE-EVENT`, private: true, sourceIds: [], mediaIds: [] },
    { id: "browser-shared-event", type: "Court Record", date: "2026-02-01", description: `${prefix}-SHARED-EVENT`, private: false, sourceIds: [], mediaIds: [] }
  );
  person.eventIds.push("browser-private-event", "browser-shared-event");
  sharedPerson.eventIds.push("browser-private-event");
  state.sources.push({ ...state.sources[0], id: "browser-private-source", title: `${prefix}-PRIVATE-SOURCE`, mediaIds: ["browser-private-media"] });
  const media = (id: string, file: Asset, visibility: "private" | "shared"): MediaItem => ({
    ...state.media[0], id, treeId, title: `${prefix}-${visibility.toUpperCase()}-FILE`, type: "document", dataUrl: file.marker,
    externalUrl: "", tags: ["government-file"], assignedTo: [{ kind: "person", id: personId }], visibility,
    story: "Synthetic browser privacy fixture", transcript: ""
  });
  state.media.push(media("browser-private-media", privateAsset, "private"), media("browser-shared-media", sharedAsset, "shared"));
  person.mediaIds.push("browser-private-media", "browser-shared-media");
  state.protectionRecords = [
    { ...createProtectionRecord({ treeId, entityKind: "person", entityId: personId }), id: privateRecordId, type: "Custody Removal", status: `${prefix}-PRIVATE-STATUS`, notes: `${prefix}-PRIVATE-RECORD`, sourceIds: ["browser-private-source"], mediaIds: ["browser-private-media"] },
    { ...createProtectionRecord({ treeId, entityKind: "person", entityId: personId }, false), id: sharedRecordId, type: "Court Record", status: `${prefix}-SHARED-STATUS`, notes: `${prefix}-SHARED-RECORD`, mediaIds: ["browser-shared-media"] }
  ];
  state.reportDrafts = [
    { id: "browser-shared-report", treeId, personId, title: `${prefix} shared report`, type: "Person Report", body: `${prefix}-SHARED-REPORT`, visibility: "shared", updatedAt: new Date().toISOString() },
    { id: "browser-private-report", treeId, personId, title: `${prefix}-PRIVATE-REPORT`, type: "Person Report", body: `${prefix}-PRIVATE-REPORT-BODY`, options: { includePrivate: true }, visibility: "private", updatedAt: new Date().toISOString() }
  ];
  state.changes = [{ id: "browser-private-history", at: new Date().toISOString(), treeId, label: `${prefix}-PRIVATE-HISTORY` }];
  return state;
}

const test = base.extend<{ privacy: Scenario }>({
  privacy: async ({ browser, baseURL }, use) => {
    expect(baseURL, "Run against the local Vite server with its local API proxy").toBeTruthy();
    expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(baseURL!).hostname);
    const run = randomUUID().replaceAll("-", "");
    const prefix = `Privacy-${run.slice(0, 10)}`;
    const contexts: BrowserContext[] = [];
    const context = async () => {
      const item = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { "CF-Connecting-IP": `2001:db8:${run.slice(0, 4)}:${run.slice(4, 8)}::${(contexts.length + 1).toString(16)}` } });
      contexts.push(item);
      return item;
    };
    try {
      const owner = await register(await context(), `privacy-owner-${run}@example.test`);
      const editor = await register(await context(), `privacy-editor-${run}@example.test`);
      const viewer = await register(await context(), `privacy-viewer-${run}@example.test`);
      const privateAsset = asset(`${prefix}-PRIVATE-BYTES`), sharedAsset = asset(`${prefix}-SHARED-BYTES`);
      const state = seed(prefix, privateAsset, sharedAsset);
      for (const file of [privateAsset, sharedAsset]) {
        const uploaded = await owner.context.request.put(`/api/libraries/${owner.libraryId}/assets/${file.hash}`, { headers: clientHeaders, data: file.data });
        expect(uploaded.status(), await uploaded.text()).toBe(200);
      }
      const saved = await owner.context.request.put(`/api/libraries/${owner.libraryId}`, { headers: clientHeaders, data: { revision: 0, state } });
      expect(saved.status(), await saved.text()).toBe(200);
      await invite(owner, editor, "editor");
      await invite(owner, viewer, "viewer");
      await use({ owner, editor, viewer, state, prefix, privateAsset, sharedAsset, context });
    } finally {
      await Promise.all(contexts.map(item => item.close()));
    }
  }
});
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

async function synced(page: Page) {
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".cloud-notice[role=alert]")).toHaveCount(0);
}

async function openLibrary(account: Account, owner: Account) {
  const page = await account.context.newPage();
  await page.goto("/");
  await synced(page);
  // Membership alone does not select the shared library; exercise the actual selector.
  await page.getByRole("button", { name: "Account & sharing", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Account & sharing", exact: true });
  const library = dialog.getByRole("combobox", { name: "Cloud library", exact: true });
  await expect(library.locator(`option[value="${owner.libraryId}"]`)).toContainText(owner.email);
  if (account.id === owner.id) {
    await expect(library).toHaveValue(owner.libraryId);
    await dialog.getByRole("button", { name: "Close sharing", exact: true }).click();
  } else await library.selectOption(owner.libraryId);
  await expect(dialog).toHaveCount(0);
  await synced(page);
  return page;
}

async function personEditor(page: Page, id = personId) {
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "People", exact: true }).click();
  await page.locator(`a.people-table-row[href*="/${id}/"]`).click();
  await page.getByRole("navigation", { name: "Person sections", exact: true }).getByRole("link", { name: "Edit details", exact: true }).click();
  await expect(page.getByLabel("Sensitive detail visibility", { exact: true })).toBeVisible();
}

async function saveUI(page: Page, libraryId: string, action: () => Promise<unknown>) {
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/libraries/${libraryId}` && response.request().method() === "PUT", { timeout: 25000 });
  await action();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  await synced(page);
}

function failedSaves(page: Page, libraryId: string) {
  const failures: number[] = [];
  page.on("response", response => {
    if (new URL(response.url()).pathname === `/api/libraries/${libraryId}` && response.request().method() === "PUT" && response.status() >= 400) failures.push(response.status());
  });
  return failures;
}

async function refreshLibrary(page: Page) {
  // A sync refresh preserves the chosen shared library; a full reload selects the account's own library.
  const response = page.waitForResponse(item => item.request().method() === "GET" && /\/api\/libraries\/[^/]+$/.test(new URL(item.url()).pathname));
  await page.getByRole("button", { name: /^Cloud sync:/ }).click();
  expect((await response).status()).toBe(200);
  await synced(page);
}

test("invited editor and viewer see shared records only; real shared edits preserve owner-private data", async ({ privacy }) => {
  const { owner, editor, viewer, state, prefix, privateAsset, sharedAsset } = privacy;
  const ownerPage = await openLibrary(owner, owner);
  const editorPage = await openLibrary(editor, owner);
  const viewerPage = await openLibrary(viewer, owner);
  const failures = failedSaves(editorPage, owner.libraryId);
  await personEditor(ownerPage);
  await expect(ownerPage.getByLabel("Case number", { exact: true })).toHaveValue(`${prefix}-PRIVATE-CASE`);
  await expect(ownerPage.locator(".protection-record")).toHaveCount(2);
  for (const [account, page] of [[editor, editorPage], [viewer, viewerPage]] as const) {
    const loaded = await document(account, owner.libraryId);
    expect(JSON.stringify(loaded.state)).not.toContain(`${prefix}-PRIVATE`);
    expect(loaded.state.protectionRecords?.map(row => row.id)).toEqual([sharedRecordId]);
    expect((await account.context.request.get(`/api/libraries/${owner.libraryId}/assets/${privateAsset.hash}`)).status()).toBe(404);
    expect(await (await account.context.request.get(`/api/libraries/${owner.libraryId}/assets/${sharedAsset.hash}`)).text()).toBe(sharedAsset.data);
    await personEditor(page);
    await expect(page.getByLabel("Case number", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Sensitive detail visibility", { exact: true })).toBeDisabled();
    await expect(page.locator(".protection-record")).toHaveCount(1);
    await expect(page.locator(".protection-record")).toContainText(`${prefix}-SHARED-STATUS`);
    await expect(page.getByText(`${prefix}-PRIVATE-FACT`, { exact: true })).toHaveCount(0);
    await expect(page.getByText(new RegExp(`${prefix}-PRIVATE-EVENT`))).toHaveCount(0);
    await personEditor(page, sharedPersonId);
    await expect(page.getByLabel("Case number", { exact: true })).toHaveValue(`${prefix}-SHARED-CASE`);
    await expect(page.locator(".profile-edit").getByText(`${prefix}-SHARED-FACT`, { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`${prefix}-PRIVATE-EVENT`))).toHaveCount(0);
    await page.getByRole("navigation", { name: "Person sections", exact: true }).getByRole("link", { name: "Access needs", exact: true }).click();
    await expect(page.locator(".needs-list").getByText(`${prefix}-SHARED-NEED`, { exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Reports", exact: true }).click();
    await expect(page.getByLabel("Saved drafts", { exact: true }).locator("option")).toHaveCount(1);
    await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(`${prefix} shared report`);
    await expect(page.getByLabel("Report visibility", { exact: true })).toBeDisabled();
    await personEditor(page);
  }
  await expect(viewerPage.locator(".protection-panel").getByRole("button", { name: "Add record", exact: true })).toBeDisabled();
  await expect(viewerPage.getByRole("button", { name: "Edit Court Record", exact: true })).toBeDisabled();
  const viewerDocument = await document(viewer, owner.libraryId);
  expect((await viewer.context.request.put(`/api/libraries/${owner.libraryId}`, { headers: clientHeaders, data: viewerDocument })).status()).toBe(403);

  await editorPage.getByRole("button", { name: "Edit Court Record", exact: true }).click();
  let dialog = editorPage.getByRole("dialog", { name: "Edit protection or government record", exact: true });
  await expect(dialog.getByLabel("Visibility", { exact: true }).locator('option[value="private"]')).toHaveCount(0);
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Reviewed by invited editor");
  await dialog.getByLabel("Notes", { exact: true }).fill("Shared evidence updated through the real form");
  await saveUI(editorPage, owner.libraryId, () => dialog.getByRole("button", { name: "Save record", exact: true }).click());
  await expect(dialog).toHaveCount(0);
  await saveUI(editorPage, owner.libraryId, () => editorPage.getByLabel("Given name", { exact: true }).fill(`${prefix} Edited June`));
  await editorPage.locator(".protection-panel").getByRole("button", { name: "Add record", exact: true }).click();
  dialog = editorPage.getByRole("dialog", { name: "Add protection or government record", exact: true });
  await dialog.getByLabel("Record type", { exact: true }).selectOption("Government Record");
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Created by invited editor");
  await expect(dialog.getByLabel("Visibility", { exact: true })).toHaveValue("shared");
  await saveUI(editorPage, owner.libraryId, () => dialog.getByRole("button", { name: "Save record", exact: true }).click());
  const stored = (await document(owner)).state;
  const original = state.people.find(row => row.id === personId)!;
  const updated = stored.people.find(row => row.id === personId)!;
  expect(updated.givenName).toBe(`${prefix} Edited June`);
  expect(updated.government).toEqual(original.government);
  expect(updated.accessNeeds).toEqual(original.accessNeeds);
  expect(updated.facts.find(row => row.id === "browser-private-fact")).toEqual(original.facts.find(row => row.id === "browser-private-fact"));
  expect(stored.protectionRecords?.find(row => row.id === privateRecordId)).toEqual(state.protectionRecords!.find(row => row.id === privateRecordId));
  expect(stored.protectionRecords?.find(row => row.id === sharedRecordId)?.status).toBe("Reviewed by invited editor");
  expect(stored.protectionRecords?.some(row => row.type === "Government Record" && row.visibility === "shared")).toBe(true);
  expect(stored.media.find(row => row.id === "browser-private-media")).toEqual(state.media.find(row => row.id === "browser-private-media"));
  expect(stored.reportDrafts.find(row => row.id === "browser-private-report")).toEqual(state.reportDrafts.find(row => row.id === "browser-private-report"));
  await refreshLibrary(ownerPage);
  await expect(ownerPage.getByLabel("Given name", { exact: true })).toHaveValue(`${prefix} Edited June`);
  await expect(ownerPage.getByLabel("Case number", { exact: true })).toHaveValue(`${prefix}-PRIVATE-CASE`);
  await refreshLibrary(viewerPage);
  await expect(viewerPage.locator(".protection-panel")).toContainText("Reviewed by invited editor");
  expect(failures).toEqual([]);
});

test("owner visibility changes remove formerly shared details after members refresh the same library", async ({ privacy }) => {
  const { owner, editor, viewer, prefix } = privacy;
  const ownerPage = await openLibrary(owner, owner);
  const editorPage = await openLibrary(editor, owner);
  const viewerPage = await openLibrary(viewer, owner);
  await personEditor(ownerPage, sharedPersonId);
  for (const page of [editorPage, viewerPage]) {
    await personEditor(page, sharedPersonId);
    await expect(page.getByLabel("Case number", { exact: true })).toHaveValue(`${prefix}-SHARED-CASE`);
    await expect(page.locator(".profile-edit").getByText(`${prefix}-SHARED-FACT`, { exact: true })).toBeVisible();
  }
  await saveUI(ownerPage, owner.libraryId, () => ownerPage.getByLabel("Sensitive detail visibility", { exact: true }).selectOption("private"));
  for (const page of [editorPage, viewerPage]) {
    await refreshLibrary(page);
    await expect(page.getByLabel("Case number", { exact: true })).toHaveCount(0);
    await expect(page.getByText(`${prefix}-SHARED-FACT`, { exact: true })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Person sections", exact: true }).getByRole("link", { name: "Access needs", exact: true }).click();
    await expect(page.getByText(`${prefix}-SHARED-NEED`, { exact: true })).toHaveCount(0);
    await personEditor(page);
    await expect(page.getByRole("button", { name: "Edit Court Record", exact: true })).toBeVisible();
  }
  await personEditor(ownerPage);
  await ownerPage.getByRole("button", { name: "Edit Court Record", exact: true }).click();
  const dialog = ownerPage.getByRole("dialog", { name: "Edit protection or government record", exact: true });
  await dialog.getByLabel("Visibility", { exact: true }).selectOption("private");
  await saveUI(ownerPage, owner.libraryId, () => dialog.getByRole("button", { name: "Save record", exact: true }).click());
  await saveUI(ownerPage, owner.libraryId, () => ownerPage.getByLabel("Visibility for Court Record", { exact: true }).selectOption("private"));
  for (const [account, page] of [[editor, editorPage], [viewer, viewerPage]] as const) {
    await refreshLibrary(page);
    await expect(page.locator(".protection-record")).toHaveCount(0);
    await expect(page.getByText(new RegExp(`${prefix}-SHARED-EVENT`))).toHaveCount(0);
    const loaded = (await document(account, owner.libraryId)).state;
    expect(loaded.protectionRecords).toEqual([]);
    expect(loaded.people.find(row => row.id === sharedPersonId)?.government.caseNumber).toBe("");
    expect(loaded.events.some(row => row.id === "browser-shared-event")).toBe(false);
  }
  const retained = (await document(owner)).state;
  expect(retained.protectionRecords?.find(row => row.id === sharedRecordId)?.notes).toBe(`${prefix}-SHARED-RECORD`);
  expect(retained.people.find(row => row.id === sharedPersonId)?.government.caseNumber).toBe(`${prefix}-SHARED-CASE`);
});

test("guest demo exposes no account data, including after sign-out on a device holding the owner cache", async ({ privacy }) => {
  const { owner, prefix, privateAsset, sharedAsset } = privacy;
  const page = await openLibrary(owner, owner);
  await personEditor(page);
  await expect(page.getByLabel("Case number", { exact: true })).toHaveValue(`${prefix}-PRIVATE-CASE`);
  const before = await document(owner);
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to KinForge", exact: true })).toBeVisible();
  const freshGuest = await privacy.context();
  const freshPage = await freshGuest.newPage();
  await freshPage.goto("/");
  for (const [context, guestPage] of [[owner.context, page], [freshGuest, freshPage]] as const) {
    await guestPage.getByRole("button", { name: "Continue as guest", exact: true }).click();
    await expect(guestPage.getByText("Demo - saved on this device", { exact: true })).toBeVisible();
    await expect(guestPage.locator("body")).not.toContainText(prefix);
    expect((await context.request.get(`/api/libraries/${owner.libraryId}`)).status()).toBe(401);
    for (const file of [privateAsset, sharedAsset]) expect((await context.request.get(`/api/libraries/${owner.libraryId}/assets/${file.hash}`)).status()).toBe(401);
    await personEditor(guestPage);
    await guestPage.getByLabel("Given name", { exact: true }).fill("Guest-only June");
    await expect.poll(() => guestPage.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).people.find((row: { id: string }) => row.id === "person_june").givenName)).toBe("Guest-only June");
    expect(await guestPage.evaluate(() => localStorage.getItem("kinforge-demo-v1"))).not.toContain(prefix);
    await guestPage.reload();
    await expect(guestPage.getByLabel("Given name", { exact: true })).toHaveValue("Guest-only June");
  }
  const verifyContext = await privacy.context();
  const signedIn = await verifyContext.request.post("/api/auth/login", { headers: clientHeaders, data: { email: owner.email, password } });
  expect(signedIn.status()).toBe(200);
  const after = await document({ ...owner, context: verifyContext });
  expect(after).toEqual(before);
});

test("owner tree deletion reaches a second owner device and stays deleted after that device saves", async ({ privacy }) => {
  const { owner, state, prefix } = privacy;
  const retainedTreeId = "browser-retained-tree";
  const retainedPersonId = "browser-retained-person";
  const current = await document(owner);
  current.state.trees.push({ ...state.trees[0], id: retainedTreeId, title: `${prefix} retained tree` });
  current.state.people.push({ ...createEmptyPerson(retainedTreeId), id: retainedPersonId, givenName: `${prefix} Retained`, familyName: "Person" });
  const seeded = await owner.context.request.put(`/api/libraries/${owner.libraryId}`, { headers: clientHeaders, data: { revision: current.revision, state: current.state } });
  expect(seeded.status(), await seeded.text()).toBe(200);
  const secondContext = await privacy.context();
  const loggedIn = await secondContext.request.post("/api/auth/login", { headers: clientHeaders, data: { email: owner.email, password } });
  expect(loggedIn.status()).toBe(200);
  const firstPage = await openLibrary(owner, owner);
  const secondPage = await openLibrary({ ...owner, context: secondContext }, owner);
  const failures = failedSaves(secondPage, owner.libraryId);
  for (const page of [firstPage, secondPage]) {
    await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Library", exact: true }).click();
    await expect(page.locator(".tree-library-entry")).toHaveCount(2);
  }
  const removedTitle = state.trees[0].title;
  await firstPage.locator(".tree-library-entry").filter({ hasText: removedTitle }).getByRole("button", { name: `Delete ${removedTitle}`, exact: true }).click();
  const dialog = firstPage.getByRole("dialog", { name: "Delete family tree?", exact: true });
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await dialog.getByLabel("Type the name to confirm", { exact: true }).fill(removedTitle);
  await saveUI(firstPage, owner.libraryId, () => dialog.getByRole("button", { name: "Delete", exact: true }).click());
  // Do not reload the second device: this assertion requires a live cross-device sync.
  await expect(secondPage.locator(".tree-library-entry").filter({ hasText: removedTitle })).toHaveCount(0, { timeout: 20000 });
  await expect(secondPage.locator(".tree-library-entry")).toHaveCount(1);
  await expect(secondPage.locator(".tree-library-entry")).toContainText(`${prefix} retained tree`);
  await synced(secondPage);
  await secondPage.locator(".tree-library-entry").getByRole("link").click();
  await personEditor(secondPage, retainedPersonId);
  await saveUI(secondPage, owner.libraryId, () => secondPage.getByLabel("Given name", { exact: true }).fill(`${prefix} Second device edit`));
  const stored = (await document(owner)).state;
  expect(stored.trees.map(row => row.id)).toEqual([retainedTreeId]);
  expect(stored.people.map(row => row.id)).toEqual([retainedPersonId]);
  expect(stored.people[0].givenName).toBe(`${prefix} Second device edit`);
  for (const rows of [stored.families, stored.relationships, stored.sources, stored.media, stored.reportDrafts, stored.protectionRecords ?? []]) expect(rows.some(row => row.treeId === treeId)).toBe(false);
  expect(stored.events.some(row => row.id === "browser-private-event")).toBe(false);
  await firstPage.locator(".tree-library-entry").getByRole("link").click();
  await personEditor(firstPage, retainedPersonId);
  await expect(firstPage.getByLabel("Given name", { exact: true })).toHaveValue(`${prefix} Second device edit`, { timeout: 20000 });
  await secondPage.reload();
  await synced(secondPage);
  await expect(secondPage.getByLabel("Given name", { exact: true })).toHaveValue(`${prefix} Second device edit`);
  expect((await document(owner)).state.trees.map(row => row.id)).toEqual([retainedTreeId]);
  expect(failures).toEqual([]);
});

test("rejected shared-editor deletion keeps its dirty draft and Undo available, then resumes syncing", async ({ privacy }) => {
  const { owner, editor, state, prefix } = privacy;
  const page = await openLibrary(editor, owner);
  const before = await document(owner);
  const rejected = page.waitForResponse(response => new URL(response.url()).pathname === `/api/libraries/${owner.libraryId}` && response.request().method() === "PUT");
  let writes = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === `/api/libraries/${owner.libraryId}` && request.method() === "PUT") writes++; });
  const name = state.trees[0].title;
  await page.locator(".topbar").getByRole("button", { name: `Delete ${name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete family tree?", exact: true });
  await dialog.getByLabel("Type the name to confirm", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  const response = await rejected;
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe("LIBRARY_PRIVACY_REVIEW");
  await expect(page.getByRole("button", { name: "Cloud sync: Changes need review", exact: true })).toBeVisible();
  await expect(page.locator(".cloud-notice")).toContainText("Only the library owner can delete this item");
  await expect(page.locator(".cloud-notice").getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in again", exact: true })).toHaveCount(0);
  await expect(page.locator(".cloud-readonly")).toHaveCount(0);
  const undo = page.getByRole("button", { name: "Undo item change", exact: true });
  await expect(undo).toBeEnabled();
  await expect(page.getByText("Create your first tree", { exact: true })).toBeVisible();
  const pendingDraft = () => page.evaluate(({ userId, libraryId }) => new Promise<{ dirty: boolean; draft: { trees: unknown[] } }>((resolve, reject) => {
    const opening = indexedDB.open("kinforge-cloud-cache-v1", 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction("libraries").objectStore("libraries").get(`${userId}:${libraryId}`);
      request.onsuccess = () => { resolve(request.result); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    };
  }), { userId: editor.id, libraryId: owner.libraryId });
  await expect.poll(async () => (await pendingDraft()).dirty).toBe(true);
  expect((await pendingDraft()).draft.trees).toEqual([]);
  expect(await document(owner)).toEqual(before);
  const rejectedWrites = writes;
  // Observe a full five-second automatic-sync interval without changing the draft.
  await page.waitForTimeout(5500);
  expect(writes).toBe(rejectedWrites);
  await expect(undo).toBeEnabled();
  await saveUI(page, owner.libraryId, () => undo.click());
  await expect(page.locator(".cloud-notice")).toHaveCount(0);
  await expect.poll(async () => (await pendingDraft()).dirty).toBe(false);
  await personEditor(page);
  await saveUI(page, owner.libraryId, () => page.getByLabel("Given name", { exact: true }).fill(`${prefix} Recovered edit`));
  const after = (await document(owner)).state;
  expect(after.trees.map(row => row.id)).toEqual([treeId]);
  expect(after.people.find(row => row.id === personId)?.givenName).toBe(`${prefix} Recovered edit`);
  expect(after.people.find(row => row.id === personId)?.government).toEqual(state.people.find(row => row.id === personId)?.government);
  expect(after.protectionRecords?.find(row => row.id === privateRecordId)).toEqual(state.protectionRecords!.find(row => row.id === privateRecordId));
});

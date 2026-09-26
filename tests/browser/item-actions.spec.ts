import { expect, test, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createEmptyPerson, createSeedState } from "../../src/domain";
import { DELETABLE_RECORDS, deletionEntries } from "../../src/deletion";
import { createProtectionRecord } from "../../src/protection";

function fixture() {
  const state = createSeedState();
  state.people[0].facts.push({ id: "fact-test", type: "Height", value: "165 cm", sourceIds: [] });
  state.people[0].accessNeeds = [{ id: "access-test", glyphId: "need-blind", label: "Blind", detail: "Screen reader", private: true }];
  state.media[0].dataUrl = "data:application/pdf;base64,JVBERi0xLjcK"; state.media[0].title = "Stored document";
  state.reportDrafts.push({ id: "report-test", treeId: "tree_demo", type: "Person Report", title: "Test report", body: "Preserve this report", updatedAt: "2026-01-01" });
  state.customEventTypes = ["Custom occasion"]; state.customFactTypes = ["Favourite book"]; state.customFamilyTypes = ["My household"]; state.customRelationshipSubtypes = ["Mentor"];
  state.protectionRecords = [
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "person", entityId: "person_alex" }), id: "protection-person", type: "Custody Removal", notes: "Supplied demo record", sourceIds: [state.sources[0].id], mediaIds: [state.media[0].id] },
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "family", entityId: state.families[0].id }, false), id: "protection-family", type: "Care Arrangement" },
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "relationship", entityId: "rel_alex_june" }), id: "protection-relationship", type: "Custody Change" }
  ];
  return state;
}
const readState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!));
async function guest(page: Page, state = fixture()) {
  await page.goto("/"); await page.evaluate(value => localStorage.setItem("kinforge-demo-v1", JSON.stringify(value)), state);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Saved items", exact: true })).toBeVisible();
}
test("tree download, cancel, typed confirmation, undo and last-tree recovery", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await guest(page);
  const name = "Chang-Tan working tree";
  const download = page.waitForEvent("download"); await page.locator(".topbar").getByRole("button", { name: `Download ${name}`, exact: true }).click();
  const file = await download; const contents = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(contents.state.trees).toHaveLength(1); expect(contents.state.people).toHaveLength(4);
  expect(contents.state.protectionRecords).toHaveLength(3);
  await page.locator(".topbar").getByRole("button", { name: `Delete ${name}`, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Delete family tree?", exact: true });
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readState(page)).trees).toHaveLength(1);
  await page.locator(".topbar").getByRole("button", { name: `Delete ${name}`, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Delete family tree?", exact: true });
  await dialog.getByLabel("Type the name to confirm").fill(name);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Create your first tree", { exact: true })).toBeVisible();
  expect((await readState(page)).people).toHaveLength(0);
  expect((await readState(page)).protectionRecords).toHaveLength(0);
  await page.getByRole("button", { name: "Undo item change" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  expect((await readState(page)).reportDrafts).toHaveLength(1);
  expect((await readState(page)).protectionRecords).toHaveLength(3);
  await page.getByRole("button", { name: "Redo item change" }).click(); await page.reload();
  await expect(page.getByText("Create your first tree", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manage Trees, Books, Collections" })).toBeVisible();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(page.getByText("Add first person", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("every saved-item category downloads and deletes through working controls", async ({ page }) => {
  test.setTimeout(120000);
  const state = fixture(); await guest(page, state);
  for (const kind of Object.keys(DELETABLE_RECORDS) as (keyof typeof DELETABLE_RECORDS)[]) {
    await page.evaluate(value => localStorage.setItem("kinforge-demo-v1", JSON.stringify(value)), state); await page.reload();
    await page.getByRole("button", { name: "Saved items", exact: true }).click();
    const manager = page.getByRole("dialog", { name: "Saved items", exact: true });
    await manager.getByLabel("Item type", { exact: true }).selectOption(kind);
    const entry = deletionEntries(state, kind, "tree_demo")[0]; expect(entry, kind).toBeDefined();
    const row = manager.locator(".saved-item-row").filter({ hasText: entry.title }).first();
    const download = page.waitForEvent("download"); await row.getByRole("button", { name: `Download ${entry.title}`, exact: true }).click();
    const file = await download; const bytes = await readFile((await file.path())!); expect(bytes.length, kind).toBeGreaterThan(0);
    if (kind === "media") expect(bytes.toString()).toBe("%PDF-1.7\n"); else expect(() => JSON.parse(bytes.toString()), kind).not.toThrow();
    if (kind === "protectionRecords") {
      const saved = JSON.parse(bytes.toString());
      expect(saved.kind).toBe("protectionRecords"); expect(saved.data.notes).toBe("Supplied demo record");
      expect(saved.related.sources.map((source: { id: string }) => source.id)).toEqual([state.sources[0].id]);
      expect(saved.related.media.map((media: { id: string }) => media.id)).toEqual([state.media[0].id]);
    }
    await row.getByRole("button", { name: `Delete ${entry.title}`, exact: true }).click();
    const confirm = page.getByRole("dialog", { name: `Delete ${DELETABLE_RECORDS[kind].toLowerCase()}?`, exact: true });
    if (["books", "collections", "trees"].includes(kind)) await confirm.getByLabel("Type the name to confirm").fill(entry.title);
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(confirm).toHaveCount(0);
    const after = await readState(page);
    expect(deletionEntries(after, kind).some(e => e.target.id === entry.target.id && e.target.ownerId === entry.target.ownerId), kind).toBe(false);
    if (kind === "protectionRecords") { expect(after.people).toHaveLength(state.people.length); expect(after.sources).toHaveLength(state.sources.length); expect(after.media).toHaveLength(state.media.length); }
    await manager.getByRole("button", { name: "Close saved items" }).click();
  }
});

test("deleting a nested collection keeps the other tree and its records", async ({ page }) => {
  const state = fixture(); state.collections.push({ id: "child", name: "Child collection", bookId: state.books[0].id, parentId: state.collections[0].id });
  state.trees[0].collectionId = "child";
  state.books.push({ id: "other-book", title: "Keep book", description: "" });
  state.trees.push({ ...state.trees[0], id: "keep-tree", title: "Keep tree", bookId: "other-book", collectionId: undefined });
  state.people.push({ ...createEmptyPerson("keep-tree"), id: "keep-person", givenName: "Keep" });
  state.protectionRecords!.push({ ...createProtectionRecord({ treeId: "keep-tree", entityKind: "person", entityId: "keep-person" }), id: "protection-keep", type: "Government Record" });
  await guest(page, state); await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await page.getByRole("button", { name: `Delete ${state.collections[0].name}`, exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete collection?", exact: true });
  await expect(confirm).toContainText("4 collection records");
  await confirm.getByLabel("Type the name to confirm").fill(state.collections[0].name);
  await confirm.getByRole("button", { name: "Delete", exact: true }).click(); await page.reload();
  const after = await readState(page); expect(after.trees.map((t: { id: string }) => t.id)).toEqual(["keep-tree"]); expect(after.people.map((p: { id: string }) => p.id)).toEqual(["keep-person"]);
  expect(after.protectionRecords.map((record: { id: string }) => record.id)).toEqual(["protection-keep"]);
});

test("relationship deletion resyncs family children and removes only its protection records", async ({ page }) => {
  const state = fixture(); state.relationships = state.relationships.filter(relationship => relationship.id !== "rel_mei_june");
  await guest(page, state); await page.getByRole("button", { name: "Saved items", exact: true }).click();
  const manager = page.getByRole("dialog", { name: "Saved items", exact: true });
  await manager.getByLabel("Item type", { exact: true }).selectOption("relationships");
  const entry = deletionEntries(state, "relationships", "tree_demo").find(entry => entry.target.id === "rel_alex_june")!;
  await manager.getByRole("button", { name: `Delete ${entry.title}`, exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete relationship?", exact: true });
  await expect(confirm).toContainText("1 protection or government record");
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  const after = await readState(page);
  expect(after.families).toHaveLength(1); expect(after.families[0].childIds).toEqual([]);
  expect(after.people).toHaveLength(4);
  expect(after.protectionRecords.map((record: { id: string }) => record.id)).toEqual(["protection-person", "protection-family"]);
});

test("phone saved-items and confirmation dialogs stay usable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await guest(page);
  await page.getByRole("button", { name: "Saved items", exact: true }).click();
  const manager = page.getByRole("dialog", { name: "Saved items", exact: true });
  await expect(manager).toBeVisible(); expect(await manager.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await manager.getByRole("button", { name: "Delete Chang-Tan working tree", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete family tree?", exact: true });
  expect(await confirm.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: "verification/item-delete-mobile.png" });
  await page.keyboard.press("Escape"); await expect(confirm).toHaveCount(0); await expect(manager).toBeVisible();
  await page.keyboard.press("Escape"); await expect(manager).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

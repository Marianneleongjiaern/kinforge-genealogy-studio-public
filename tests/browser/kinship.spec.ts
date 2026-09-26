import { expect, Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createEmptyPerson, createSeedState } from "../../src/domain";
import { linkPeople } from "../../src/treeGraph";

test.setTimeout(60000);
const storageKey = "kinforge-demo-v1";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
}

async function showMore(page: Page) {
  const button = page.getByRole("button", { name: "Show more", exact: true });
  if (await button.isVisible()) await button.click();
}

async function addGeneration(page: Page, direction: "parent" | "child", name: string) {
  await showMore(page);
  await page.getByRole("button", { name: `Add ${direction}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Relationship", { exact: true })).toHaveValue(direction);
  await dialog.getByLabel("Given name", { exact: true }).fill(name);
  if (direction === "parent") await dialog.getByLabel("New parent's role", { exact: true }).selectOption("mother");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${name} Chang`, exact: true })).toBeVisible();
  return page.evaluate(({ storageKey, name }) => JSON.parse(localStorage.getItem(storageKey)!).people.find((person: { givenName: string }) => person.givenName === name).id as string, { storageKey, name });
}

test("adds earlier and later generations after descendants exist; parent roles survive undo, redo and reload", async ({ page }, testInfo) => {
  await start(page);
  await page.locator('.react-flow__node[data-id="person_kai"]').click();
  const child = await addGeneration(page, "child", "Later");
  const grandchild = await addGeneration(page, "child", "Latest");
  await page.locator('.react-flow__node[data-id="person_alex"]').click();
  const grandparent = await addGeneration(page, "parent", "Earlier");
  const greatGrandparent = await addGeneration(page, "parent", "Earliest");
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
  const order = [greatGrandparent, grandparent, "person_alex", "person_june", "person_kai", child, grandchild];
  const verify = async () => {
    const nodes = await page.locator(".react-flow__node").evaluateAll(items => Object.fromEntries(items.map(item => [(item as HTMLElement).dataset.id, { y: new DOMMatrix((item as HTMLElement).style.transform).m42, height: (item as HTMLElement).offsetHeight }])));
    for (let i = 1; i < order.length; i++) expect(nodes[order[i]].y).toBeGreaterThan(nodes[order[i - 1]].y + nodes[order[i - 1]].height);
  };
  await expect(verify).toPass();
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  const role = page.getByLabel("Parent role for Alex Chang", { exact: true });
  await role.selectOption("parent");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(role).toHaveValue("father");
  await page.getByRole("button", { name: "Redo last change", exact: true }).click();
  await expect(role).toHaveValue("parent");
  await role.selectOption("father");
  await page.reload();
  await showMore(page);
  await expect(page.getByLabel("Parent role for Alex Chang", { exact: true })).toHaveValue("father");
  await expect(page.getByLabel("Parent role for Mei Tan", { exact: true })).toHaveValue("mother");
  await expect(verify).toPass();
  await page.screenshot({ path: testInfo.outputPath("generation-controls-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Add parent", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("New parent's role", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("generation-controls-mobile.png") });
});

test("links an existing parent later and keeps newly created people visible in filtered views", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("unrelated");
  await dialog.getByLabel("Given name", { exact: true }).fill("ExistingParent");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  const existingParent = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!).people.find((p: { givenName: string }) => p.givenName === "ExistingParent").id as string, storageKey);
  await page.locator('.react-flow__node[data-id="person_kai"]').click();
  await showMore(page);
  await page.getByRole("button", { name: "Add parent", exact: true }).click();
  await dialog.getByRole("button", { name: "Existing person", exact: true }).click();
  await dialog.getByLabel("Existing person", { exact: true }).selectOption(existingParent);
  await dialog.getByLabel("New parent's role", { exact: true }).selectOption("mother");
  await dialog.getByRole("button", { name: "Link relative", exact: true }).click();
  await showMore(page);
  await expect(page.getByLabel("Parent role for ExistingParent Chang", { exact: true })).toHaveValue("mother");
  await page.getByRole("button", { name: "Genealogy", exact: true }).click();
  const child = await addGeneration(page, "child", "FilteredChild");
  await expect(page.locator(`.react-flow__node[data-id="${child}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Descendants", exact: true }).click();
  const parent = await addGeneration(page, "parent", "FilteredParent");
  await expect(page.locator(`.react-flow__node[data-id="${parent}"]`)).toBeVisible();
});

test("generates cousin removal reports with both directions, private names and complete exports", async ({ page }, testInfo) => {
  await page.goto("/");
  const state = createSeedState(), treeId = state.trees[0].id;
  state.people = []; state.relationships = []; state.families = [];
  const add = (id: string) => state.people.push({ ...createEmptyPerson(treeId), id, givenName: id, familyName: "Example", private: false });
  add("SharedAncestor");
  for (const [prefix, count, role] of [["A", 3, "mother"], ["B", 6, "father"]] as const) {
    let parent = "SharedAncestor";
    for (let i = 1; i <= count; i++) { const id = `${prefix}${i}`; add(id); linkPeople(state, treeId, "parent-child", parent, id, i === count ? role : "parent"); parent = id; }
  }
  await page.evaluate(({ storageKey, state }) => localStorage.setItem(storageKey, JSON.stringify(state)), { storageKey, state });
  await page.reload();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report type", { exact: true }).selectOption("Kinship Report");
  await page.getByLabel("Reference person", { exact: true }).selectOption("A3");
  await page.getByLabel("Compare with", { exact: true }).selectOption("B6");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  const draft = page.getByLabel("Report draft", { exact: true });
  await expect(draft).toContainText(/2nd cousin, three times removed/);
  const body = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!).reportDrafts.at(-1).body as string, storageKey);
  expect(body).toContain("Family side: Maternal");
  expect(body).toContain("Maternal means this connection starts with A3 Example's mother, A2 Example.");
  expect(body).toContain("Why 2nd cousin: SharedAncestor Example is a great-grandparent of both A3 Example and B3 Example.");
  expect(body).toContain("Generation distances: reference 3; relative 6.");
  expect(body).toContain("3 generation(s) further from");
  expect(body).toContain("HOW TO READ THIS REPORT");
  expect(body).toContain("Thrice removed (three times removed) = 3 generations apart");
  expect(body).toContain("B3 Example is A3 Example's 2nd cousin. B6 Example is B3 Example's great-grandchild.");
  await page.emulateMedia({ media: "print" });
  await expect(draft).toBeVisible();
  await expect(page.locator(".report-toolbar")).toBeHidden();
  await expect(draft).toContainText("HOW TO READ THIS REPORT");
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: testInfo.outputPath("kinship-report-desktop.png"), fullPage: true });
  await draft.locator("blockquote").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("named-kinship-explanation-desktop.png") });
  for (const format of ["Text", "RTF", "CSV", "PDF"]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const download = await downloading;
    await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
    const content = await readFile((await download.path())!, "utf8");
    if (format !== "PDF") {
      expect(content).toContain("HOW TO READ THIS REPORT");
      expect(content).toContain("2nd cousin, three times removed");
      expect(content).toContain("Family side: Maternal");
      expect(content).toContain("Maternal means this connection starts with A3 Example's mother, A2 Example.");
      expect(content).toContain("Why 2nd cousin: SharedAncestor Example is a great-grandparent of both A3 Example and B3 Example.");
    }
    if (format === "Text") expect(content).toBe(body);
    if (format === "PDF") expect(content.startsWith("%PDF-")).toBe(true);
  }
  await page.getByLabel("Reference person", { exact: true }).selectOption("B6");
  await page.getByLabel("Compare with", { exact: true }).selectOption("A3");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft).toContainText("Family side: Paternal");
  await expect(draft).toContainText("Paternal means this connection starts with B6 Example's father, B5 Example.");
  await expect(draft).toContainText("Why 2nd cousin: SharedAncestor Example is a great-grandparent of both B3 Example and A3 Example.");
  await expect(draft).toContainText("3 generation(s) closer to");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await draft.locator("blockquote").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("kinship-report-mobile.png"), fullPage: true });
  await page.evaluate(storageKey => { const state = JSON.parse(localStorage.getItem(storageKey)!); state.people.find((p: { id: string }) => p.id === "SharedAncestor").private = true; localStorage.setItem(storageKey, JSON.stringify(state)); }, storageKey);
  await page.reload();
  await page.getByLabel("Report type", { exact: true }).selectOption("Kinship Report");
  await page.getByLabel("Compare with", { exact: true }).selectOption("A3");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft).not.toContainText("SharedAncestor");
  await expect(draft).toContainText("[Private person]");
  await page.getByLabel("Include private people and annotations", { exact: true }).check();
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft).toContainText("SharedAncestor Example");
});

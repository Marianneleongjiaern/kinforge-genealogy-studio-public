import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm, realpath, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const executablePath = process.argv[2];
if (!executablePath) throw new Error("Pass the packaged application's executable path.");
const data = await mkdtemp(join(tmpdir(), "kinforge-native-test-"));
const expectedVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
let app;
try {
  app = await electron.launch({ executablePath: resolve(executablePath), args: [`--user-data-dir=${data}`], timeout: 90000 });
  const identity = await app.evaluate(({ app }) => ({ version: app.getVersion(), userData: app.getPath("userData") }));
  expect(await realpath(identity.userData)).toBe(await realpath(data));
  expect(identity.version).toBe(expectedVersion);
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  const book = page.getByRole("group", { name: "Book: KinForge Research Book", exact: true });
  await book.getByRole("button", { name: "Add collection to KinForge Research Book", exact: true }).click();
  await book.getByRole("button", { name: "Add collection to KinForge Research Book", exact: true }).click();
  await book.getByLabel("Collection name for New collection", { exact: true }).fill("Native collection");
  await book.getByLabel("Collection name for New collection 2", { exact: true }).fill("Another collection");
  const collection = book.getByRole("group", { name: "Collection: Native collection", exact: true });
  await collection.getByRole("button", { name: "Add subcollection to Native collection", exact: true }).click();
  await collection.getByRole("button", { name: "Add subcollection to Native collection", exact: true }).click();
  await collection.getByLabel("Subcollection name for New subcollection", { exact: true }).fill("Native subcollection");
  await collection.getByRole("button", { name: "Collapse Native collection", exact: true }).click();
  await expect(collection.getByLabel("Subcollection name for Native subcollection", { exact: true })).toBeHidden();
  await collection.getByRole("button", { name: "Expand Native collection", exact: true }).press("Enter");
  await expect(collection.getByLabel("Subcollection name for Native subcollection", { exact: true })).toBeVisible();
  await page.reload();
  await expect(collection.getByLabel("Subcollection name for Native subcollection", { exact: true })).toHaveValue("Native subcollection");
  await page.screenshot({ path: `verification/native-library-${expectedVersion}.png`, fullPage: true });
  await page.getByRole("link", { name: "Family Tree", exact: true }).click();
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Timeline", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Life timeline" })).toBeVisible();
  await page.getByRole("link", { name: "View in tree" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.getByRole("link", { name: "Research", exact: true }).click();
  await page.getByLabel("Search this tree").fill("Junie");
  await expect(page.locator(".archive-result")).toContainText("June Chang");
  await page.getByRole("link", { name: "Feature Coverage", exact: true }).click();
  await page.getByLabel("Search requirements").fill("cerebral palsy");
  await expect(page.locator(".requirement-passage").first()).toBeVisible();
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key));
    state.people[0].notes = "Native review token";
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await page.getByLabel("Find text", { exact: true }).fill("review token");
  await page.getByLabel("Replace with", { exact: true }).fill("verified change");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.locator(".maintenance-preview table")).toContainText("Native verified change");
  const readNote = () => page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")).people[0].notes);
  expect(await readNote()).toBe("Native review token");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect.poll(readNote).toBe("Native verified change");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect.poll(readNote).toBe("Native review token");
  await page.getByRole("button", { name: "Redo last change", exact: true }).click();
  await expect.poll(readNote).toBe("Native verified change");
  await page.reload();
  expect(await readNote()).toBe("Native verified change");
  await page.getByRole("link", { name: "Family Tree", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  const addRelative = async (id, kind, name, otherParentId) => {
    await page.locator(`.react-flow__node[data-id="${id}"]`).click();
    await page.getByRole("button", { name: "Add relative", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Relationship", { exact: true }).selectOption(kind);
    if (otherParentId) await dialog.getByLabel("Other parent", { exact: true }).selectOption(otherParentId);
    await dialog.getByLabel("Given name", { exact: true }).fill(name);
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(page.locator(".react-flow__node").filter({ hasText: name })).toBeVisible();
    return page.evaluate(given => JSON.parse(localStorage.getItem("kinforge-demo-v1")).people.find(person => person.givenName === given).id, name);
  };
  const robin = await addRelative("person_june", "sibling", "Robin");
  const sam = await addRelative(robin, "child", "Sam");
  const taylor = await addRelative("person_june", "spouse", "Taylor");
  const lee = await addRelative("person_june", "child", "Lee", taylor);
  const lou = await addRelative("person_june", "child", "Lou", taylor);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(9);
  const positions = await page.locator(".react-flow__node").evaluateAll(elements => Object.fromEntries(elements.map(element => {
    const transform = new DOMMatrix(element.style.transform);
    return [element.dataset.id, { x: transform.m41, y: transform.m42, width: element.offsetWidth, height: element.offsetHeight }];
  })));
  expect(positions[robin].y).toBe(positions.person_june.y);
  expect(positions[robin].x).toBeGreaterThan(positions.person_june.x);
  expect(positions[sam].y).toBeGreaterThan(positions[robin].y);
  expect(positions[sam].y).toBe(positions.person_kai.y);
  expect(positions[taylor].x - positions.person_june.x).toBeGreaterThanOrEqual(272);
  expect(positions[taylor].x).toBeLessThan(positions[robin].x);
  await expect(page.getByRole("region", { name: "Legend", exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__edge-text")).toHaveCount(0);
  await expect(page.locator(`.family-connection[data-children*="${lee}"]`)).toHaveCount(1);
  const branch = await page.locator(".family-connection").evaluateAll((elements, id) => {
    const line = elements.find(element => JSON.parse(element.getAttribute("data-children")).includes(id));
    return { parents: JSON.parse(line.getAttribute("data-parents")), junction: JSON.parse(line.getAttribute("data-junction")), fork: JSON.parse(line.getAttribute("data-fork")) };
  }, lee);
  expect(branch.parents.sort()).toEqual(["person_june", taylor].sort());
  expect(branch.junction).toEqual({ x: (positions.person_june.x + positions[taylor].x + positions.person_june.width) / 2, y: positions.person_june.y + positions.person_june.height / 2 });
  expect(branch.fork.x).toBe((positions[lee].x + positions[lou].x + positions[lee].width) / 2);
  expect(branch.fork.x).toBeCloseTo(branch.junction.x, 5);
  await expect(page.locator('.react-flow__node[data-id="person_june"] .graph-person-relationships')).toContainText("Spouse");
  const networkBlocked = await app.evaluate(async ({ session }) => {
    try { await session.defaultSession.fetch("https://service.example.invalid/kinforge-test"); return false; }
    catch (error) { return String(error).includes("ERR_BLOCKED_BY_CLIENT"); }
  });
  expect(networkBlocked).toBe(true);
  await page.screenshot({ path: process.env.KINFORGE_NATIVE_SCREENSHOT || `verification/native-mac-${expectedVersion}.png` });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ passed: true, version: identity.version, executablePath, url: page.url(), nodes: await page.locator(".react-flow__node").count(), siblingsBesideAndDescendantsBelow: "passed", coupleJunctionsAndLegend: "passed", centredChildBranches: "passed", maintenancePreviewApplyUndoRedoReload: "passed", networkBlocked, errors }));
} finally {
  if (app) {
    const stop = setTimeout(() => app.process().kill("SIGKILL"), 5000);
    try { await app.close(); } finally { clearTimeout(stop); }
  }
  await rm(data, { recursive: true, force: true });
}

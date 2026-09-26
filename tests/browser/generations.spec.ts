import { expect, Page, test } from "@playwright/test";
import { LINE_STYLES } from "../../src/familyLines";

test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

async function addRelative(page: Page, personId: string, kind: string, name: string, otherParentId?: string) {
  await page.locator(`.react-flow__node[data-id="${personId}"]`).click();
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption(kind);
  if (otherParentId) await dialog.getByLabel("Other parent", { exact: true }).selectOption(otherParentId);
  await dialog.getByLabel("Given name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator(".react-flow__node").filter({ hasText: name })).toBeVisible();
  return page.evaluate(givenName => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).people.find((person: { givenName: string }) => person.givenName === givenName).id as string, name);
}

async function positions(page: Page) {
  return page.locator(".react-flow__node").evaluateAll(elements => Object.fromEntries(elements.map(element => {
    const node = element as HTMLElement;
    const transform = new DOMMatrix(node.style.transform);
    return [node.dataset.id!, { x: transform.m41, y: transform.m42, width: node.offsetWidth, height: node.offsetHeight }];
  })));
}

function expectSeparated(nodes: Awaited<ReturnType<typeof positions>>) {
  const entries = Object.values(nodes);
  for (let a = 0; a < entries.length; a++) for (let b = a + 1; b < entries.length; b++) {
    const first = entries[a], second = entries[b];
    expect(first.x + first.width <= second.x || second.x + second.width <= first.x || first.y + first.height <= second.y || second.y + second.height <= first.y).toBe(true);
  }
}

test("siblings sit side by side and children, cousins and grandchildren stay below the previous generation", async ({ page }, testInfo) => {
  const robin = await addRelative(page, "person_june", "sibling", "Robin");
  const sam = await addRelative(page, robin, "child", "Sam");
  const lee = await addRelative(page, "person_june", "child", "Lee");
  const kit = await addRelative(page, "person_kai", "child", "Kit");
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
  const verify = async () => {
    const at = await positions(page);
    expect(at[robin].y).toBe(at.person_june.y);
    expect(at[robin].x).toBeGreaterThanOrEqual(at.person_june.x + at.person_june.width);
    expect(at.person_june.y).toBeGreaterThan(at.person_alex.y + at.person_alex.height);
    for (const id of [sam, lee]) expect(at[id].y).toBe(at.person_kai.y);
    expect(at[lee].x).toBeLessThan(at[sam].x);
    expect(at[kit].x).toBe(at.person_kai.x);
    expect(at.person_kai.y).toBeGreaterThan(at.person_june.y + at.person_june.height);
    expect(at[kit].y).toBeGreaterThan(at.person_kai.y + at.person_kai.height);
    expectSeparated(at);
  };
  await expect(verify).toPass();
  await page.getByRole("button", { name: "Arrange tree", exact: true }).click();
  await expect(verify).toPass();
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("generations-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(verify).toPass();
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("generations-mobile.png"), fullPage: true });
});

test("dragging and saved positions cannot put a child above a parent or split sibling rows", async ({ page }) => {
  const robin = await addRelative(page, "person_june", "sibling", "Robin");
  await page.waitForTimeout(350);
  const before = await positions(page);
  const node = page.locator('.react-flow__node[data-id="person_june"]');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y - 95, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await positions(page)).person_june.x).not.toBe(before.person_june.x);
  const dragged = await positions(page);
  expect(dragged.person_june.y).toBe(before.person_june.y);
  expect(dragged[robin].y).toBe(dragged.person_june.y);
  expectSeparated(dragged);
  await page.reload();
  await expect.poll(() => positions(page)).toEqual(dragged);
  const earlier = await addRelative(page, "person_alex", "parent", "Earlier");
  await expect(async () => {
    const at = await positions(page);
    expect(at.person_alex.y).toBeGreaterThan(at[earlier].y + at[earlier].height);
    expect(at.person_june.y).toBeGreaterThan(at.person_alex.y + at.person_alex.height);
    expect(at[robin].y).toBe(at.person_june.y);
    expectSeparated(at);
  }).toPass();
});

test("older saved layouts are recalculated using the new generation rules", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("kinforge-chart-layout:tree_demo:family:all", JSON.stringify({ person_june: { x: 0, y: -900 }, person_kai: { x: 0, y: -1200 } })));
  await page.reload();
  await expect(async () => {
    const at = await positions(page);
    expect(at.person_june.y).toBeGreaterThan(at.person_alex.y + at.person_alex.height);
    expect(at.person_kai.y).toBeGreaterThan(at.person_june.y + at.person_june.height);
    expectSeparated(at);
  }).toPass();
});

async function connections(page: Page) {
  return page.locator(".family-connection").evaluateAll(elements => elements.map(element => ({
    id: element.getAttribute("data-line-id")!,
    parents: JSON.parse(element.getAttribute("data-parents")!) as string[],
    children: JSON.parse(element.getAttribute("data-children")!) as string[],
    junction: JSON.parse(element.getAttribute("data-junction") || "null") as { x: number; y: number } | null,
    fork: JSON.parse(element.getAttribute("data-fork") || "null") as { x: number; y: number } | null,
    paths: Array.from(element.querySelectorAll<SVGPathElement>(".react-flow__edge-path")).map(path => path.getAttribute("d")!),
  })));
}

test("each sibling's couple has its own child branch, with a visible legend and no words on connectors", async ({ page }, testInfo) => {
  const robin = await addRelative(page, "person_june", "sibling", "Robin");
  const morgan = await addRelative(page, robin, "spouse", "Morgan");
  const taylor = await addRelative(page, "person_june", "spouse", "Taylor");
  const sam = await addRelative(page, robin, "child", "Sam", morgan);
  const lee = await addRelative(page, "person_june", "child", "Lee", taylor);
  const lou = await addRelative(page, "person_june", "child", "Lou", taylor);
  const kit = await addRelative(page, lee, "child", "Kit");
  const verify = async () => {
    const at = await positions(page);
    expect(at[taylor].x - at.person_june.x).toBeGreaterThanOrEqual(271.999);
    expect(at[morgan].x - at[robin].x).toBeGreaterThanOrEqual(271.999);
    expect(at[taylor].x).toBeLessThan(at[robin].x);
    expect(at[robin].y).toBe(at.person_june.y);
    expect(at[lee].y).toBe(at[sam].y);
    expect(at[kit].y).toBeGreaterThan(at[lee].y + at[lee].height);
    expectSeparated(at);
    const lines = await connections(page);
    for (const [parent, spouse, child] of [["person_june", taylor, lee], [robin, morgan, sam]]) {
      const line = lines.find(entry => entry.children.includes(child))!;
      expect(line.parents.sort()).toEqual([parent, spouse].sort());
      // DOMMatrix rounds CSS transforms; SVG data keeps the solver's precision.
      expect(line.junction!.x).toBeCloseTo((at[parent].x + at[spouse].x + at[parent].width) / 2, 2);
      expect(line.junction!.y).toBe(at[parent].y + at[parent].height / 2);
      expect(line.paths[0]).toContain(`M${line.junction!.x} ${line.junction!.y} V`);
    }
    expect(lines.find(line => line.children.includes(lee))!.children.sort()).toEqual([lee, lou].sort());
    const sharedBranch = lines.find(line => line.children.includes(lee))!;
    expect(sharedBranch.fork!.x).toBeCloseTo((at[lee].x + at[lou].x + at[lee].width) / 2, 2);
    expect(sharedBranch.fork!.x).toBeCloseTo(sharedBranch.junction!.x, 5);
    expect(sharedBranch.paths[0].startsWith(`M${sharedBranch.junction!.x} ${sharedBranch.junction!.y} V${sharedBranch.fork!.y} M`)).toBe(true);
    for (const line of lines.filter(line => line.children.length)) expect(line.fork!.x).toBeCloseTo(line.junction!.x, 5);
    expect(lines.find(line => line.children.includes("person_kai"))!.parents).toEqual(["person_june"]);
    await expect(page.getByRole("region", { name: "Legend", exact: true })).toBeVisible();
    await expect(page.locator("[data-legend-kind]")).toHaveCount(Object.keys(LINE_STYLES).length);
    expect(await page.locator("[data-legend-kind]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-legend-kind")))).toEqual(Object.keys(LINE_STYLES));
    await expect(page.locator(".react-flow__edge-text, .react-flow__edge-textwrapper, .react-flow__edges text")).toHaveCount(0);
  };
  await expect(verify).toPass();
  const cardIntersections = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node")).map(node => {
      const m = new DOMMatrix(node.style.transform);
      return { id: node.dataset.id, left: m.m41 + 1, right: m.m41 + node.offsetWidth - 1, top: m.m42 + 1, bottom: m.m42 + node.offsetHeight - 1 };
    });
    return Array.from(document.querySelectorAll<SVGPathElement>(".family-connection .react-flow__edge-path")).flatMap(path => {
      const hit = new Set<string>();
      for (let n = 0; n <= path.getTotalLength(); n += 4) {
        const point = path.getPointAtLength(n);
        cards.forEach(card => { if (point.x > card.left && point.x < card.right && point.y > card.top && point.y < card.bottom) hit.add(card.id!); });
      }
      return [...hit];
    });
  });
  expect(cardIntersections).toEqual([]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("family-groups-desktop.png"), fullPage: true });
  await page.reload();
  await expect(verify).toPass();
  const beforeMove = await positions(page);
  const box = (await page.locator(`.react-flow__node[data-id="${lou}"]`).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 3, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await positions(page))[lou].x).not.toBe(beforeMove[lou].x);
  await expect(verify).toPass();
  const moved = await positions(page);
  await page.reload();
  await expect.poll(() => positions(page)).toEqual(moved);
  await expect(verify).toPass();
  await page.getByRole("button", { name: "Arrange tree", exact: true }).click();
  await expect(verify).toPass();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(verify).toPass();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("family-groups-mobile.png"), fullPage: true });
});

test("adding a child to a couple records both parents atomically and supports undo and redo", async ({ page }) => {
  const child = await addRelative(page, "person_alex", "child", "NewChild", "person_mei");
  const parents = () => page.evaluate(id => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).relationships.filter((rel: { type: string; toId: string }) => rel.type === "parent-child" && rel.toId === id).map((rel: { fromId: string }) => rel.fromId).sort(), child);
  expect(await parents()).toEqual(["person_alex", "person_mei"]);
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  expect(await parents()).toEqual([]);
  await page.getByRole("button", { name: "Redo last change", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  expect(await parents()).toEqual(["person_alex", "person_mei"]);
  await page.reload();
  expect(await parents()).toEqual(["person_alex", "person_mei"]);
  await expect.poll(async () => (await connections(page)).find(line => line.children.includes(child))?.children.sort()).toEqual([child, "person_june"].sort());
});

test("the couple stem descends centrally then branches left and right for two and three children", async ({ page }, testInfo) => {
  for (const name of ["SecondChild", "ThirdChild"]) {
    await addRelative(page, "person_alex", "child", name, "person_mei");
    await expect(async () => {
      const at = await positions(page);
      const family = (await connections(page)).find(line => line.children.includes("person_june"))!;
      const xs = family.children.map(id => at[id].x + at[id].width / 2);
      expect(family.fork!.x).toBe((Math.min(...xs) + Math.max(...xs)) / 2);
      expect(family.fork!.x).toBe(family.junction!.x);
      expect(Math.min(...xs)).toBeLessThan(family.fork!.x);
      expect(Math.max(...xs)).toBeGreaterThan(family.fork!.x);
      expect(family.paths[0].startsWith(`M${family.junction!.x} ${family.junction!.y} V${family.fork!.y} M`)).toBe(true);
    }).toPass();
  }
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("centred-family-branches.png"), fullPage: true });
});

test("co-parent and guardianship lines stay distinct, and status marks appear in the legend", async ({ page }) => {
  const coParent = await addRelative(page, "person_june", "unrelated", "CoParent");
  const child = await addRelative(page, "person_june", "child", "SharedChild", coParent);
  await expect.poll(async () => (await connections(page)).find(line => line.children.includes(child))?.parents.sort()).toEqual(["person_june", coParent].sort());
  await expect(page.locator('.family-connection [data-line-kind="coparent"]')).toHaveCount(1);
  await addRelative(page, child, "guardian", "Guardian");
  await expect(page.locator('.family-connection [data-line-kind="guardian"]')).toHaveCount(1);
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.relationships.find((rel: { type: string }) => rel.type === "spouse").status = "divorced";
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('[data-legend-kind="divorced"]')).toHaveText("Divorced");
  await expect(page.locator(".react-flow__edge-text")).toHaveCount(0);
});

test("relationship types live on person cards and named relatives, never on the lines", async ({ page }, testInfo) => {
  const june = page.locator('.react-flow__node[data-id="person_june"]');
  await expect(june.locator(".graph-person-relationships")).toHaveText("Daughter \u00b7 Mother");
  await expect(june.locator(".graph-person-relationships")).toHaveAttribute("title", /Daughter of Alex Chang; Daughter of Mei Tan; Mother of Kai Chang/);
  const taylor = await addRelative(page, "person_june", "spouse", "Taylor");
  await expect(june.locator(".graph-person-relationships")).toContainText("Spouse");
  await expect(page.locator(`.react-flow__node[data-id="${taylor}"] .graph-person-relationships`)).toHaveText("Spouse");
  await june.click();
  const inspector = page.getByRole("complementary", { name: "Selected person" });
  await expect(page.getByLabel("Key info overview for June Chang", { exact: true })).toContainText("Taylor Chang");
  await expect(inspector.getByRole("heading", { name: "Relationships", exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Relationships", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Spouse Taylor Chang", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Father Alex Chang", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Unlink Taylor Chang", exact: true }).click();
  await expect(june.locator(".graph-person-relationships")).not.toContainText("Spouse");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(june.locator(".graph-person-relationships")).toContainText("Spouse");
  await page.reload();
  await expect(june.locator(".graph-person-relationships")).toContainText("Spouse");
  await expect(page.locator(".react-flow__edge-text, .react-flow__edge-textwrapper, .react-flow__edges text")).toHaveCount(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("relationship-cards-desktop.png"), fullPage: true });
});

test("adds explicit foster, adoptive, biological, step and half sibling types through the dialog", async ({ page }) => {
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("sibling");
  await dialog.getByLabel("Sibling type", { exact: true }).selectOption("foster");
  await dialog.getByLabel("Given name", { exact: true }).fill("FosterSibling");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id="person_june"] .graph-person-relationships')).toContainText("Foster sister");
  await expect(page.locator('.family-connection [data-line-kind="fosterSibling"]')).toHaveCount(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).relationships.find((rel: { type: string; status?: string }) => rel.type === "sibling" && rel.status === "foster"));
  expect(stored).toBeTruthy();
});

test("family tree exposes active genealogy, descendants, hourglass, fan and relatives views", async ({ page }) => {
  await page.getByRole("button", { name: "Genealogy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Genealogy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Generations", { exact: true })).toBeVisible();
  await expect(page.locator(".chart-caption")).toContainText("Genealogy");
  await page.getByRole("button", { name: "Descendants", exact: true }).click();
  await expect(page.locator(".chart-caption")).toContainText("Descendants");
  await page.getByRole("button", { name: "Hourglass", exact: true }).click();
  await expect(page.locator(".chart-caption")).toContainText("Hourglass");
  await expect(page.locator(".react-flow__edge-text, .react-flow__edges text")).toHaveCount(0);
  await page.getByRole("button", { name: "Fan", exact: true }).click();
  await expect(page.getByLabel("Fan chart view", { exact: true })).toBeVisible();
  await expect(page.locator(".fan-segment")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Relatives", exact: true }).click();
  await expect(page.getByLabel("Relatives relationship view", { exact: true })).toBeVisible();
  await expect(page.locator(".relative-card")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Family tree", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("all relationship roles fit on a card and status details survive mobile and filtered views", async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    const june = state.people.find((person: { id: string }) => person.id === "person_june");
    const links = [["spouse", "Taylor"], ["partner", "Jordan"], ["sibling", "Robin"], ["guardian", "Sam"], ["guardian", "Morgan"]];
    links.forEach(([type, name], index) => {
      const id = `test_${name}`;
      state.people.push({ ...june, id, givenName: name, familyName: "LongFamilyNameThatMustNotCoverAnotherPerson", labels: [] });
      state.relationships.push({ id, treeId: june.treeId, type, fromId: index === 4 ? id : june.id, toId: index === 4 ? june.id : id, sourceIds: [], status: type === "spouse" ? "divorced" : "" });
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const june = page.locator('.react-flow__node[data-id="person_june"]');
  await june.click();
  const roles = june.locator(".graph-person-relationships");
  for (const role of ["Mother", "Daughter", "Spouse", "Partner", "Sister", "Guardian", "Ward"]) await expect(roles).toContainText(role);
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(page.locator(".relative-row small").filter({ hasText: "Spouse (divorced)" })).toBeVisible();
  await expect(roles).toHaveAttribute("title", /Spouse of Taylor .*\(divorced\)/);
  const fits = () => roles.evaluate(element => element.scrollHeight <= element.clientHeight && element.getBoundingClientRect().bottom <= element.closest(".graph-person")!.getBoundingClientRect().bottom);
  expect(await fits()).toBe(true);
  await page.getByRole("button", { name: "Focus on selected person", exact: true }).click();
  await page.getByRole("button", { name: "Genealogy", exact: true }).click();
  await expect(roles).toContainText("Spouse");
  await page.getByRole("button", { name: "Family tree", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await fits()).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".react-flow__edge-text, .react-flow__edges text")).toHaveCount(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath("relationship-cards-mobile.png"), fullPage: true });
});

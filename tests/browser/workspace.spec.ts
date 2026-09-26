import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("tree, person pages, family links, refresh and browser history", async ({ page }) => {
  await expect(page).toHaveURL(/\/tree$/);
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  await page.getByRole("button", { name: "Open profile" }).click();
  await expect(page.getByRole("heading", { name: "June Chang" })).toBeVisible();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(page).toHaveURL(/\/people\/person_june\/timeline$/);
  await expect(page.getByRole("heading", { name: "Life timeline" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Life timeline" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/overview$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/timeline$/);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.locator(".profile-relatives").getByRole("link", { name: /Kai Chang/ }).click();
  await expect(page.getByRole("heading", { name: "Kai Chang" })).toBeVisible();
  await page.getByRole("link", { name: "View in tree" }).click();
  await expect(page.locator(".person-inspector h2")).toHaveText("Kai Chang");
  await expect(page.getByLabel("Key info overview for Kai Chang", { exact: true })).toContainText("Parents");
  await expect(page.getByRole("button", { name: "Show more", exact: true })).toBeVisible();
  await expect(page.locator(".person-inspector").getByLabel("Given name")).toHaveCount(0);
});

test("person profile has quick actions, expandable sections and family facts timeline", async ({ page }) => {
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  await page.getByRole("button", { name: "Open profile" }).click();
  const panel = page.getByLabel("Quick person panel for June Chang");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: /Research this person/ })).toBeVisible();
  const actions = panel.getByLabel("Quick actions for June Chang");
  await expect(actions.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
  await expect(actions.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
  await expect(actions.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await expect(actions.getByRole("link", { name: "More", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Photos & Videos" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Immediate Family" })).toBeVisible();
  await panel.getByRole("button", { name: "Biography" }).click();
  await expect(panel).toContainText("central person with a linked birth source");
  const facts = panel.getByLabel("Facts timeline for June Chang");
  await expect(facts).toContainText("Birth");
  await expect(facts).toContainText("Birth of son:");
  await expect(facts).toContainText("Kai Chang");
  await actions.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Edit details", exact: true })).toHaveAttribute("aria-current", "page");
});

test("add a relative, edit the live chart, undo, redo and persist changes", async ({ page }) => {
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("parent");
  await dialog.getByLabel("Given name", { exact: true }).fill("Test Ancestor");
  await dialog.getByLabel("Birth date").fill("1930-01-14");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator(".person-inspector h2")).toHaveText("Test Ancestor Chang");
  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.getByRole("button", { name: "Redo last change" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.getByLabel("Find in tree").fill("Test Ancestor");
  await page.locator(".search-results").getByRole("button").click();
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await page.locator(".person-inspector").getByLabel("Given name").fill("Evelyn");
  await expect(page.locator(".graph-person-heading").getByText("Evelyn Chang")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).people.find((p: { id: string }) => p.id === "person_alex").givenName)).toBe("Alex");
  await page.reload();
  await expect(page.locator(".person-inspector h2")).toHaveText("Evelyn Chang");
  await page.getByRole("link", { name: "Families", exact: true }).click();
  await expect(page.locator(".family-group-list")).toContainText("Evelyn Chang");
});

test("reject circular ancestry and duplicate links through the real dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("parent");
  await dialog.getByRole("button", { name: "Existing person", exact: true }).click();
  await dialog.getByLabel("Existing person", { exact: true }).selectOption({ label: "Kai Chang" });
  await dialog.getByRole("button", { name: "Link relative" }).click();
  await expect(dialog.getByRole("alert")).toContainText("circular ancestry");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("child");
  await dialog.getByLabel("Existing person", { exact: true }).selectOption({ label: "June Chang" });
  await dialog.getByRole("button", { name: "Link relative" }).click();
  await expect(dialog.getByRole("alert")).toContainText("already exists");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("ancestors, descendants, generation controls, zoom and draggable nodes", async ({ page }) => {
  await page.locator('.react-flow__node[data-id="person_kai"]').click();
  await page.getByRole("button", { name: "Focus on selected person" }).click();
  await page.getByRole("button", { name: "Genealogy", exact: true }).click();
  await page.getByLabel("Generations", { exact: true }).selectOption("1");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByLabel("Generations", { exact: true }).selectOption("4");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.getByRole("button", { name: "Descendants", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "Family tree", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.waitForTimeout(500);
  const node = page.locator('.react-flow__node[data-id="person_alex"]');
  const before = await node.getAttribute("style");
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 95, box.y + 70, { steps: 12 });
  await page.mouse.up();
  await expect(node).not.toHaveAttribute("style", before!);
  const dragged = await node.evaluate(element => (element as HTMLElement).style.transform);
  await page.reload();
  await expect.poll(() => node.evaluate(element => (element as HTMLElement).style.transform)).toBe(dragged);
  const viewport = page.locator(".react-flow__viewport");
  await page.waitForTimeout(400);
  const scale = await viewport.getAttribute("style");
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  await expect(viewport).not.toHaveAttribute("style", scale!);
});

test("separate tree data and searchable people directory", async ({ page }) => {
  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.getByLabel("Search people").fill("June");
  await expect(page.locator(".people-table-row")).toHaveCount(1);
  await page.locator(".people-table-row").click();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("button", { name: "Add first person" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Given name").fill("Isolated");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByLabel("Active relationship tree").selectOption({ index: 0 });
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.locator(".person-inspector")).not.toContainText("Isolated");
});

test("desktop and mobile layout stay within the viewport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.screenshot({ path: "verification/chart-desktop.png", fullPage: true });
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    await expect(page.getByTestId("family-chart")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const stageBox = await page.locator(".tree-stage").boundingBox();
  const inspectorBox = await page.locator(".person-inspector").boundingBox();
  expect(stageBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(inspectorBox!.x).toBeGreaterThan(stageBox!.x);
  expect(Math.ceil(inspectorBox!.x + inspectorBox!.width)).toBeLessThanOrEqual(390);
  expect(inspectorBox!.y).toBeGreaterThanOrEqual(stageBox!.y - 1);
  await expect(page.getByRole("button", { name: "Genealogy", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Descendants", exact: true })).toBeInViewport();
  await page.screenshot({ path: "verification/chart-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "People", exact: true }).click();
  await expect(page.locator(".people-table-row")).toHaveCount(4);
  await page.locator(".people-table-row").first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "verification/profile-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("person editor stores date modes, relationship labels, government files and shared library uploads", async ({ page }) => {
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(page.locator(".relative-list")).toContainText("Father");
  await expect(page.locator(".relative-list")).toContainText("Mother");
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Birth date mode").selectOption("qualified");
  await page.getByLabel("Birth date qualifier").selectOption("About");
  await page.getByLabel("Birth date", { exact: true }).fill("1988");
  await page.getByLabel("Death date mode").selectOption("year");
  await page.getByLabel("Death date", { exact: true }).fill("2065");
  await page.getByLabel("Place where person died").fill("Singapore");
  await page.getByLabel("Hospital or facility where person died").fill("Serene General Hospital");
  await page.getByLabel("Burial or memorial type").selectOption("Cemetery interment");
  await page.getByLabel("Burial date mode").selectOption("year");
  await page.getByLabel("Burial date", { exact: true }).fill("2065");
  await page.getByLabel("Burial site").fill("Serene Memorial Garden");
  await page.getByLabel("Cemetery site").fill("Rose Silver Cemetery");
  await page.getByLabel("Has gravestone").check();
  await page.getByLabel("Birth method").selectOption("C-section");
  await page.getByLabel("Doctor", { exact: true }).fill("Dr Lim");
  await page.getByLabel("Government facility", { exact: true }).fill("KinForge Child Protection Unit");
  await page.getByLabel("Government file type").selectOption("Restraining Order Record");
  await page.locator('input[aria-label="Government file upload"]').setInputFiles({
    name: "restraining-order.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n")
  });
  await expect(page.getByLabel("Government files")).toContainText("Restraining Order Record");
  const storedPerson = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    return {
      june: state.people.find((person: { id: string }) => person.id === "person_june"),
      sensitiveFile: state.media.find((media: { tags: string[] }) => media.tags.includes("government-file"))
    };
  });
  expect(storedPerson.june.birthDate).toBe("About 1988");
  expect(storedPerson.june.deathDate).toBe("2065");
  expect(storedPerson.june.deathDetails.deathPlace).toBe("Singapore");
  expect(storedPerson.june.deathDetails.deathHospital).toBe("Serene General Hospital");
  expect(storedPerson.june.deathDetails.burialType).toBe("Cemetery interment");
  expect(storedPerson.june.deathDetails.burialDate).toBe("2065");
  expect(storedPerson.june.deathDetails.burialSite).toBe("Serene Memorial Garden");
  expect(storedPerson.june.deathDetails.cemeteryName).toBe("Rose Silver Cemetery");
  expect(storedPerson.june.deathDetails.hasGravestone).toBe(true);
  expect(storedPerson.june.government.birthMethod).toBe("C-section");
  expect(storedPerson.june.government.doctorName).toBe("Dr Lim");
  expect(storedPerson.june.government.governmentFacility).toBe("KinForge Child Protection Unit");
  expect(storedPerson.sensitiveFile.tags).toContain("Restraining Order Record");
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.locator('input[aria-label="Shared library upload"]').setInputFiles({
    name: "fan-chart.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n")
  });
  await expect(page.locator(".shared-library-list")).toContainText("fan-chart.pdf");
});

test("family types and relationship sub-types can be added and saved", async ({ page }) => {
  await page.getByRole("button", { name: "Add relative", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Relationship", { exact: true }).selectOption("relative");
  await dialog.getByLabel("Relationship sub-type").fill("Cousin-in-law");
  await dialog.getByLabel("Given name", { exact: true }).fill("Morgan");
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator(".person-inspector h2")).toHaveText("Morgan Chang");
  await expect(page.locator('.react-flow__node[data-id^="person_"]').filter({ hasText: "Morgan Chang" })).toBeVisible();
  const savedRelationship = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    return {
      relative: state.relationships.find((rel: { type: string; subtype?: string }) => rel.type === "relative" && rel.subtype === "Cousin-in-law")
    };
  });
  expect(savedRelationship.relative.subtype).toBe("Cousin-in-law");

  await page.getByRole("link", { name: "Families", exact: true }).click();
  await page.getByLabel("New relationship sub-type").fill("Ceremonial sibling-in-law");
  await page.getByRole("button", { name: "Add relationship sub-type", exact: true }).click();
  await expect(page.getByLabel("Family and relationship type library")).toContainText("Ceremonial sibling-in-law");
  await page.getByLabel("New family type").fill("Kinship circle");
  await page.getByRole("button", { name: "Add family type", exact: true }).click();
  await expect(page.getByLabel("Family and relationship type library")).toContainText("Kinship circle");
  await page.getByLabel("Family type for Chang-Tan family").selectOption("Kinship circle");
  const savedFamily = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    return {
      familyType: state.families.find((family: { id: string }) => family.id === "family_chang_tan").familyType,
      familyTypes: state.customFamilyTypes,
      relationshipTypes: state.customRelationshipSubtypes
    };
  });
  expect(savedFamily.familyType).toBe("Kinship circle");
  expect(savedFamily.familyTypes).toContain("Kinship circle");
  expect(savedFamily.relationshipTypes).toContain("Ceremonial sibling-in-law");
});

test("unlink, undo and dedicated profile edits update the tree", async ({ page }) => {
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await page.getByRole("button", { name: "Unlink June Chang", exact: true }).click();
  await expect(page.locator(".relative-list")).not.toContainText("June Chang");
  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(page.locator(".relative-list")).toContainText("June Chang");
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Given name", { exact: true }).fill("Alexander");
  await page.getByRole("link", { name: "View in tree" }).click();
  await expect(page.locator('.react-flow__node[data-id="person_alex"]')).toContainText("Alexander Chang");
});

test("all workspace sections have working page addresses", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const sections = ["People", "Families", "Dashboard", "Library", "Places & Sources", "Research", "Media", "Glyph Library", "Charts", "Reports", "Publish & GEDCOM", "DNA", "Maintenance", "Feature Coverage", "Family Tree"];
  const paths = new Set<string>();
  for (const name of sections) {
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name, exact: true }).click();
    await expect(page.locator(".topbar h2")).toHaveText(name);
    paths.add(page.url());
  }
  expect(paths.size).toBe(sections.length);
  expect(errors).toEqual([]);
});

test("family tree reference capabilities exist as sidebar feature views", async ({ page }) => {
  const menu = page.getByRole("navigation", { name: "Workspace" });
  await expect(page.getByLabel("Family tree feature menu")).toHaveCount(0);

  await menu.getByRole("link", { name: "My Photos", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("My Photos");
  await expect(page.getByRole("heading", { name: "My Photos, Media Gallery and Lab" })).toBeVisible();
  await expect(page.getByText("Upload", { exact: true })).toBeVisible();

  await menu.getByRole("link", { name: "Import GEDCOM", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Import GEDCOM");
  await expect(page.getByRole("heading", { name: "GEDCOM Import" })).toBeVisible();

  await menu.getByRole("link", { name: "Print Charts & Books", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Print Charts & Books");
  await expect(page.getByRole("heading", { name: "Print Charts, Books, Share, and Package" })).toBeVisible();

  await menu.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Manage Trees");
  await expect(page.getByRole("heading", { name: "Manage Trees, Books, Collections" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Family Trees" })).toBeVisible();

  await menu.getByRole("link", { name: "Family Infographics", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Family Infographics");
  await expect(page.locator("section").filter({ hasText: "Build family-wide visual summaries" }).getByRole("heading", { name: "Family Infographics" })).toBeVisible();
  await expect(page.getByLabel("Chart type")).toHaveValue("Name Distribution");

  await menu.getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Timeline");
  await expect(page.getByLabel("Chart type")).toHaveValue("Timeline");
  await page.getByRole("button", { name: "Timeline infographic" }).click();
  await expect(page.getByLabel("Chart type")).toHaveValue("Timeline");

  await menu.getByRole("link", { name: "PedigreeMap™", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("PedigreeMap™");
  await expect(page.getByRole("heading", { name: "Pedigree Map and Statistic Map" })).toBeVisible();
  await expect(page.getByLabel("Pedigree Map summary")).toContainText("linked event");

  await menu.getByRole("link", { name: "Sources", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Sources");
  await expect(page.getByRole("heading", { name: "Sources and Templates" })).toBeVisible();

  await menu.getByRole("link", { name: "Consistency Checker", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Consistency Checker");
  await expect(page.locator("section").filter({ hasText: "plausibility report logic" }).getByRole("heading", { name: "Consistency Checker" })).toBeVisible();
  await expect(page.getByText("plausibility report logic")).toBeVisible();

  await menu.getByRole("link", { name: "Relationship Report", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Relationship Report");
  await expect(page.getByLabel("Report type", { exact: true })).toHaveValue("Kinship Report");

  await menu.getByRole("link", { name: "Backup", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Backup");
  await expect(page.getByRole("button", { name: "Backup" })).toHaveCount(2);
});

test("glyph library searches meanings and links each category", async ({ page }) => {
  await page.getByRole("link", { name: "Glyph Library", exact: true }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Glyph Library");
  await expect(page.getByRole("link", { name: "Open full glyph library" })).toHaveAttribute("href", /glyphs\/index\.html$/);
  await expect(page.getByRole("link", { name: "Open Disabilities glyph library" })).toHaveAttribute("href", /glyphs\/index\.html\?group=Disabilities$/);
  await expect(page.getByLabel("Glyph library category links")).toContainText("Relationships");
  await page.getByLabel("Search glyph meanings").fill("cousin-in-law");
  await expect(page.getByLabel("Glyph results")).toContainText("Cousin-in-law");
  await expect(page.getByLabel("Glyph results")).toContainText("connected through a spouse");
  await expect(page.getByRole("link", { name: "Download Cousin-in-law SVG" })).toHaveAttribute("href", /glyphs\/relationship-cousin-in-law\.svg$/);
  await page.getByLabel("Glyph category").selectOption("Disabilities");
  await page.getByLabel("Search glyph meanings").fill("deafblind");
  await expect(page.getByLabel("Glyph results")).toContainText("Deafblindness");
  await expect(page.getByLabel("Glyph results")).not.toContainText("Cousin-in-law");
});

test("dashboard combines genealogy interfaces into one working command center", async ({ page }) => {
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByLabel("Unified genealogy command center")).toContainText("Unified Genealogy Command Center");
  await expect(page.getByRole("button", { name: /Tree workspace/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Research hints/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reports and books/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /DNA clusters/ })).toBeVisible();
  await page.getByRole("button", { name: /Research hints/ }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Research");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: /Fan and charts/ }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Charts");
  await expect(page.getByLabel("Chart type")).toHaveValue("Fan Chart");
});

test("dashboard report shortcuts open person family and relationship reports", async ({ page }) => {
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByLabel("Report shortcuts")).toContainText("Downloads/KinForge Genealogy Studio/Reports");
  await page.getByRole("button", { name: /Person report/ }).click();
  await expect(page.locator(".topbar h2")).toHaveText("Reports");
  await expect(page.getByLabel("Report type")).toHaveValue("Person Report");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: /Family report/ }).click();
  await expect(page.getByLabel("Report type")).toHaveValue("Family Report");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: /Relationship report/ }).click();
  await expect(page.getByLabel("Report type")).toHaveValue("Kinship Report");
});

test("installed web app reopens a person page offline", async ({ page, context }) => {
  test.skip(!process.env.KINFORGE_TEST_URL, "Requires the production build and service worker.");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Timeline", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Life timeline" })).toBeVisible();
  await page.getByRole("link", { name: "View in tree" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await context.setOffline(false);
});

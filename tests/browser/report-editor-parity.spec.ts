import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSeedState, LANGUAGES, type AppState, type ReportDraft } from "../../src/domain";

test.setTimeout(60000);
const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4OkAAAAASUVORK5CYII=";
const image = `data:image/png;base64,${pixel}`;
const report = (id: string, overrides: Partial<ReportDraft> = {}): ReportDraft => ({
  id, treeId: "tree_demo", type: "Person Report", title: id, personId: "person_june", body: "",
  html: '<h1>Family notes</h1><p>First block</p><p>Second block</p><p>Third block</p><h2>Family details</h2><div data-report-field data-label="Researcher"><span class="report-field-value">June</span></div>',
  options: { language: "en", includePrivate: false, generations: 3 }, pageSize: "a4", updatedAt: "2026-09-23T01:00:00Z", ...overrides
});
async function openReports(page: Page, state = createSeedState()) {
  await page.goto("/");
  await page.evaluate(state => localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)), state);
  await page.reload();
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
}
const draft = (page: Page) => page.getByRole("textbox", { name: "Report draft", exact: true });
const contentOptions = (page: Page) => page.locator(".report-content-options");
const storedDrafts = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("kinforge-demo-v1")!) as AppState).reportDrafts);

test("saved drafts restore report options, all languages, and independent ancestry depths", async ({ page }) => {
  const state = createSeedState();
  state.reportDrafts = [report("Scoped events", { type: "Person Events Report", personId: "person_alex", options: { language: "de", includePrivate: true, generations: 5, eventScope: "immediate-family", eventTypes: ["Birth"], dateFrom: "1950-01-01", dateTo: "2026-01-01", columns: ["Date", "Type"], sections: ["Chronological events"], sortBy: "date", sortDirection: "desc", groupBy: "type", parentage: "adoptive" } }), report("Ancestor settings", { options: { language: "fr", generations: 3, ancestorGenerations: 2, descendantGenerations: 5, parentage: "foster", sections: ["Name Details"] } })];
  await openReports(page, state);
  await contentOptions(page).locator("summary").click();
  await expect(page.getByLabel("Report language", { exact: true }).locator("option")).toHaveCount(LANGUAGES.length);
  await expect(page.getByLabel("Ancestor generations", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Descendant generations", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Parentage", { exact: true })).toHaveValue("foster");
  await expect(page.getByLabel("Columns: Name", { exact: true })).toHaveCount(0);
  await page.getByLabel("Saved drafts", { exact: true }).selectOption("Scoped events");
  await expect(page.getByLabel("Report type", { exact: true })).toHaveValue("Person Events Report");
  await expect(page.getByLabel("Report language", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Report person", { exact: true })).toHaveValue("person_alex");
  await expect(page.getByLabel("Event scope", { exact: true })).toHaveValue("immediate-family");
  await expect(page.getByLabel("Date from", { exact: true })).toHaveValue("1950-01-01");
  await expect(page.getByLabel("Sort direction", { exact: true })).toHaveValue("desc");
  await expect(page.getByLabel("Columns: Date", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Columns: Place", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Include private people and annotations", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(page.getByLabel("Saved drafts", { exact: true }).locator("option")).toHaveCount(3);
  const generated = (await storedDrafts(page)).at(-1)!;
  expect(generated.options).toMatchObject({ eventScope: "immediate-family", dateFrom: "1950-01-01", language: "de", sortDirection: "desc", columns: ["Date", "Type"] });
  await page.getByLabel("Saved drafts", { exact: true }).selectOption("Ancestor settings");
  await expect(page.getByLabel("Report language", { exact: true })).toHaveValue("fr");
  await expect(page.getByLabel("Report generations", { exact: true })).toHaveValue("3");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft(page).getByRole("heading", { name: "Name Details", exact: true })).toBeVisible();
  await expect(draft(page).getByRole("heading", { name: "Media", exact: true })).toHaveCount(0);
  expect((await storedDrafts(page)).at(-1)?.options).toMatchObject({ ancestorGenerations: 2, descendantGenerations: 5, parentage: "foster" });
});

test("saved Lists retain their tab and filters when their type is also a Report", async ({ page }) => {
  const state = createSeedState();
  state.reportDrafts = [report("List draft", { type: "Events List", mode: "list", options: { columns: ["Date", "Type"], sortBy: "date", sortDirection: "desc" } })];
  await openReports(page, state);
  await expect(page.getByLabel("List type", { exact: true })).toHaveValue("Events List");
  await contentOptions(page).locator("summary").click();
  await expect(page.getByLabel("Columns: Place", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(page.getByLabel("Saved drafts", { exact: true }).locator("option")).toHaveCount(2);
  expect((await storedDrafts(page)).at(-1)?.mode).toBe("list");
  await page.reload();
  await expect(page.getByLabel("List type", { exact: true })).toHaveValue("Events List");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByLabel("Saved drafts", { exact: true }).selectOption("List draft");
  await expect(page.getByLabel("List type", { exact: true })).toHaveValue("Events List");
});

test("presentation, crest, and theme survive reload and produce standalone styled HTML", async ({ page, context }, testInfo) => {
  const state = createSeedState(); state.reportDrafts = [report("Presentation")];
  await openReports(page, state);
  await page.getByLabel("Report theme", { exact: true }).selectOption("forest");
  await page.getByLabel("Page orientation", { exact: true }).selectOption("landscape");
  await page.getByLabel("Page margins", { exact: true }).fill("36");
  await page.getByLabel("Page header", { exact: true }).fill("Chang family archive");
  await page.getByLabel("Page footer", { exact: true }).fill("Reviewed locally");
  await page.getByLabel("Page numbers", { exact: true }).check();
  await page.getByLabel("Print background", { exact: true }).uncheck();
  await page.getByLabel("Page watermark", { exact: true }).fill("DRAFT");
  await page.getByLabel("Crest image file", { exact: true }).setInputFiles({ name: "crest.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") });
  await expect(page.getByAltText("Family crest", { exact: true })).toBeVisible();
  await expect(draft(page).locator("h2")).toHaveCSS("background-color", "rgb(230, 239, 232)");
  await expect(page.locator(".report-paper")).toHaveClass(/landscape/);
  await expect(page.locator(".report-paper")).toHaveCSS("padding-left", "48px");
  await page.reload();
  await expect(page.getByLabel("Report theme", { exact: true })).toHaveValue("forest");
  await expect(page.getByLabel("Print background", { exact: true })).not.toBeChecked();
  await expect(page.locator(".report-page-header")).toHaveText("Chang family archive");
  await expect(page.getByAltText("Family crest", { exact: true })).toHaveAttribute("src", image);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  const path = testInfo.outputPath("report.html"); await (await download).saveAs(path);
  const html = await readFile(path, "utf8");
  expect(html).toContain("--report-band:#e6efe8"); expect(html).toContain("Chang family archive"); expect(html).toContain("landscape");
  const exported = await context.newPage(); await exported.setContent(html);
  await expect(exported.locator(".report-document h2")).toHaveCSS("background-color", "rgb(230, 239, 232)");
  await expect(exported.getByAltText("Family crest", { exact: true })).toBeVisible();
  await exported.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("report-editor-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath("report-editor-desktop.png"), fullPage: true });
});

test("Mac app storage panel routes report exports into KinForge's Reports folder", async ({ page }) => {
  await page.addInitScript(() => {
    const folders = {
      Reports: "/Users/example/Downloads/KinForge Genealogy Studio/Reports",
      Backups: "/Users/example/Downloads/KinForge Genealogy Studio/Backups",
      Websites: "/Users/example/Downloads/KinForge Genealogy Studio/Websites",
      Exports: "/Users/example/Downloads/KinForge Genealogy Studio/Exports",
      Media: "/Users/example/Downloads/KinForge Genealogy Studio/Media",
      GEDCOM: "/Users/example/Downloads/KinForge Genealogy Studio/GEDCOM",
      Charts: "/Users/example/Downloads/KinForge Genealogy Studio/Charts"
    };
    Object.assign(window, {
      __kinforgeSaved: [],
      __kinforgeOpened: "",
      kinforgeNative: {
        getStorageFolders: async () => ({
          appRoot: "/Users/example/Library/Application Support/KinForge Genealogy Studio",
          downloadsRoot: "/Users/example/Downloads/KinForge Genealogy Studio",
          folders,
          appFolders: {}
        }),
        saveFile: async (payload: unknown) => {
          (window as unknown as { __kinforgeSaved: unknown[] }).__kinforgeSaved.push(payload);
          const fileName = (payload as { fileName: string }).fileName;
          const category = (payload as { category: string }).category;
          return { ok: true, path: `${folders.Reports}/${fileName}`, category };
        },
        showFolder: async (target: string) => {
          (window as unknown as { __kinforgeOpened: string }).__kinforgeOpened = target;
          return { ok: true, path: target };
        }
      }
    });
  });
  const state = createSeedState(); state.reportDrafts = [report("Native storage")];
  await openReports(page, state);
  await expect(page.locator(".native-folder-panel")).toContainText("KinForge folders");
  await expect(page.locator(".native-folder-panel")).toContainText("KinForge Genealogy Studio/Reports");
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __kinforgeSaved: Array<{ fileName: string; category: string; base64: string }> }).__kinforgeSaved.length)).toBe(1);
  const saved = await page.evaluate(() => (window as unknown as { __kinforgeSaved: Array<{ fileName: string; category: string; base64: string }> }).__kinforgeSaved[0]);
  expect(saved.fileName).toBe("KinForge-report.html");
  expect(saved.category).toBe("Reports");
  expect(saved.base64.length).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Reports", exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __kinforgeOpened: string }).__kinforgeOpened)).toBe("Reports");
});

test("Shift-selected objects move together, align, delete, and undo", async ({ page }) => {
  const state = createSeedState(); state.reportDrafts = [report("Objects")];
  await openReports(page, state);
  await page.getByRole("button", { name: "Select objects", exact: true }).click();
  const objects = page.getByRole("group", { name: "Report objects", exact: true });
  await objects.getByRole("button", { name: "2. First block", exact: true }).click();
  await objects.getByRole("button", { name: "3. Second block", exact: true }).click({ modifiers: ["Shift"] });
  await expect(page.locator(".report-object-controls output")).toHaveText("2 selected");
  await page.getByRole("button", { name: "Move selected objects up", exact: true }).click();
  await expect(draft(page).locator(":scope > :first-child")).toHaveText("First block");
  await expect(draft(page).locator(":scope > :nth-child(2)")).toHaveText("Second block");
  await page.getByRole("button", { name: "Align objects right", exact: true }).click();
  await expect(draft(page).locator(".report-object-selected").first()).toHaveCSS("text-align", "right");
  await page.getByRole("button", { name: "Move selected objects down", exact: true }).click();
  await expect(draft(page).locator(":scope > :first-child")).toHaveText("Family notes");
  await page.getByRole("button", { name: "Delete selected objects", exact: true }).click();
  await expect(draft(page)).not.toContainText("First block");
  await expect(draft(page)).not.toContainText("Second block");
  await page.getByRole("button", { name: "Undo report edit", exact: true }).click();
  await expect(draft(page)).toContainText("First block");
  await expect(draft(page)).toContainText("Second block");
  await page.reload();
  await expect(draft(page).locator("p").first()).toHaveCSS("text-align", "right");
});

test("image sizing, fields, sections, tables, lines, and page breaks persist as editable objects", async ({ page }) => {
  const state = createSeedState();
  state.reportDrafts = [report("Insertions", { html: `<h1>Family notes</h1><div data-report-block="reportMedia" data-width="300" data-alignment="center" data-page-break-before="true"><img src="${image}" alt="Family photograph"><p>Photograph caption</p></div><p>Notes</p>` })];
  await openReports(page, state);
  await expect(draft(page).locator(".report-media")).toHaveAttribute("data-width", "300");
  await expect(draft(page).locator(".report-media")).toHaveAttribute("data-page-break-before", "true");
  await draft(page).getByAltText("Family photograph", { exact: true }).click();
  await page.getByLabel("Selected image width", { exact: true }).fill("160");
  await page.getByLabel("Selected image height", { exact: true }).fill("120");
  await page.getByLabel("Selected image alignment", { exact: true }).selectOption("right");
  await expect(draft(page).getByAltText("Family photograph", { exact: true })).toHaveCSS("width", "160px");
  await expect(draft(page).getByAltText("Family photograph", { exact: true })).toHaveCSS("height", "120px");
  await expect(draft(page)).toContainText("Photograph caption");
  await page.getByLabel("New object label", { exact: true }).fill("Archivist");
  await page.getByRole("button", { name: "Insert field", exact: true }).click();
  await draft(page).getByRole("textbox", { name: "Archivist in report", exact: true }).fill("June Chang");
  await page.getByLabel("New object label", { exact: true }).fill("Research findings");
  await page.getByRole("button", { name: "Insert section", exact: true }).click();
  await expect(draft(page).locator(".report-section h2")).toHaveText("Research findings");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await expect(draft(page).locator("table tr")).toHaveCount(3);
  await draft(page).locator("table td p").first().click();
  await page.keyboard.insertText("Reviewed source");
  await page.getByRole("button", { name: "Insert line", exact: true }).click();
  await page.getByRole("button", { name: "Insert page break", exact: true }).click();
  await expect(draft(page).locator('[data-report-page-break="true"]')).toHaveCount(1);
  await expect(draft(page).locator("hr")).toHaveCount(1);
  await page.reload();
  await expect(draft(page).locator('[data-report-page-break="true"]')).toHaveCount(1);
  await expect(draft(page).getByAltText("Family photograph", { exact: true })).toHaveAttribute("data-alignment", "right");
  await expect(draft(page).getByAltText("Family photograph", { exact: true })).toHaveCSS("height", "120px");
  await expect(draft(page).getByRole("textbox", { name: "Archivist in report", exact: true })).toHaveText("June Chang");
  await expect(draft(page).locator("table")).toContainText("Reviewed source");
  await expect(draft(page)).toHaveCSS("font-size", "20px");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Insert table", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Report theme", { exact: true })).toBeDisabled();
  await expect(draft(page)).toHaveAttribute("contenteditable", "false");
});

test("PDF and Fillable PDF actions export current presentation and editable fields", async ({ page }, testInfo) => {
  const state = createSeedState(); state.reportDrafts = [report("PDF actions", { presentation: { orientation: "landscape", margin: 36, theme: "classic", header: "Chang archive", footer: "Private draft", pageNumbers: true }, html: '<h1>Family notes</h1><div data-report-field data-label="Researcher"><span class="report-field-value">June Chang</span></div><div data-report-page-break="true"></div><p>Second page</p>' })];
  await openReports(page, state);
  for (const name of ["PDF", "Fillable PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const path = testInfo.outputPath(`${name.replace(/ /g, "-")}.pdf`); await (await download).saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const data = bytes.toString("latin1");
    if (name === "Fillable PDF") { expect(data).toContain("/AcroForm"); expect(data).toContain("/Subtype /Widget"); }
    else expect(data).not.toContain("/Subtype /Widget");
  }
});

test("canvas preserves flow placement and supports constrained coordinates, layers, multi-drag, reload and export", async ({ page }, testInfo) => {
  const state = createSeedState(); state.reportDrafts = [report("Canvas positioning")];
  await openReports(page, state);
  const positions = () => draft(page).evaluate(root => { const origin = root.getBoundingClientRect(); return Array.from(root.children).map(node => { const rect = node.getBoundingClientRect(); return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width }; }); });
  const before = await positions();
  await page.getByLabel("Report layout", { exact: true }).selectOption("canvas");
  await expect(draft(page)).toHaveAttribute("data-report-layout", "canvas");
  const after = await positions();
  for (let i = 0; i < before.length; i++) { expect(Math.abs(before[i].x - after[i].x)).toBeLessThan(1); expect(Math.abs(before[i].y - after[i].y)).toBeLessThan(1); expect(Math.abs(before[i].width - after[i].width)).toBeLessThan(1); }
  const objects = page.getByRole("group", { name: "Report objects", exact: true });
  await objects.getByRole("button", { name: "2. First block", exact: true }).click();
  await page.getByLabel("Object width", { exact: true }).fill("200");
  await page.getByLabel("Object X", { exact: true }).fill("40");
  await page.getByLabel("Object Y", { exact: true }).fill("260");
  await page.getByLabel("Object layer", { exact: true }).fill("20");
  const first = draft(page).locator(":scope > :nth-child(2)");
  await expect(first).toHaveCSS("left", "40px"); await expect(first).toHaveCSS("top", "260px"); await expect(first).toHaveCSS("z-index", "20");
  await objects.getByRole("button", { name: "3. Second block", exact: true }).click();
  await page.getByLabel("Object width", { exact: true }).fill("200");
  await page.getByLabel("Object X", { exact: true }).fill("40");
  await page.getByLabel("Object Y", { exact: true }).fill("320");
  await objects.getByRole("button", { name: "2. First block", exact: true }).click({ modifiers: ["Shift"] });
  await expect(page.locator(".report-object-controls output")).toHaveText("2 selected");
  await first.scrollIntoViewIfNeeded();
  const rect = (await first.boundingBox())!;
  await page.mouse.move(rect.x + 15, rect.y + 10); await page.mouse.down(); await page.mouse.move(rect.x + 65, rect.y + 50, { steps: 4 }); await page.mouse.up();
  await expect(first).toHaveCSS("left", "90px"); await expect(first).toHaveCSS("top", "300px");
  await expect(draft(page).locator(":scope > :nth-child(3)")).toHaveCSS("top", "360px");
  await page.getByRole("button", { name: "Send selected objects to back", exact: true }).click();
  await expect(first).toHaveCSS("z-index", "1");
  await page.getByRole("button", { name: "Bring selected objects to front", exact: true }).click();
  await expect(first).toHaveCSS("z-index", String(await draft(page).locator(":scope > *").count() - 1));
  await page.getByLabel("Object X", { exact: true }).fill("9999");
  const rootWidth = (await draft(page).boundingBox())!.width;
  expect(Number(await first.getAttribute("data-report-x")) + 200).toBeLessThanOrEqual(rootWidth + 1);
  await page.getByLabel("Object X", { exact: true }).fill("90");
  await page.reload();
  await expect(draft(page)).toHaveAttribute("data-report-layout", "canvas"); await expect(first).toHaveCSS("left", "90px");
  expect((await draft(page).boundingBox())!.height).toBeGreaterThan(385);
  const pdf = page.waitForEvent("download"); await page.getByRole("button", { name: "PDF", exact: true }).click(); await (await pdf).saveAs(testInfo.outputPath("canvas.pdf"));
  const html = page.waitForEvent("download"); await page.getByRole("button", { name: "HTML", exact: true }).click(); const htmlPath = testInfo.outputPath("canvas.html"); await (await html).saveAs(htmlPath);
  expect(await readFile(htmlPath, "utf8")).toContain('data-report-layout="canvas"');
  await page.getByLabel("Report layout", { exact: true }).selectOption("flow");
  await expect(draft(page)).toHaveAttribute("data-report-layout", "flow"); await expect(first).toHaveCSS("position", "static");
  await expect(page.getByLabel("Object X", { exact: true })).toHaveCount(0);
});

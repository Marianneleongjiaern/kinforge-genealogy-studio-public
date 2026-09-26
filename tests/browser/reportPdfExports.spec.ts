import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSeedState, type ReportDraft } from "../../src/domain";

test.setTimeout(120000);
async function openReport(page: Page, draft: Partial<ReportDraft>) {
  const state = createSeedState();
  state.reportDrafts = [{ id: "pdf-export-test", treeId: "tree_demo", type: "Person Report", personId: "person_june", title: "Export validation", body: "", html: "", options: { language: "en" }, pageSize: "letter", updatedAt: "2026-09-23T01:00:00Z", ...draft }];
  await page.goto("/");
  await page.evaluate(state => localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)), state);
  await page.reload();
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Report draft", exact: true })).toBeVisible();
}

for (const fillable of [false, true]) test(`report ${fillable ? "fillable" : "searchable"} PDF keeps Unicode, page breaks and presentation`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", message => { if (message.type() === "error" && message.text().includes("jsPDF")) errors.push(message.text()); });
  await page.goto("/");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 180; canvas.height = 90;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#267f88"; ctx.fillRect(0, 0, 180, 90); ctx.fillStyle = "#edc646"; ctx.fillRect(25, 20, 80, 50);
    return canvas.toDataURL();
  });
  await openReport(page, {
    html: `<h1>Family archive: \u00c9lodie \u5f20\u4f1f \u041c\u0430\u0440\u0438\u044f</h1><h2>Identity</h2><div data-report-field data-label="Name"><span class="report-field-value">\u00c9lodie \u5f20\u4f1f</span></div><div data-report-field data-label="Name"><span class="report-field-value">\u041c\u0430\u0440\u0438\u044f</span></div><div data-report-field data-label="Notes"><span class="report-field-value">Line one<br>Line two (reviewed) \\ family</span></div><div data-report-field data-label="Empty"><span class="report-field-value"></span></div><div data-report-block="reportMedia" data-width="180"><img title="report-chart" src="${image}" width="180" alt="Family diagram"><p>Captioned family diagram</p></div><div data-report-page-break="true"></div><h2>Second section</h2><p>Unicode retained: \u017deljko, S\u00f8ren, \u0141ukasz, \u041c\u0430\u0440\u0438\u044f, \u5f20\u4f1f, \ud83c\udf33.</p><table><tr><th><p>Name</p></th><th><p>Date</p></th></tr><tr><td><p>June Chang</p></td><td><p>1988-06-12</p></td></tr></table><div data-report-block="reportSection" data-page-break-before="true"><p>Third section starts here.</p><p>END OF REPORT</p></div>`,
    presentation: { orientation: "landscape", margin: 36, theme: "forest", header: "Archive header", footer: "Archive footer", watermark: "REVIEW", pageNumbers: true, crest: image }
  });
  const external: string[] = [];
  page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(page.url()).origin) external.push(request.url()); });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: fillable ? "Fillable PDF" : "PDF", exact: true }).click();
  const path = testInfo.outputPath(fillable ? "fillable.pdf" : "searchable.pdf");
  await (await download).saveAs(path);
  await expect(page.locator("[data-report-pdf-host]")).toHaveCount(0);
  expect(errors).toEqual([]); expect(external).toEqual([]);
  const summary = JSON.parse(execFileSync(process.env.KINFORGE_PDF_PYTHON || "python3", [resolve("tests/browser/reportPdfValidate.py"), path, fillable ? "fillable" : "searchable"], { encoding: "utf8", env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/kinforge-pdf-tools" } }));
  expect(summary.pages).toBe(3); expect(summary.fields).toBe(fillable ? 4 : 0);
});

test("default PDF and RTF exports download from the editor", async ({ page }, testInfo) => {
  await openReport(page, { pageSize: "a4", html: '<h1>Family archive</h1><p>\u00c9lodie \u5f20\u4f1f</p><div data-report-page-break="true"></div><p>Next page.</p>' });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("KinForge-report.pdf");
  await (await download).saveAs(testInfo.outputPath("default.pdf"));
  await page.getByLabel("Page orientation", { exact: true }).selectOption("landscape");
  await page.getByLabel("Page header", { exact: true }).fill("Archive");
  await page.getByLabel("Page numbers", { exact: true }).check();
  const rtf = page.waitForEvent("download");
  await page.getByRole("button", { name: "RTF", exact: true }).click();
  expect((await rtf).suggestedFilename()).toBe("KinForge-report.rtf");
  const path = testInfo.outputPath("export.rtf"); await (await rtf).saveAs(path);
  const contents = await readFile(path, "utf8");
  expect(contents).toContain("\\landscape"); expect(contents).toContain("\\page\n"); expect(contents).toContain("\\u24352?"); expect(contents).toContain("\\header");
});

test("wrapped headers and footers reserve space around the PDF body", async ({ page }, testInfo) => {
  await openReport(page, { pageSize: "a4", html: "<h1>BEGIN BODY</h1><p>Family report content remains below the whole header and above the footer.</p>", presentation: { margin: 36, header: `${"Family archive with a long descriptive heading. ".repeat(20)}\nEND HEADER`, footer: `BEGIN FOOTER\n${"Reviewed locally for the family archive. ".repeat(12)}`, pageNumbers: true } });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const path = testInfo.outputPath("wrapped-header.pdf"); await (await download).saveAs(path);
  const summary = JSON.parse(execFileSync(process.env.KINFORGE_PDF_PYTHON || "python3", [resolve("tests/browser/reportPdfValidate.py"), path, "wrapped"], { encoding: "utf8", env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/kinforge-pdf-tools" } }));
  expect(summary.pages).toBe(1);
});

test("canvas PDF preserves positioned objects across scaled pages", async ({ page }, testInfo) => {
  await openReport(page, { pageSize: "a4", html: '<h1 data-report-x="80" data-report-y="80" data-report-width="500" data-report-z="1">Canvas first page</h1><p data-report-x="160" data-report-y="1550" data-report-width="500" data-report-z="2">Canvas second page</p>', presentation: { layout: "canvas", canvasWidth: 1000, margin: 36 } });
  await expect(page.getByRole("textbox", { name: "Report draft", exact: true })).toHaveAttribute("data-report-layout", "canvas");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const path = testInfo.outputPath("canvas.pdf"); await (await download).saveAs(path);
  const summary = JSON.parse(execFileSync(process.env.KINFORGE_PDF_PYTHON || "python3", [resolve("tests/browser/reportPdfValidate.py"), path, "canvas"], { encoding: "utf8", env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/kinforge-pdf-tools" } }));
  expect(summary.pages).toBe(2);
});

import { expect, test } from "@playwright/test";
import { createSeedState, REPORT_TYPES } from "../../src/domain";
import { CATALOG_TYPES } from "../../src/reportCatalog";
import { writeFile } from "node:fs/promises";

test.setTimeout(60000);
test("person draft stays formatted while editing and preserves changes, snapshots, image and exports", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report person").selectOption("person_june");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "Report draft", exact: true });
  await expect(draft).toHaveAttribute("contenteditable", "true");
  await expect(draft.locator(".report-header h1")).toHaveText("Person Report");
  await expect(draft.locator(".report-header h3")).toHaveText("June Chang");
  await expect(draft.getByRole("heading", { name: "Name Details", exact: true })).toHaveCSS("background-color", "rgb(224, 240, 242)");
  await expect(draft).toContainText("Once removed = 1 generation apart");
  await expect(page.getByLabel("Report font size", { exact: true })).toHaveValue("15pt");
  await expect(draft).toHaveCSS("font-size", "20px");
  const alignment = await draft.evaluate(element => {
    const left = element.getBoundingClientRect().left;
    return Array.from(element.children).filter(child => child.matches("p,.report-field,blockquote,h2")).map(child => Math.abs(child.getBoundingClientRect().left - left));
  });
  expect(alignment.every(offset => offset < 1)).toBe(true);
  await draft.getByRole("textbox", { name: "First Name in report", exact: true }).fill("June - report edition");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).people.find((p: { id: string }) => p.id === "person_june").givenName)).toBe("June");
  await page.screenshot({ path: testInfo.outputPath("person-report-desktop.png"), fullPage: true });

  // Select text through the real editor, then format it with the inspector controls.
  const title = draft.locator("h1");
  await title.click({ clickCount: 3 });
  await page.getByLabel("Report font size", { exact: true }).selectOption("24pt");
  await page.getByLabel("Report font", { exact: true }).selectOption("Georgia");
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(title.locator("em")).toBeVisible();
  await expect(title.locator('span[style*="24pt"]')).toBeVisible();
  await page.getByRole("button", { name: "Undo report edit", exact: true }).click();
  await expect(title.locator("em")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo report edit", exact: true }).click();
  await expect(title.locator("em")).toBeVisible();
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  await expect(title).toHaveCSS("text-align", "center");
  await page.getByLabel("Report paper size", { exact: true }).selectOption("letter");
  await expect(page.locator(".report-paper")).toHaveClass(/letter/);

  await draft.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Reviewed family draft.");
  await expect(draft).toContainText("Reviewed family draft.");
  await page.reload();
  await expect(draft).toContainText("Reviewed family draft.");
  await expect(draft.locator("h1 em")).toBeVisible();
  const editedHtml = await draft.innerHTML();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(draft).toHaveAttribute("contenteditable", "false");
  expect(await draft.innerHTML()).toBe(editedHtml);
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft).not.toContainText("Reviewed family draft.");
  const drafts = page.getByLabel("Saved drafts", { exact: true });
  await expect(drafts.locator("option")).toHaveCount(2);
  await drafts.selectOption({ index: 0 });
  await expect(draft).toContainText("Reviewed family draft.");
  await draft.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByLabel("Report image file", { exact: true }).setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4OkAAAAASUVORK5CYII=", "base64") });
  await expect(draft.locator('img[alt="sample.png"]')).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await (await download).saveAs(testInfo.outputPath("person-report.pdf"));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel("Report font", { exact: true })).toBeVisible();
  await page.evaluate(() => { document.querySelector(".report-desk")!.scrollTop = 0; window.scrollTo(0, 0); });
  await page.waitForTimeout(100);
  await page.screenshot({ path: testInfo.outputPath("person-report-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("every requested report produces its own content; diagrams have nonblank pixels; selected portraits persist", async ({ page }, testInfo) => {
  const state = createSeedState();
  for (const rel of state.relationships.filter(r => r.type === "parent-child" && r.toId === "person_june")) rel.parentRole = rel.fromId === "person_alex" ? "father" : "mother";
  await page.goto("/");
  const image = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 150; const c = canvas.getContext("2d")!; c.fillStyle = "#236670"; c.fillRect(0, 0, 120, 150); c.fillStyle = "#cfacdc"; c.fillRect(20, 20, 80, 110); return canvas.toDataURL(); });
  const photo = { id: "photoA", treeId: "tree_demo", title: "Chosen profile photo", type: "picture" as const, dataUrl: image, externalUrl: "", assignedTo: [{ kind: "person" as const, id: "person_june" }], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "" };
  state.media.push(photo, { ...photo, id: "photoB", title: "Other photograph" });
  await page.evaluate(state => localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)), state);
  await page.reload();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.goto("/#/trees/tree_demo/people/person_june/media");
  await page.getByLabel("Profile picture", { exact: true }).selectOption("photoA");
  await page.reload();
  await expect(page.getByLabel("Profile picture", { exact: true })).toHaveValue("photoA");
  await expect(page.getByRole("img", { name: "June Chang profile picture" }).first()).toHaveAttribute("src", image);
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report type", { exact: true }).selectOption("Person Report");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "Report draft", exact: true });
  await expect(draft.locator(".report-header img")).toHaveAttribute("src", image);
  await expect(draft.locator(".report-gallery .report-media")).toHaveCount(3);
  const imageRows = await draft.locator(".report-gallery img").evaluateAll(images => images.map(img => img.getBoundingClientRect().top));
  expect(new Set(imageRows.slice(0, 3)).size).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("person-report-with-photo.png"), fullPage: true });
  await writeFile(testInfo.outputPath("paper-bounds.json"), JSON.stringify(await page.locator(".report-paper").boundingBox()));
  const photoPdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await (await photoPdf).saveAs(testInfo.outputPath("person-report-with-photo.pdf"));
  const photoRtf = page.waitForEvent("download");
  await page.getByRole("button", { name: "RTF", exact: true }).click();
  await (await photoRtf).saveAs(testInfo.outputPath("person-report-with-photo.rtf"));
  for (const type of CATALOG_TYPES) {
    if (type === "Marriages List") continue;
    const isReport = REPORT_TYPES.includes(type);
    await page.getByRole("button", { name: isReport ? "Reports" : "Lists", exact: true }).click();
    await page.getByLabel(isReport ? "Report type" : "List type", { exact: true }).selectOption(type);
    if (type === "Relationship Chart") await page.getByLabel("Compare with", { exact: true }).selectOption("person_alex");
    await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
    await expect(draft.locator("h1")).toHaveText(type);
    await expect(draft).not.toContainText("Kai Chang");
    for (const img of await draft.locator('img[title="report-chart"]').all()) {
      const painted = await img.evaluate(async (element: HTMLImageElement) => { await element.decode(); const canvas = document.createElement("canvas"); canvas.width = element.naturalWidth; canvas.height = element.naturalHeight; const ctx = canvas.getContext("2d")!; ctx.drawImage(element, 0, 0); const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) count++; return count; });
      expect(painted).toBeGreaterThan(1000);
    }
    if (type === "Genogram") {
      await page.screenshot({ path: testInfo.outputPath("genogram-report.png"), fullPage: true });
      const diagramPdf = page.waitForEvent("download");
      await page.getByRole("button", { name: "PDF", exact: true }).click();
      await (await diagramPdf).saveAs(testInfo.outputPath("genogram-report.pdf"));
    }
  }
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report type", { exact: true }).selectOption("Kinship Report");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft.locator(".report-header img")).toHaveAttribute("src", image);
  await expect(page.locator(".report-saved")).toHaveText("Saved on this device");
});

test("storage failures do not falsely report a saved draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === "kinforge-demo-v1") throw new DOMException("Storage full", "QuotaExceededError"); return set.call(this, key, value); }; });
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Download a backup");
  await expect(page.locator(".report-saved")).toHaveText("Not saved to device");
  await expect(page.getByRole("textbox", { name: "Report draft", exact: true })).toBeVisible();
});

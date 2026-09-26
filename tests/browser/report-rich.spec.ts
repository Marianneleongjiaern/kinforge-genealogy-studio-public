import { expect, test } from "@playwright/test";
import { createSeedState } from "../../src/domain";

test.setTimeout(60000);
test("offline map and illustrated stories render, persist and remain readable on mobile", async ({ page, context }, testInfo) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", request => { if (/^https?:/.test(request.url()) && !request.url().includes("127.0.0.1")) external.push(request.url()); });
  await page.goto("/");
  const bitmap = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 240; c.height = 180;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#237889"; ctx.fillRect(0, 0, 240, 180); ctx.fillStyle = "#bb4477"; ctx.fillRect(30, 30, 120, 120);
    return c.toDataURL();
  });
  const state = createSeedState(), person = state.people.find(p => p.id === "person_june")!;
  const london = { ...state.places[0], id: "london", name: "London", latitude: "51.5074", longitude: "-0.1278", levels: { country: "United Kingdom" } };
  state.places.push(london, { ...london, id: "unmapped", name: "Unmapped family place", latitude: "", longitude: "" });
  for (const [id, date, placeId] of [["move", "2000-01-01", "london"], ["visit", "2010-01-01", "unmapped"]]) {
    state.events.push({ id, date, placeId, type: "Residence", description: `Recorded ${id}`, sourceIds: [state.sources[0].id], mediaIds: [`photo-${id}`] }); person.eventIds.push(id);
    state.media.push({ id: `photo-${id}`, treeId: "tree_demo", title: `Family photograph ${id}`, type: "picture", dataUrl: bitmap, externalUrl: "", assignedTo: [{ kind: "event", id }], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: `Reviewed caption ${id}`, transcript: "", createdAt: "" });
  }
  state.records.push({ id: "context", treeId: "tree_demo", personId: person.id, collection: "Historical Context", title: "Local community archive", date: "2001-01-01", citation: "Family archive box 7", transcription: "Recorded local context." });
  await page.evaluate(state => localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)), state);
  await page.reload();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report person", { exact: true }).selectOption(person.id);
  await page.getByLabel("Report type", { exact: true }).selectOption("Map Report");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "Report draft", exact: true });
  const map = draft.locator('img[title="report-map"]');
  await expect(map).toBeVisible();
  await expect(draft).toContainText("Unmapped family place: Coordinates not recorded");
  const pixels = await map.evaluate(async el => {
    const img = el as HTMLImageElement; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let land = 0, water = 0, markers = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 231 && data[i + 1] === 237 && data[i + 2] === 220) land++;
      if (data[i] === 232 && data[i + 1] === 244 && data[i + 2] === 248) water++;
      if (data[i] === 35 && data[i + 1] === 87 && data[i + 2] === 101) markers++;
    }
    return { width: c.width, height: c.height, land, water, markers, total: c.width * c.height };
  });
  expect(pixels.width).toBe(2160); expect(pixels.height).toBe(1280);
  expect(pixels.land / pixels.total).toBeGreaterThan(.12); expect(pixels.land / pixels.total).toBeLessThan(.5);
  expect(pixels.water / pixels.total).toBeGreaterThan(.3); expect(pixels.markers).toBeGreaterThan(200);
  await map.screenshot({ path: testInfo.outputPath("offline-report-map.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(map).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("offline-map-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByLabel("Report type", { exact: true }).selectOption("Story Report");
  await page.locator(".report-content-options > summary").click();
  await page.getByLabel("Story style", { exact: true }).selectOption("album");
  await page.getByLabel("Include world history", { exact: true }).check();
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft.locator('img[alt="Family photograph move"]')).toBeVisible();
  await expect(draft.locator('[data-report-page-break="true"]')).toHaveCount(1);
  await expect(draft).toContainText("Reviewed caption move");
  await expect(draft).toContainText("Family archive box 7");
  await expect(draft).toHaveCSS("font-size", "20px");
  await page.screenshot({ path: testInfo.outputPath("illustrated-story-desktop.png"), fullPage: true });
  const firstPhoto = draft.locator(".report-media").first();
  await firstPhoto.screenshot({ path: testInfo.outputPath("illustrated-story-photo.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await firstPhoto.scrollIntoViewIfNeeded();
  await firstPhoto.screenshot({ path: testInfo.outputPath("illustrated-story-photo-mobile.png") });
  await context.setOffline(false);
  await page.reload();
  await expect(draft.locator('img[alt="Family photograph move"]')).toBeVisible();
  await expect(draft.locator('[data-report-page-break="true"]')).toHaveCount(1);
  await expect(draft).toContainText("Family archive box 7");
  await page.getByLabel("Report type", { exact: true }).selectOption("Family Tree Book");
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(draft.getByRole("heading", { name: "Family Tree Book", exact: true })).toBeVisible();
  await expect(draft.locator('[data-report-block="reportSection"]')).toHaveCount(3);
  await expect(draft.locator('[data-report-page-break="true"]')).toHaveCount(2);
  await expect(draft).toContainText("Chapter 1: June Chang");
  await expect(draft).not.toContainText("Kai Chang");
  await expect(draft.locator('img[alt="Family photograph move"]')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath("family-book-chapters.png"), fullPage: true });
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Mac App publish card downloads real packaging instructions", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await page.getByRole("link", { name: "Publish & GEDCOM", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Mac App/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("KinForge-mac-release-instructions.txt");
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const text = await readFile(path, "utf8");
  expect(text).toContain("Apple Silicon DMG, PKG, and ZIP");
  expect(text).toContain("Intel DMG, PKG, and ZIP");
  expect(text).toContain("Record signing/notarization status honestly.");
});

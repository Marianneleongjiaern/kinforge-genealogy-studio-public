import { expect, test } from "@playwright/test";
import { createSeedState } from "../../src/domain";

test.setTimeout(90000);
test("cloud drive setup and saved exports work across device sessions, including offline queue and deletion", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, acceptDownloads: true });
  try {
    const email = `drives-${Date.now()}@example.test`; const password = "Browser-drive-tests-42";
    const registration = await context.request.post("/api/auth/register", { data: { email, password, name: "Drive Tester" }, headers: { "X-KinForge-Client": "1", "CF-Connecting-IP": email } });
    expect(registration.status()).toBe(201);
    await context.addInitScript(seed => { if (!localStorage.getItem("kinforge-genealogy-studio-v1")) localStorage.setItem("kinforge-genealogy-studio-v1", JSON.stringify(seed)); }, createSeedState());
    const page = await context.newPage(); await page.goto("/");
    await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Cloud drives", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Cloud drives", exact: true });
    await expect(dialog.getByText("Setup needed", { exact: true })).toHaveCount(2);
    await dialog.getByRole("region", { name: "Google Drive", exact: true }).getByRole("button", { name: "View setup requirements" }).click();
    await expect(dialog.getByRole("link", { name: "Google app registration" })).toBeVisible();
    for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 960 }]) {
      await page.setViewportSize(viewport);
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBeTruthy();
      await page.screenshot({ path: `verification/cloud-drives-${viewport.width}.png` });
    }
    await page.getByRole("button", { name: "Close cloud drives" }).click();
    await context.setOffline(true);
    const downloaded = page.waitForEvent("download"); await page.getByRole("button", { name: "Backup", exact: true }).click();
    expect((await downloaded).suggestedFilename()).toBe("KinForge-backup.json");
    await expect(page.getByRole("status").filter({ hasText: "Export queued for cloud sync" })).toBeVisible();
    await context.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("status").filter({ hasText: "Export saved to your cloud library" })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Cloud drives", exact: true }).click();
    await expect(dialog.getByText("KinForge-backup.json", { exact: true })).toBeVisible();
    const second = await browser.newContext({ baseURL, acceptDownloads: true });
    try {
      await second.request.post("/api/auth/login", { data: { email, password }, headers: { "X-KinForge-Client": "1" } });
      const other = await second.newPage(); await other.goto("/");
      await expect(other.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 20000 });
      await other.getByRole("button", { name: "Cloud drives", exact: true }).click();
      const savedDownload = other.waitForEvent("download"); await other.getByRole("button", { name: "Download KinForge-backup.json", exact: true }).click();
      expect((await savedDownload).suggestedFilename()).toBe("KinForge-backup.json");
      await expect(other.getByRole("button", { name: "Delete KinForge-backup.json", exact: true })).toHaveCount(1);
      await other.getByRole("button", { name: "Delete KinForge-backup.json", exact: true }).click();
      await other.getByRole("button", { name: "Confirm deletion" }).click();
      await expect(other.getByText("KinForge-backup.json", { exact: true })).toHaveCount(0);
      await expect(dialog.getByText("KinForge-backup.json", { exact: true })).toHaveCount(0, { timeout: 10000 });
    } finally { await second.close(); }
  } finally { await context.close(); }
});

test("guest exports never enter the account export queue", async ({ page }) => {
  const uploads: string[] = []; page.on("request", request => { if (/\/exports\//.test(request.url())) uploads.push(request.url()); });
  await page.goto("/"); await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Cloud drives", exact: true })).toHaveCount(0);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Backup", exact: true }).click(); await download;
  expect(uploads).toEqual([]);
});

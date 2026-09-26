import { _electron as electron, expect } from "@playwright/test";
import { resolve } from "node:path";

// Read-only verification against an explicitly supplied existing device profile.
// No record text, account identifiers or session credentials are logged.
const [executablePath, profile] = process.argv.slice(2);
if (!executablePath || !profile) throw new Error("Pass the app executable and an existing profile directory.");
const start = Date.now();
let app;
try {
  app = await electron.launch({ executablePath: resolve(executablePath), args: [`--user-data-dir=${resolve(profile)}`], timeout: 60000 });
  const processReadyMs = Date.now() - start;
  const page = await app.firstWindow();
  const windowReadyMs = Date.now() - start;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 20000 });
  const firstLibraryPaintMs = Date.now() - start;
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible({ timeout: 20000 });
  const libraryVisibleMs = Date.now() - start;
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 30000 });
  const verifiedMs = Date.now() - start;
  const startupTimings = await page.evaluate(() => ({
    marks: performance.getEntriesByType("mark").filter(e => e.name.startsWith("kinforge-")).map(e => ({ name: e.name, ms: Math.round(e.startTime) })),
    assets: performance.getEntriesByType("resource").filter(e => /\/assets\/[^/]+\.(js|css)$/.test(e.name)).map(e => ({ name: e.name.split("/").pop(), startMs: Math.round(e.startTime), durationMs: Math.round(e.duration) })),
    paint: performance.getEntriesByType("paint").map(e => ({ name: e.name, ms: Math.round(e.startTime) }))
  }));
  const reload = Date.now();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible({ timeout: 10000 });
  const reloadVisibleMs = Date.now() - reload;
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ passed: true, version: await app.evaluate(({ app }) => app.getVersion()), processReadyMs, windowReadyMs, firstLibraryPaintMs, libraryVisibleMs, verifiedMs, reloadVisibleMs, reloadVerifiedMs: Date.now() - reload, startupTimings, errors }));
} finally { await app?.close(); }

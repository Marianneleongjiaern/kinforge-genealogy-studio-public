import { test, expect } from "@playwright/test";
import { createSeedState } from "../../src/domain";
test.setTimeout(90000);

test("startup preview stays visible during slow device storage without enabling downloads", async ({ page }) => {
  const state = createSeedState();
  const user = { id: "preview-owner", name: "Owner", email: "preview@example.test" };
  const library = { id: "preview-library", name: "Family", owner_email: user.email, role: "owner", revision: 5 };
  await page.addInitScript(({ state, user, library }) => {
    localStorage.setItem("kinforge-cloud-startup-v1", JSON.stringify({ user, libraries: [library], libraryId: library.id }));
    localStorage.setItem(`kinforge-library-preview-v1:${user.id}:${library.id}`, JSON.stringify({ userId: user.id, libraryId: library.id, state }));
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args) {
      const request = original.apply(this, args);
      Object.defineProperty(request, "onsuccess", { set(handler) {
        request.addEventListener("success", event => setTimeout(() => handler.call(request, event), 5000));
      } });
      return request;
    };
  }, { state, user, library });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path === "/api/auth/me" ? { user } : path === "/api/libraries" ? { libraries: [library] } : path === "/api/libraries/preview-library" ? { state, revision: 5 } : {} });
  });
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(4, { timeout: 1800 });
  await expect(page.locator("[inert]")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Opening the full saved library" })).toBeVisible();
  const downloads: string[] = []; page.on("download", download => downloads.push(download.suggestedFilename()));
  expect(await page.locator("[inert]").evaluate(element => (element as HTMLElement).inert)).toBe(true);
  await expect(page.getByRole("button", { name: "Backup", exact: true }).click({ timeout: 400 })).rejects.toThrow();
  expect(downloads).toEqual([]);
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[inert]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Backup", exact: true })).toBeEnabled();
});

test("older cloud libraries reopen from cache before a slow server responds", async ({ page }) => {
  const state = createSeedState();
  delete (state as any).customFactTerms;
  delete (state.people[0] as any).government;
  delete (state.people[0] as any).deathDetails;
  const user = { id: "old-owner", name: "Returning owner", email: "old@example.test" };
  const library = { id: "old-library", name: "Saved family", owner_email: user.email, role: "owner", revision: 42 };
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user } });
    if (url.pathname === "/api/libraries") return route.fulfill({ json: { libraries: [library] } });
    if (url.pathname === "/api/libraries/old-library") return route.fulfill({ json: { state, revision: 42 } });
    await route.fulfill({ json: {} });
  });
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible();
  // Reproduce a cache written by the previous release, not only a modern cache.
  await page.evaluate(async ({ state }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("kinforge-cloud-cache-v1", 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("libraries", "readwrite");
        tx.objectStore("libraries").put({ base: state, draft: state, revision: 42, dirty: false }, "old-owner:old-library");
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { state });
  let release!: () => void, remoteRequests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/libraries/old-library?since=42", async route => {
    remoteRequests++;
    await Promise.race([gate, new Promise(resolve => setTimeout(resolve, 8000))]);
    await route.fulfill({ json: { unchanged: true, revision: 42 } });
  });
  const started = Date.now();
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(4, { timeout: 1800 });
  expect(Date.now() - started).toBeLessThan(2500);
  await expect(page.getByRole("button", { name: "Cloud sync: Checking cloud connection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add relative", exact: true })).toBeDisabled();
  expect(remoteRequests).toBe(1);
  release();
  await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add relative", exact: true })).toBeEnabled();
  expect(remoteRequests).toBe(1);
  await page.screenshot({ path: "verification/startup-cached-library.png" });
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await expect(page.getByText("Evidence Quality Studio", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("render errors show recovery controls instead of an empty window", async ({ page }) => {
  const state = createSeedState(); (state.trees[0] as any).title = { invalid: true };
  await page.addInitScript(state => {
    localStorage.setItem("kinforge-demo-v1", JSON.stringify(state));
    sessionStorage.setItem("kinforge-demo-session", "true");
  }, state);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KinForge could not open this view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen library" })).toBeEnabled();
});

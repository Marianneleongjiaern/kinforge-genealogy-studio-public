import { expect, test, BrowserContext, Page } from "@playwright/test";
import { createSeedState } from "../../src/domain";
const password = "Library-testing-password-42";
test.setTimeout(90000);
async function register(context: BrowserContext, email: string) {
  const response = await context.request.post("/api/auth/register", { data: { email, password, name: "Sync Tester" }, headers: { "X-KinForge-Client": "1", "CF-Connecting-IP": `test-${email}` } });
  expect(response.status(), await response.text()).toBe(201);
}
async function login(context: BrowserContext, email: string) {
  const response = await context.request.post("/api/auth/login", { data: { email, password }, headers: { "X-KinForge-Client": "1", "CF-Connecting-IP": `test-${email}` } });
  expect(response.status(), await response.text()).toBe(200);
}
async function synced(page: Page) { await expect(page.getByRole("button", { name: "Cloud sync: Synced", exact: true })).toBeVisible({ timeout: 20000 }); }
async function editPerson(page: Page, field: string, value: string) {
  await page.getByRole("link", { name: "Family Tree", exact: true }).click();
  await page.locator('.react-flow__node[data-id="person_june"]').click();
  const showMore = page.getByRole("button", { name: "Show more", exact: true }); if (await showMore.isVisible()) await showMore.click();
  await page.locator(".person-inspector").getByLabel(field, { exact: true }).fill(value);
}
test("existing data uploads automatically and two devices sync both ways with account isolation", async ({ browser, baseURL }) => {
  const a = await browser.newContext({ baseURL }), b = await browser.newContext({ baseURL }), c = await browser.newContext({ baseURL });
  try {
    const email = `sync-${Date.now()}@example.test`; await register(a, email); await login(b, email);
    const seed = createSeedState(); seed.books[0].title = "Device family book"; seed.collections.push({ id: "sub-child", parentId: seed.collections[0].id, bookId: seed.books[0].id, name: "Nested branch" });
    seed.reportDrafts.push({ id: "synced-report", treeId: seed.trees[0].id, title: "Saved person report", type: "Person Report", body: "A saved biography", updatedAt: new Date().toISOString() });
    await a.addInitScript(state => { if (!localStorage.getItem("kinforge-genealogy-studio-v1")) localStorage.setItem("kinforge-genealogy-studio-v1", JSON.stringify(state)); }, seed);
    const pa = await a.newPage(); const pb = await b.newPage();
    await pa.goto("/"); await synced(pa);
    await pb.goto("/"); await synced(pb); await expect(pb.locator(".react-flow__node")).toHaveCount(4);
    const librariesBeforeRestart = await b.request.get("/api/libraries");
    const libraryBeforeRestart = (await librariesBeforeRestart.json()).libraries[0].id as string;
    let delayedRemoteFetch = false;
    await pa.close(); await pb.close();
    const paRestart = await a.newPage();
    await paRestart.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    await paRestart.route(new RegExp(`/api/libraries/${libraryBeforeRestart}(?:\\?|$)`), async route => {
      if (route.request().method() === "GET" && !delayedRemoteFetch) {
        delayedRemoteFetch = true;
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
      await route.continue();
    });
    const restartStarted = Date.now();
    await paRestart.goto("/");
    await expect(paRestart.locator(".react-flow__node")).toHaveCount(4, { timeout: 1200 });
    expect(Date.now() - restartStarted).toBeLessThan(2000);
    await synced(paRestart);
    await b.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    const pbAfterRestart = await b.newPage(); await pbAfterRestart.goto("/"); await synced(pbAfterRestart);
    await expect(pbAfterRestart.locator(".react-flow__node")).toHaveCount(4);
    await editPerson(paRestart, "Given name", "Synced June"); await synced(paRestart);
    await expect(pbAfterRestart.locator(".graph-person-heading").getByText("Synced June Chang")).toBeVisible({ timeout: 15000 });
    await editPerson(pbAfterRestart, "Family name", "Cloud Family"); await synced(pbAfterRestart);
    await expect(paRestart.locator(".graph-person-heading").getByText("Synced June Cloud Family")).toBeVisible({ timeout: 15000 });
    const libraries = await b.request.get("/api/libraries"); const libraryId = (await libraries.json()).libraries[0].id;
    const document = await (await b.request.get(`/api/libraries/${libraryId}`)).json();
    expect(document.state.books[0].title).toBe("Device family book"); expect(document.state.collections.some((v: any) => v.id === "sub-child")).toBeTruthy(); expect(document.state.reportDrafts[0].body).toBe("A saved biography");
    await paRestart.getByRole("link", { name: "Reports", exact: true }).click(); await synced(paRestart);
    await pbAfterRestart.getByRole("link", { name: "Reports", exact: true }).click(); await synced(pbAfterRestart);
    await paRestart.getByRole("textbox", { name: "Report draft", exact: true }).fill("Report edited on the first device"); await synced(paRestart);
    await expect(pbAfterRestart.getByRole("textbox", { name: "Report draft", exact: true })).toContainText("Report edited on the first device", { timeout: 15000 });
    await expect(paRestart.locator(".report-saved")).toHaveText("Saved to your account");
    await paRestart.getByRole("button", { name: "Sign Out", exact: true }).click(); await expect(paRestart.getByRole("heading", { name: "Sign in to KinForge" })).toBeVisible();
    const second = `other-${Date.now()}@example.test`; await register(c, second);
    expect((await c.request.get(`/api/libraries/${libraryId}`)).status()).toBe(404);
    await login(a, second); await paRestart.reload(); await synced(paRestart); await expect(paRestart.locator(".react-flow__node")).toHaveCount(0);
    await paRestart.screenshot({ path: "verification/cloud-account-isolation.png" });
  } finally { await a.close(); await b.close(); await c.close(); }
});
test("offline edits survive reload and merge with another device", async ({ browser, baseURL }) => {
  const a = await browser.newContext({ baseURL }), b = await browser.newContext({ baseURL });
  try {
    await a.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    await b.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    const email = `offline-${Date.now()}@example.test`; await register(a, email); await login(b, email);
    await a.addInitScript(state => { if (!localStorage.getItem("kinforge-genealogy-studio-v1")) localStorage.setItem("kinforge-genealogy-studio-v1", JSON.stringify(state)); }, createSeedState());
    const pa = await a.newPage(), pb = await b.newPage(); await pa.goto("/"); await synced(pa); await pb.goto("/"); await synced(pb);
    await a.setOffline(true); await editPerson(pa, "Given name", "Offline June");
    await expect(pa.getByRole("button", { name: /Cloud sync: Waiting for connection/ })).toBeVisible({ timeout: 10000 });
    await editPerson(pb, "Family name", "Other Device"); await synced(pb);
    await pb.close(); await pa.close();
    await a.setOffline(false); const paAfterRestart = await a.newPage(); await paAfterRestart.goto("/"); await synced(paAfterRestart);
    await expect(paAfterRestart.locator(".graph-person-heading").getByText("Offline June Other Device")).toBeVisible({ timeout: 15000 });
    const pbAfterMerge = await b.newPage(); await pbAfterMerge.goto("/"); await synced(pbAfterMerge);
    await expect(pbAfterMerge.locator(".graph-person-heading").getByText("Offline June Other Device")).toBeVisible({ timeout: 15000 });
  } finally { await a.close(); await b.close(); }
});
test("phone and portrait iPad hamburger opens a vertical menu; landscape iPad keeps sidebar", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Continue as guest" }).click();
  for (const size of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1024, height: 1366 }]) {
    await page.setViewportSize(size); const toggle = page.getByRole("button", { name: "Open navigation" }); await expect(toggle).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden(); await toggle.click();
    const links = page.getByRole("navigation", { name: "Workspace" }).getByRole("link"); const first = await links.nth(0).boundingBox(); const second = await links.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y); expect(second!.x).toBe(first!.x);
    await page.getByRole("button", { name: "Close navigation" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `verification/cloud-menu-${size.width}.png` });
  }
  for (const size of [{ width: 1180, height: 820 }, { width: 1024, height: 768 }, { width: 1440, height: 960 }]) {
    await page.setViewportSize(size); await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden(); await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
  }
});

test("same-field conflicts survive reload until the user chooses, then sync the choice", async ({ browser, baseURL }) => {
  const a = await browser.newContext({ baseURL }), b = await browser.newContext({ baseURL });
  try {
    await a.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    await b.addInitScript(() => { Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }); });
    const email = `conflict-${Date.now()}@example.test`; await register(a, email); await login(b, email);
    await a.addInitScript(state => { if (!localStorage.getItem("kinforge-genealogy-studio-v1")) localStorage.setItem("kinforge-genealogy-studio-v1", JSON.stringify(state)); }, createSeedState());
    const pa = await a.newPage(), pb = await b.newPage(); await pa.goto("/"); await synced(pa); await pb.goto("/"); await synced(pb);
    await a.setOffline(true); await editPerson(pa, "Given name", "Device Choice");
    await editPerson(pb, "Given name", "Cloud Choice"); await synced(pb);
    await pb.close(); await pa.close();
    await a.setOffline(false); const paAfterRestart = await a.newPage(); await paAfterRestart.goto("/");
    await expect(paAfterRestart.getByRole("heading", { name: "Changes need your choice" })).toBeVisible();
    await paAfterRestart.close(); const paAfterSecondRestart = await a.newPage(); await paAfterSecondRestart.goto("/");
    await expect(paAfterSecondRestart.getByRole("heading", { name: "Changes need your choice" })).toBeVisible();
    const dialog = paAfterSecondRestart.getByRole("dialog"); await dialog.getByLabel(/This device/).check(); await dialog.getByRole("button", { name: "Save my choices" }).click();
    await synced(paAfterSecondRestart); const pbAfterChoice = await b.newPage(); await pbAfterChoice.goto("/"); await synced(pbAfterChoice);
    await expect(pbAfterChoice.locator(".graph-person-heading").getByText("Device Choice Chang")).toBeVisible({ timeout: 15000 });
  } finally { await a.close(); await b.close(); }
});

import { expect, test } from "@playwright/test";

test("research and requirements stay local across desktop and mobile", async ({ page, context }, testInfo) => {
  const outgoing: string[] = [];
  const base = new URL(testInfo.project.use.baseURL as string).origin;
  context.on("request", request => { const url = new URL(request.url()); if (["http:", "https:"].includes(url.protocol) && url.origin !== base) outgoing.push(url.href); });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Research", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archive Search" })).toBeVisible();
  await expect(page.getByText("Research Website Launcher")).toHaveCount(0);
  await expect(page.getByText("Optional Integrations")).toHaveCount(0);
  await page.getByLabel("Search this tree").fill("Junie");
  await expect(page.locator(".archive-result")).toHaveCount(1);
  await expect(page.locator(".archive-result")).toContainText("June Chang");
  await page.getByLabel("Record kind").selectOption("record");
  await page.getByLabel("Search this tree").fill("birth details");
  await expect(page.locator(".archive-result")).toContainText("Civil birth registration index");
  await page.screenshot({ path: testInfo.outputPath("local-research-desktop.png"), fullPage: true });
  await context.setOffline(true);
  await page.getByLabel("Record kind").selectOption("source");
  await page.getByLabel("Search this tree").fill("BC-1988-JC");
  await expect(page.locator(".archive-result")).toContainText("June Chang birth certificate");
  await page.getByRole("link", { name: "Feature Coverage", exact: true }).click();
  await page.getByLabel("Search requirements").fill("cerebral palsy");
  await expect(page.locator(".requirement-passage").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".requirements-register").evaluate(el => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: testInfo.outputPath("requirements-mobile.png") });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Research", exact: true }).click();
  await page.locator(".archive-search-fields").evaluate(el => el.scrollIntoView({ block: "start" }));
  await expect(page.locator(".archive-result")).toContainText("June Chang birth certificate");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("local-research-mobile.png") });
  await context.setOffline(false);
  expect(outgoing).toEqual([]);
});

test("reviewed evidence linking persists and never overwrites vital facts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.records[0].personId = undefined;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("link", { name: "Research", exact: true }).click();
  await page.getByLabel("Research person").selectOption("person_june");
  await page.getByLabel("Record kind").selectOption("record");
  await page.getByLabel("Search this tree").fill("birth details");
  await page.getByRole("button", { name: "Link to June Chang", exact: true }).click();
  await expect(page.locator(".archive-result")).toContainText("Linked to June Chang");
  await page.reload();
  const result = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    const p = s.people.find((entry: { id: string }) => entry.id === "person_june");
    return { linked: s.records[0].personId, birth: p.birthDate, sources: p.sourceIds };
  });
  expect(result.linked).toBe("person_june"); expect(result.birth).toBe("1988-06-12");
  expect(result.sources.filter((id: string) => id === "source_birth")).toHaveLength(1);
});

test("browser policy rejects off-origin service calls", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    let violation = false;
    const observed = new Promise<boolean>(resolve => {
      document.addEventListener("securitypolicyviolation", event => { if (event.violatedDirective === "connect-src") { violation = true; resolve(true); } }, { once: true });
      setTimeout(() => resolve(violation), 1000);
    });
    try { await fetch("https://service.example.invalid/kinforge-test"); } catch { /* Expected policy rejection. */ }
    return observed;
  });
  expect(result).toBe(true);
});

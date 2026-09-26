import { expect, test } from "@playwright/test";

test("maintenance previews, cancels, applies, undoes and saves changes in only the active tree", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.people[0].notes = "Original TEST_TOKEN note";
    state.trees.push({ ...state.trees[0], id: "isolation-tree", title: "Untouched tree" });
    state.people.push({ ...state.people[0], id: "isolation-person", treeId: "isolation-tree" });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Enter the text to find.");
  await page.getByLabel("Find text", { exact: true }).fill("TEST_TOKEN");
  await page.getByLabel("Replace with", { exact: true }).fill("Reviewed");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.locator(".maintenance-preview table")).toContainText("Original Reviewed note");
  const readNotes = () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    return { active: state.people[0].notes, other: state.people.find((p: { id: string }) => p.id === "isolation-person").notes };
  });
  expect(await readNotes()).toEqual({ active: "Original TEST_TOKEN note", other: "Original TEST_TOKEN note" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Cancelled. No changes applied.");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect.poll(readNotes).toEqual({ active: "Original Reviewed note", other: "Original TEST_TOKEN note" });
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect.poll(readNotes).toEqual({ active: "Original TEST_TOKEN note", other: "Original TEST_TOKEN note" });
  await page.getByRole("button", { name: "Redo last change", exact: true }).click();
  await expect.poll(readNotes).toEqual({ active: "Original Reviewed note", other: "Original TEST_TOKEN note" });
  await page.reload();
  expect(await readNotes()).toEqual({ active: "Original Reviewed note", other: "Original TEST_TOKEN note" });
  await page.getByLabel("Find text", { exact: true }).fill("Reviewed");
  await page.getByLabel("Replace with", { exact: true }).fill("Another value");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await page.screenshot({ path: testInfo.outputPath("maintenance-desktop.png"), fullPage: true });
  await page.getByRole("link", { name: "Family Tree", exact: true }).click();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await page.getByRole("navigation", { name: "Person sections" }).getByRole("link", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Given name", { exact: true }).fill("Alexander");
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByRole("status")).toHaveText("The tree changed. Preview the operation again before applying it.");
  await expect.poll(readNotes).toEqual({ active: "Original Reviewed note", other: "Original TEST_TOKEN note" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).people[0].givenName)).toBe("Alexander");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("maintenance-mobile.png"), fullPage: true });
});

test("all maintenance operations offer real previews or a visible no-change result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  for (const operation of ["Normalize dates", "Reformat names", "Remove empty entries", "Repair family links", "Clean media tags"]) {
    await page.getByRole("combobox", { name: "Operation", exact: true }).selectOption(operation);
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByRole("status")).toHaveText(/No changes needed|proposed field or record changes/);
  }
  await expect(page.getByRole("button", { name: "Optimize media", exact: true })).toHaveCount(0);
});

test("evidence studio scores weak profiles and creates targeted research tasks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.evaluate(() => {
    const key = "kinforge-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.people.push({
      ...state.people[0],
      id: "duplicate-june-browser",
      sourceIds: [],
      eventIds: [],
      mediaIds: [],
      facts: [],
      aliases: []
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Evidence Quality Studio", exact: true })).toBeVisible();
  await expect(page.locator(".evidence-card").filter({ hasText: "June Chang" }).first()).toContainText("/100");
  const beforeTodos = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).todos.length);
  await page.locator(".evidence-card").filter({ hasText: "June Chang" }).first().getByRole("button", { name: "Create task" }).first().click();
  await expect(page.getByRole("status")).toContainText("Created a research task");
  const todo = await page.evaluate((before: number) => {
    const state = JSON.parse(localStorage.getItem("kinforge-demo-v1")!);
    return { count: state.todos.length, created: state.todos.find((entry: { title: string }) => entry.title.includes("June Chang:")) };
  }, beforeTodos);
  expect(todo).toBeTruthy();
  expect(todo.count).toBe(beforeTodos + 1);
  expect(todo.created.priority).toMatch(/high|normal/);
});

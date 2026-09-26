import { expect, test, Page } from "@playwright/test";
import { createSeedState } from "../../src/domain";

async function guest(page: Page) {
  const state = createSeedState();
  await page.goto("/");
  await page.evaluate(value => localStorage.setItem("kinforge-demo-v1", JSON.stringify(value)), state);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Terms and meanings", exact: true })).toBeVisible();
  return state;
}

test("religion, belief, and mental-health facts explain, save, and respect privacy", async ({ page }) => {
  const state = await guest(page);
  await page.goto(`/#/trees/tree_demo/people/${state.people[0].id}/edit`);
  const type = page.getByLabel("Fact type", { exact: true });

  await type.selectOption({ label: "Religion" });
  await page.getByLabel("Religion option", { exact: true }).selectOption({ label: "Latter-day Saint" });
  await expect(page.getByLabel("Meaning of Latter-day Saint", { exact: true })).toContainText("self-description");
  await page.getByRole("button", { name: "Add fact", exact: true }).click();
  await expect(page.locator(".compact-row").filter({ hasText: "Latter-day Saint" })).toBeVisible();

  await type.selectOption({ label: "Belief" });
  await page.getByLabel("Belief option", { exact: true }).selectOption({ label: "Ancestor veneration" });
  await expect(page.getByLabel("Meaning of Ancestor veneration", { exact: true })).toContainText("honours");
  await page.getByRole("button", { name: "Add fact", exact: true }).click();

  await type.selectOption({ label: "Mental health condition" });
  await page.getByLabel("Mental health condition option", { exact: true }).selectOption({ label: "Generalized anxiety disorder" });
  await expect(page.getByLabel("Meaning of Generalized anxiety disorder", { exact: true })).toContainText("persistent");
  await page.getByRole("button", { name: "Add fact", exact: true }).click();

  await page.getByText("Add a custom religion, belief, practice, or wellbeing term", { exact: true }).click();
  await page.getByLabel("Custom term category", { exact: true }).selectOption("Religion");
  await page.getByLabel("Custom term name", { exact: true }).fill("Moon Garden Fellowship");
  await page.getByLabel("Custom term meaning", { exact: true }).fill("A fictional family tradition centred on moonlit garden ceremonies and remembrance.");
  await page.getByRole("button", { name: "Save custom term", exact: true }).click();
  await type.selectOption({ label: "Religion" });
  await expect(page.getByLabel("Religion option", { exact: true }).locator("option", { hasText: "Moon Garden Fellowship" })).toHaveCount(1);
  await page.getByLabel("Religion option", { exact: true }).selectOption({ label: "Moon Garden Fellowship" });
  await expect(page.getByLabel("Meaning of Moon Garden Fellowship", { exact: true })).toContainText("fictional family tradition");

  await expect(page.locator(".compact-row").filter({ hasText: "Ancestor veneration" })).toBeVisible();
  await expect(page.locator(".compact-row").filter({ hasText: "Generalized anxiety disorder" })).toBeVisible();
  await page.getByRole("button", { name: "Add fact", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!));
  const facts = saved.people[0].facts.filter((fact: { value: string }) => ["Latter-day Saint", "Ancestor veneration", "Generalized anxiety disorder", "Moon Garden Fellowship"].includes(fact.value));
  expect(facts).toHaveLength(4);
  expect(facts.every((fact: { private?: boolean }) => fact.private === true)).toBe(true);

  await page.getByRole("button", { name: "Terms and meanings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Terms and meanings", exact: true });
  await dialog.getByLabel("Search terms", { exact: true }).fill("Latter-day Saint");
  await expect(dialog.locator(".terms-list")).toContainText("self-description");
  await dialog.getByLabel("Search terms", { exact: true }).fill("mental health");
  await expect(dialog.locator(".terms-list")).toContainText("Mental health and neurodevelopment");
  await dialog.getByLabel("Search terms", { exact: true }).fill("Moon Garden Fellowship");
  await expect(dialog.locator(".terms-list")).toContainText("fictional family tradition");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Religious terms", exact: true }).click();
  const religiousDialog = page.getByRole("dialog", { name: "Religious terms and practices", exact: true });
  await religiousDialog.getByLabel("Search religious terms", { exact: true }).fill("veiling");
  await expect(religiousDialog.locator(".terms-list")).toContainText("Catholic veiling practice");
  await religiousDialog.getByLabel("Search religious terms", { exact: true }).fill("Moon Garden Fellowship");
  await expect(religiousDialog.locator(".terms-list")).toContainText("fictional family tradition");
});

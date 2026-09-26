import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await page.getByRole("link", { name: "Access needs", exact: true }).click();
});

test("private annotations save, edit, remain person-specific and can be removed", async ({ page }) => {
  await page.getByRole("button", { name: "Add annotation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save annotation" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Find an annotation symbol" })).toBeFocused();
  await page.getByRole("textbox", { name: "Find an annotation symbol" }).fill("captions");
  await page.getByRole("radio", { name: "Captions", exact: true }).check();
  await page.getByRole("textbox", { name: "Details in the person's preferred terms" }).fill("Sample caption preference");
  await page.getByRole("combobox", { name: "Source", exact: true }).selectOption({ label: "Interview with Mei Tan" });
  await page.getByRole("button", { name: "Save annotation" }).click();
  await page.reload();
  const region = page.getByRole("region", { name: "Disability and access needs", exact: true });
  await expect(region).toContainText("Sample caption preference");
  await expect(region).toContainText("Interview with Mei Tan");
  await page.getByRole("button", { name: "Edit Captions", exact: true }).click();
  await page.getByRole("textbox", { name: "Details in the person's preferred terms" }).fill("Revised caption preference");
  await page.getByRole("button", { name: "Save annotation" }).click();
  await expect(region).toContainText("Revised caption preference");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("region", { name: "Private disability and access needs" })).toContainText("Captions");
  await page.getByRole("link", { name: /^Mei Tan 1961/ }).click();
  await page.getByRole("link", { name: "Access needs", exact: true }).click();
  await expect(region).toContainText("No disability or access needs recorded.");
  await page.goto("/#/trees/tree_demo/people/person_alex/access");
  await page.getByRole("button", { name: "Remove Captions", exact: true }).click();
  await page.reload();
  await expect(region).toContainText("No disability or access needs recorded.");
});

test("legend search, cancellation and mobile picker layout", async ({ page }) => {
  await page.getByRole("button", { name: "Symbol legend", exact: true }).click();
  await page.getByRole("textbox", { name: "Search symbols" }).fill("annulment");
  await expect(page.locator(".glyph-legend-row")).toHaveCount(1);
  await expect(page.locator(".glyph-legend-row")).toContainText("Annulment");
  await page.getByRole("button", { name: "Close symbol legend" }).click();
  await expect(page.getByRole("button", { name: "Symbol legend", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add annotation", exact: true }).click();
  await page.getByRole("textbox", { name: "Find an annotation symbol" }).fill("keyboard");
  await page.getByRole("radio", { name: "Keyboard or switch access" }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Save annotation" })).toBeInViewport();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("region", { name: "Disability and access needs", exact: true })).toContainText("No disability or access needs recorded.");
});

test("disability glyphs are separate, searchable and preserve a person's own label", async ({ page }) => {
  await page.getByRole("button", { name: "Add annotation", exact: true }).click();
  await page.getByRole("button", { name: "Disabilities", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Captions", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Find an annotation symbol" }).fill("CP");
  await page.getByRole("radio", { name: "Cerebral palsy (CP)", exact: true }).check();
  await page.getByRole("textbox", { name: "Record label", exact: true }).fill("Possible CP - sample record");
  await page.getByRole("button", { name: "Save annotation", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Disabilities", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Possible CP - sample record", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Possible CP - sample record", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Record label", exact: true })).toHaveValue("Possible CP - sample record");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add annotation", exact: true }).click();
  await page.getByRole("button", { name: "Access needs", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Cerebral palsy (CP)", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Find an annotation symbol" }).fill("captions");
  await page.getByRole("radio", { name: "Captions", exact: true }).check();
  await page.getByRole("button", { name: "Save annotation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Disabilities", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access needs", exact: true })).toBeVisible();
});

import { expect, test, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSeedState } from "../../src/domain";

async function guest(page: Page) {
  const state = createSeedState();
  await page.goto("/");
  await page.evaluate(value => localStorage.setItem("kinforge-demo-v1", JSON.stringify(value)), state);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Terms and meanings", exact: true })).toBeVisible();
  return state;
}

test("searchable plain-language meanings work on desktop and phone", async ({ page }) => {
  await guest(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.getByRole("button", { name: "Terms and meanings", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Terms and meanings", exact: true });
    await dialog.getByLabel("Search terms", { exact: true }).fill("civil union");
    await expect(dialog.locator(".terms-list")).toContainText("legally recognised couple relationship");
    await dialog.getByLabel("Search terms", { exact: true }).fill("custody removal");
    await expect(dialog.locator(".terms-list")).toContainText("Custody removal");
    await dialog.getByLabel("Search terms", { exact: true }).fill("zzz-no-such-term");
    await expect(dialog.getByRole("status")).toHaveText("No matching terms.");
    await dialog.getByRole("button", { name: "Clear search" }).click();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `verification/terms-${width}.png` });
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Terms and meanings", exact: true })).toBeFocused();
  }
});

test("person protection records validate, save, edit, download and delete", async ({ page }) => {
  const state = await guest(page);
  await page.goto(`/#/trees/tree_demo/people/${state.people[0].id}/edit`);
  await page.getByLabel("Sensitive detail visibility", { exact: true }).selectOption("shared");
  const panel = page.locator(".protection-panel");
  await panel.getByRole("button", { name: "Add record", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add protection or government record" });
  await dialog.getByLabel("Record type", { exact: true }).selectOption("Custody Removal");
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Recorded in source");
  await dialog.getByLabel("Start date", { exact: true }).fill("2026-02-30");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Check the marked fields");
  await dialog.getByLabel("Start date", { exact: true }).fill("2026-02-01");
  await dialog.getByLabel("End date", { exact: true }).fill("2026-01-01");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(dialog.getByText("End date cannot be before start date.")).toBeVisible();
  await dialog.getByLabel("End date", { exact: true }).fill("2026-03-01");
  await dialog.getByLabel("Agency", { exact: true }).fill("Synthetic test agency");
  await dialog.getByLabel("Notes", { exact: true }).fill("Synthetic record, not a real person.");
  await dialog.getByLabel("Visibility", { exact: true }).selectOption("shared");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(dialog).toHaveCount(0); await page.reload();
  await expect(panel).toContainText("Custody Removal");
  await expect(page.getByLabel("Sensitive detail visibility", { exact: true })).toHaveValue("shared");
  await panel.getByRole("button", { name: "Edit Custody Removal" }).click();
  dialog = page.getByRole("dialog", { name: "Edit protection or government record" });
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Reviewed");
  await dialog.getByLabel("Visibility", { exact: true }).selectOption("private");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(panel).toContainText("Reviewed"); await expect(panel).toContainText("Private to your account");
  const downloading = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download Custody Removal" }).click();
  const download = await downloading; const file = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(JSON.stringify(file)).toContain("Synthetic test agency");
  await page.screenshot({ path: "verification/protection-person-desktop.png", fullPage: true });
  await panel.getByRole("button", { name: "Delete Custody Removal" }).click();
  const confirm = page.getByRole("dialog", { name: /Delete protection/ });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panel).toContainText("Custody Removal");
  await panel.getByRole("button", { name: "Delete Custody Removal" }).click();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(panel).toContainText("No protection or government records recorded.");
});

test("family and relationship records stay attached to their own scope", async ({ page }) => {
  await guest(page); await page.goto("/#/trees/tree_demo/families");
  const family = page.locator(".family-card").first();
  await family.locator(".family-protection > summary").click();
  await family.getByRole("button", { name: "Add record", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add protection or government record" });
  await dialog.getByLabel("Record type", { exact: true }).selectOption("Government Protection Status");
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Family record test");
  await dialog.getByRole("button", { name: "Save record" }).click();
  const relationship = page.locator(".relationship-record-details").first();
  await relationship.locator(":scope > summary").click();
  await relationship.getByRole("button", { name: "Add record", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Add protection or government record" });
  await dialog.getByLabel("Record type", { exact: true }).selectOption("Custody Change");
  await dialog.getByLabel("Recorded status", { exact: true }).fill("Relationship record test");
  await dialog.getByRole("button", { name: "Save record" }).click();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!).protectionRecords);
  expect(records).toHaveLength(2); expect(records.map((r: { entityKind: string }) => r.entityKind).sort()).toEqual(["family", "relationship"]);
  await expect(family).not.toContainText("Relationship record test");
  await expect(relationship).not.toContainText("Family record test");
  await page.setViewportSize({ width: 390, height: 844 });
  await relationship.getByRole("button", { name: "Edit Custody Change" }).click();
  dialog = page.getByRole("dialog", { name: "Edit protection or government record" });
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: "verification/protection-mobile.png" });
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});

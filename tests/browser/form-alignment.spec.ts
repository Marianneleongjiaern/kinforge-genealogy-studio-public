import { expect, test, type Page } from "@playwright/test";
import { createSeedState } from "../../src/domain";
test.setTimeout(90000);

async function checkFields(page: Page) {
  const problems = await page.evaluate(() => {
    const issues: string[] = [];
    const visible = (element: Element) => element.getClientRects().length > 0;
    const name = (element: Element) => element.getAttribute("aria-label") || element.closest("label")?.textContent?.trim() || element.className;
    for (const element of document.querySelectorAll(".settings-grid .control, .book-block .control, .tree-library-entry .control, .profile-workspace .control")) {
      if (!visible(element)) continue;
      const box = element.getBoundingClientRect();
      const container = element.closest(".book-block, .settings-grid, .tree-library-entry, .inline-form, .compact-row, .profile-workspace")!.getBoundingClientRect();
      if (box.left < container.left - 1 || box.right > container.right + 1) issues.push(`Outside container: ${name(element)}`);
      if (box.left < -1 || box.right > innerWidth + 1) issues.push(`Outside window: ${name(element)}`);
    }
    for (const field of document.querySelectorAll(".settings-grid > .field")) {
      const label = field.querySelector(":scope > span"), control = field.querySelector(".control");
      if (!label || !control || !visible(control)) continue;
      const a = label.getBoundingClientRect(), b = control.getBoundingClientRect();
      if (a.bottom > b.top + 1 || Math.abs(a.left - b.left) > 1) issues.push(`Detached label: ${name(control)}`);
    }
    for (const row of document.querySelectorAll(".book-block, .tree-library-entry")) {
      const bounds = row.getBoundingClientRect();
      const elements = [...row.querySelectorAll(".control, .item-actions")].filter(visible);
      elements.forEach((element, i) => {
        const a = element.getBoundingClientRect();
        if (a.left < bounds.left - 1 || a.right > bounds.right + 1) issues.push(`Escaped row: ${name(element)}`);
        for (const other of elements.slice(i + 1)) {
          const b = other.getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push(`Overlapping controls: ${name(element)} / ${name(other)}`);
        }
      });
    }
    return issues;
  });
  expect(problems).toEqual([]);
  await expect(page.locator(".settings-grid > .field-label, .settings-grid > select.control")).toHaveCount(0);
}

for (const viewport of [{ width: 1440, height: 960 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  test(`fields remain inside panels at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const state = createSeedState();
    state.books[0].title = "Family archives and heritage research with a deliberately long book title";
    state.collections[0].name = "Family correspondence and civil records with a deliberately long collection title";
    await page.addInitScript(state => {
      if (!localStorage.getItem("kinforge-demo-v1")) localStorage.setItem("kinforge-demo-v1", JSON.stringify(state));
      sessionStorage.setItem("kinforge-demo-session", "true");
    }, state);
    for (const route of ["manage-trees", "people/person_june/edit", "places", "charts", "dna"]) {
      await page.goto(`/#/trees/tree_demo/${route}`);
      await expect(page.locator(".settings-grid").first()).toBeVisible();
      await checkFields(page);
      if (route === "manage-trees") await page.screenshot({ path: `verification/alignment-library-${viewport.width}.png`, fullPage: true });
      if (route === "people/person_june/edit") {
        await page.getByLabel("Given name", { exact: true }).fill("June Aligned");
        await page.getByRole("combobox", { name: "Gender", exact: true }).selectOption("nonbinary");
        await page.getByLabel("Birth date mode", { exact: true }).selectOption("range");
        await checkFields(page);
        await page.getByLabel("Birth date from").fill("1988-01-01");
        await page.getByLabel("Birth date to").fill("1988-12-31");
        await page.getByLabel("Given name", { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `verification/alignment-person-${viewport.width}.png` });
        await page.reload();
        await expect(page.getByLabel("Given name", { exact: true })).toHaveValue("June Aligned");
        await expect(page.getByRole("combobox", { name: "Gender", exact: true })).toHaveValue("nonbinary");
      }
    }
  });
}

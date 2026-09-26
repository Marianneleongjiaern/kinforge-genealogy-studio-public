import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("trees, nested collections and reports can be placed in a chosen book", async ({ page }) => {
  await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manage Trees, Books, Collections" })).toBeVisible();

  await page.getByRole("button", { name: "Book", exact: true }).click();
  const newBook = page.getByLabel("Book for Chang and Tan lines");
  await newBook.selectOption({ label: "New genealogy book" });
  await expect(page.getByLabel("Book for Chang and Tan lines")).toHaveValue(/book_/);

  const treeBook = page.getByLabel("Book for tree Chang-Tan working tree");
  await treeBook.selectOption({ label: "New genealogy book" });
  const treeCollection = page.getByLabel("Collection for tree Chang-Tan working tree");
  await treeCollection.selectOption({ label: "Chang and Tan lines" });

  const nestedParent = page.getByLabel("Parent collection for Civil records and government files");
  await nestedParent.selectOption("collection_dna");
  await page.reload();
  await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await expect(page.getByLabel("Collection for tree Chang-Tan working tree")).toHaveValue("collection_chang");
  await expect(page.getByLabel("Parent collection for Civil records and government files")).toHaveValue("collection_dna");

  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report book").selectOption({ label: "New genealogy book" });
  await page.getByLabel("Report collection").selectOption({ label: "Chang and Tan lines" });
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(page.getByLabel("Saved drafts")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!));
  const draft = stored.reportDrafts.at(-1);
  expect(draft.bookId).toBe(stored.books.find((book: { title: string }) => book.title === "New genealogy book").id);
  expect(draft.collectionId).toBe("collection_chang");
  expect(stored.trees[0].bookId).toBe(draft.bookId);
  expect(stored.trees[0].collectionId).toBe("collection_chang");
});

test("a report placement survives reload and follows its collection to another book", async ({ page }) => {
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report book").selectOption({ label: "KinForge Research Book" });
  await page.getByLabel("Report collection").selectOption({ label: "Chang and Tan lines" });
  await page.getByRole("button", { name: "Generate Editable Draft", exact: true }).click();
  await expect(page.getByLabel("Report collection")).toHaveValue("collection_chang");
  await page.reload();
  await expect(page.getByLabel("Report book")).toHaveValue("book_kin");
  await expect(page.getByLabel("Report collection")).toHaveValue("collection_chang");

  await page.getByRole("link", { name: "Manage Trees", exact: true }).click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await page.getByLabel("Book for Chang and Tan lines").selectOption({ label: "New genealogy book" });
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Report book")).not.toHaveValue("book_kin");
  await expect(page.getByLabel("Report collection")).toHaveValue("collection_chang");
});

for (const width of [1440, 390]) {
  test(`multiple named collections and subcollections expand independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/#/trees/tree_demo/manage-trees");
    const book = page.getByRole("group", { name: "Book: KinForge Research Book", exact: true });
    await book.getByRole("button", { name: "Add collection to KinForge Research Book", exact: true }).click();
    await book.getByRole("button", { name: "Add collection to KinForge Research Book", exact: true }).click();
    await book.getByLabel("Collection name for New collection", { exact: true }).fill("Paternal records");
    await book.getByLabel("Collection name for New collection 2", { exact: true }).fill("Maternal records");
    for (const parent of ["Paternal records", "Maternal records"]) {
      const collection = book.getByRole("group", { name: `Collection: ${parent}`, exact: true });
      await collection.getByRole("button", { name: `Add subcollection to ${parent}`, exact: true }).click();
      await collection.getByRole("button", { name: `Add subcollection to ${parent}`, exact: true }).click();
      await collection.getByLabel("Subcollection name for New subcollection", { exact: true }).fill("Birth records");
      await collection.getByLabel("Subcollection name for New subcollection 2", { exact: true }).fill("Marriage records");
      await expect(collection.getByRole("group", { name: "Subcollection: Birth records", exact: true })).toBeVisible();
      await expect(collection.getByRole("group", { name: "Subcollection: Marriage records", exact: true })).toBeVisible();
    }
    const paternal = book.getByRole("group", { name: "Collection: Paternal records", exact: true });
    const maternal = book.getByRole("group", { name: "Collection: Maternal records", exact: true });
    await paternal.getByRole("button", { name: "Collapse Paternal records", exact: true }).click();
    await expect(paternal.getByRole("button", { name: "Expand Paternal records", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect(paternal.getByLabel("Subcollection name for Birth records", { exact: true })).toBeHidden();
    await expect(maternal.getByLabel("Subcollection name for Birth records", { exact: true })).toBeVisible();
    await paternal.getByRole("button", { name: "Expand Paternal records", exact: true }).press("Enter");
    await expect(paternal.getByLabel("Subcollection name for Birth records", { exact: true })).toBeVisible();
    await paternal.getByRole("button", { name: "Collapse Birth records", exact: true }).click();
    await expect(paternal.getByLabel("Book for Birth records", { exact: true })).toBeHidden();
    await paternal.getByRole("button", { name: "Expand Birth records", exact: true }).click();
    await expect(paternal.getByLabel("Book for Birth records", { exact: true })).toBeVisible();
    await page.reload();
    await expect(paternal.getByLabel("Subcollection name for Birth records", { exact: true })).toHaveValue("Birth records");
    const options = await page.getByLabel("Active tree collection", { exact: true }).locator("option").allTextContents();
    expect(options).toContain("Paternal records / Birth records");
    expect(options).toContain("Maternal records / Birth records");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!));
    for (const parent of ["Paternal records", "Maternal records"]) {
      const collection = stored.collections.find((entry: { name: string }) => entry.name === parent);
      expect(collection.parentId).toBeUndefined();
      expect(collection.bookId).toBe("book_kin");
      expect(stored.collections.filter((entry: { parentId?: string }) => entry.parentId === collection.id)).toHaveLength(2);
    }
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    await page.screenshot({ path: `verification/library-hierarchy-${width}.png`, fullPage: true });
  });
}

test("new collections belong to the chosen book, independently of the active tree", async ({ page }) => {
  await page.goto("/#/trees/tree_demo/manage-trees");
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await page.getByRole("button", { name: "Add collection to New genealogy book", exact: true }).click();
  const book = page.getByRole("group", { name: "Book: New genealogy book", exact: true });
  await book.getByLabel("Collection name for New collection", { exact: true }).fill("Second book collection");
  await book.getByRole("button", { name: "Add subcollection to Second book collection", exact: true }).click();
  await expect(book.getByRole("group", { name: "Subcollection: New subcollection", exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kinforge-demo-v1")!));
  const collection = stored.collections.find((entry: { name: string }) => entry.name === "Second book collection");
  expect(collection.bookId).not.toBe(stored.trees[0].bookId);
  await page.reload();
  await expect(book.getByLabel("Subcollection name for New subcollection", { exact: true })).toHaveValue("New subcollection");
});

import { describe, expect, it } from "vitest";
import { createSeedState, normalizeLibraryPlacements } from "./domain";

describe("library placement", () => {
  it("keeps trees and nested collections in the selected book", () => {
    const state = createSeedState();
    state.books.push({ id: "book_other", title: "Other book", description: "" });
    state.collections.push({ id: "collection_other", bookId: "book_other", name: "Other branch" });
    state.trees[0].bookId = "book_other";
    state.trees[0].collectionId = "collection_chang";
    const result = normalizeLibraryPlacements(state);
    expect(result.trees[0].collectionId).toBeUndefined();
    expect(result.collections.find(collection => collection.id === "collection_civil")?.parentId).toBe("collection_chang");
  });

  it("migrates old reports to their tree placement and clears cross-book links", () => {
    const state = createSeedState();
    state.reportDrafts.push({ id: "legacy", treeId: "tree_demo", title: "Legacy report", type: "Person Report", body: "", updatedAt: "2026-01-01" });
    normalizeLibraryPlacements(state);
    expect(state.reportDrafts[0]).toMatchObject({ bookId: "book_kin", collectionId: "collection_chang" });
    state.books.push({ id: "book_other", title: "Other book", description: "" });
    state.reportDrafts[0].bookId = "book_other";
    state.reportDrafts[0].collectionId = "collection_chang";
    normalizeLibraryPlacements(state);
    expect(state.reportDrafts[0].collectionId).toBeUndefined();
  });
});

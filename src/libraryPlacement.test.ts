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
    const destination = result.collections.find(collection => collection.id === result.trees[0].collectionId);
    expect(destination).toMatchObject({ bookId: "book_other", parentId: "collection_other" });
    expect(result.trees[0].collectionId).not.toBe("collection_chang");
    expect(result.collections.find(collection => collection.id === "collection_civil")?.parentId).toBe("collection_chang");
    const collectionCount = result.collections.length;
    normalizeLibraryPlacements(result);
    expect(result.trees[0].collectionId).toBe(destination!.id);
    expect(result.collections).toHaveLength(collectionCount);
  });

  it("migrates old reports to their tree placement and clears cross-book links", () => {
    const state = createSeedState();
    state.reportDrafts.push({ id: "legacy", treeId: "tree_demo", title: "Legacy report", type: "Person Report", body: "", updatedAt: "2026-01-01" });
    normalizeLibraryPlacements(state);
    expect(state.reportDrafts[0]).toMatchObject({ bookId: "book_kin", collectionId: "collection_civil" });
    expect(state.reportDrafts[0].collectionId).toBe(state.trees[0].collectionId);
    expect(state.collections.find(collection => collection.id === state.reportDrafts[0].collectionId)?.parentId).toBe("collection_chang");
    state.books.push({ id: "book_other", title: "Other book", description: "" });
    state.reportDrafts[0].bookId = "book_other";
    state.reportDrafts[0].collectionId = "collection_chang";
    normalizeLibraryPlacements(state);
    expect(state.reportDrafts[0].collectionId).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { createSeedState, normalizeLibraryPlacements } from "./domain";
import { addLibraryCollection, collectionDescendants, collectionHierarchy, collectionOptions, moveLibraryCollection } from "./libraryHierarchy";

describe("book, collection and subcollection hierarchy", () => {
  it("creates multiple independent collections per book and multiple children per collection", () => {
    const state = createSeedState();
    const a = addLibraryCollection(state, "book_kin")!;
    const b = addLibraryCollection(state, "book_kin")!;
    const a1 = addLibraryCollection(state, "book_kin", a.id)!;
    const a2 = addLibraryCollection(state, "book_kin", a.id)!;
    const b1 = addLibraryCollection(state, "book_kin", b.id)!;
    expect(a.name).toBe("New collection");
    expect(b.name).toBe("New collection 2");
    expect(a1.name).toBe("New subcollection");
    expect(a2.name).toBe("New subcollection 2");
    const hierarchy = collectionHierarchy(state.collections, "book_kin");
    expect(hierarchy.find(branch => branch.collection.id === a.id)?.children.map(branch => branch.collection.id)).toEqual([a1.id, a2.id]);
    expect(hierarchy.find(branch => branch.collection.id === b.id)?.children.map(branch => branch.collection.id)).toEqual([b1.id]);
  });

  it("orders children under their own parents and displays full paths after rename", () => {
    const state = createSeedState();
    state.collections.reverse();
    state.collections.find(collection => collection.id === "collection_chang")!.name = "Family records";
    const options = collectionOptions(state.collections, "book_kin");
    expect(options[0]).toEqual({ id: "collection_chang", label: "Family records" });
    expect(options.find(option => option.id === "collection_civil")?.label).toBe("Family records / Civil records and government files");
  });

  it("moves a whole branch with its trees and reports while preserving unrelated content", () => {
    const state = createSeedState();
    state.books.push({ id: "other", title: "Other", description: "" });
    const report = { id: "report", treeId: "tree_demo", bookId: "book_kin", collectionId: "collection_civil", title: "Report", type: "Person Report", body: "Evidence", updatedAt: "2026-09-26" };
    state.reportDrafts.push(report, { ...report, id: "unfiled", collectionId: undefined });
    const people = structuredClone(state.people);
    expect(moveLibraryCollection(state, "collection_chang", "other")).toBe(true);
    normalizeLibraryPlacements(state);
    expect(state.collections.every(collection => collection.bookId === "other")).toBe(true);
    expect(state.trees[0]).toMatchObject({ bookId: "other", collectionId: "collection_civil" });
    expect(state.reportDrafts[0]).toMatchObject({ bookId: "other", collectionId: "collection_civil", body: "Evidence" });
    expect(state.reportDrafts[1].bookId).toBe("book_kin");
    expect(state.people).toEqual(people);
  });

  it("rejects self, descendant, missing and cross-book parents without mutating data", () => {
    const state = createSeedState();
    state.books.push({ id: "other", title: "Other", description: "" });
    const before = structuredClone(state);
    for (const parent of ["collection_chang", "collection_civil", "missing"]) expect(moveLibraryCollection(state, "collection_chang", "book_kin", parent)).toBe(false);
    expect(moveLibraryCollection(state, "collection_dna", "other", "collection_chang")).toBe(false);
    expect(moveLibraryCollection(state, "collection_chang", "missing")).toBe(false);
    expect(addLibraryCollection(state, "other", "collection_chang")).toBeUndefined();
    expect(state).toEqual(before);
  });

  it("reparents a subcollection without changing its identity or name", () => {
    const state = createSeedState();
    const parent = addLibraryCollection(state, "book_kin")!;
    expect(moveLibraryCollection(state, "collection_civil", "book_kin", parent.id)).toBe(true);
    expect(collectionDescendants(state.collections, "collection_chang").has("collection_civil")).toBe(false);
    expect(collectionHierarchy(state.collections, "book_kin").find(branch => branch.collection.id === parent.id)?.children[0].collection).toMatchObject({ id: "collection_civil", name: "Civil records and government files" });
  });

  it("keeps every legacy node visible and repairs cycles without deleting collections", () => {
    const state = createSeedState();
    state.collections[0].parentId = "collection_civil";
    state.collections.push({ id: "orphan", bookId: "book_kin", parentId: "missing", name: "Recovered" });
    expect(collectionOptions(state.collections, "book_kin")).toHaveLength(4);
    normalizeLibraryPlacements(state);
    expect(state.collections).toHaveLength(4);
    expect(collectionOptions(state.collections, "book_kin")).toHaveLength(4);
    expect(state.collections.find(collection => collection.id === "orphan")?.parentId).toBeUndefined();
    for (const collection of state.collections) expect(collectionDescendants(state.collections, collection.id).has(collection.id)).toBe(false);
  });

  it("moves legacy active trees into subcollections instead of top-level collections", () => {
    const state = createSeedState();
    state.trees[0].collectionId = "collection_chang";
    normalizeLibraryPlacements(state);
    const treeCollection = state.collections.find(collection => collection.id === state.trees[0].collectionId);
    expect(treeCollection?.parentId).toBe("collection_chang");
    expect(treeCollection?.name).toBe("Civil records and government files");
  });
});

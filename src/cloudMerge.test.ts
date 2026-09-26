import { describe, expect, it } from "vitest";
import { mergeCloudState } from "./cloudMerge";
describe("account library three-way sync", () => {
  const base = { people: [{ id: "a", name: "Ada", bio: "Original", events: [{ id: "e", date: "1900" }] }], books: [{ id: "b", title: "Family" }], collections: [{ id: "c", parentId: "root", name: "Branch" }], labels: ["family"] };
  it("merges different person fields, nested events, books and subcollections", () => {
    const local = structuredClone(base), remote = structuredClone(base);
    local.people[0].name = "Ada Rose"; local.books[0].title = "Our Family";
    remote.people[0].bio = "New biography"; remote.people[0].events[0].date = "1901"; remote.collections[0].name = "Maternal branch";
    const result = mergeCloudState(base, local, remote);
    expect(result.conflicts).toEqual([]);
    expect(result.state.people[0]).toMatchObject({ name: "Ada Rose", bio: "New biography", events: [{ date: "1901" }] });
    expect(result.state.books[0].title).toBe("Our Family"); expect(result.state.collections[0].name).toBe("Maternal branch");
  });
  it("retains both simultaneous additions and propagates a deletion", () => {
    const local = structuredClone(base), remote = structuredClone(base);
    local.books.push({ id: "l", title: "Local" }); remote.books.push({ id: "r", title: "Remote" }); local.collections = [];
    const result = mergeCloudState(base, local, remote);
    expect(result.state.books.map(b => b.id).sort()).toEqual(["b", "l", "r"]); expect(result.state.collections).toEqual([]); expect(result.conflicts).toEqual([]);
  });
  it("blocks a same-field overwrite until its value is chosen", () => {
    const local = structuredClone(base), remote = structuredClone(base); local.people[0].name = "Local"; remote.people[0].name = "Remote";
    const result = mergeCloudState(base, local, remote); expect(result.conflicts).toHaveLength(1);
    const resolved = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "remote" });
    expect(resolved.conflicts).toEqual([]); expect(resolved.state.people[0].name).toBe("Remote");
  });
  it("does not resurrect a deleted record or discard an edit without a conflict", () => {
    const local = structuredClone(base), remote = structuredClone(base); local.people = []; remote.people[0].bio = "Edited elsewhere";
    const result = mergeCloudState(base, local, remote); expect(result.conflicts[0].path).toBe("people[a]");
    expect(mergeCloudState(base, local, remote, { "people[a]": "remote" }).state.people[0].bio).toBe("Edited elsewhere");
  });
  it("merges tag additions and removals", () => {
    const local = { ...base, labels: ["new"] }, remote = { ...base, labels: ["family", "remote"] };
    expect(mergeCloudState(base, local, remote).state.labels.sort()).toEqual(["new", "remote"]);
  });
});

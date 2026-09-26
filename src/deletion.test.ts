import { describe, expect, it } from "vitest";
import { createEmptyPerson, createSeedState } from "./domain";
import { applyDeletion, DELETABLE_RECORDS, deletionEntries, planDeletion } from "./deletion";
import { buildItemDownload } from "./itemDownloads";
import { mergeCloudState } from "./cloudMerge";
import { createProtectionRecord } from "./protection";

function fixture() {
  const state = createSeedState();
  state.books.push({ id: "book_other", title: "Other book", description: "Keep" });
  state.collections.push({ id: "nested", bookId: state.books[0].id, parentId: state.collections[0].id, name: "Nested collection" });
  state.trees.push({ ...state.trees[0], id: "nested_tree", collectionId: "nested", title: "Nested tree" }, { ...state.trees[0], id: "other", bookId: "book_other", collectionId: undefined, title: "Keep tree" });
  state.people.push({ ...createEmptyPerson("nested_tree"), id: "nested_person", givenName: "Nested" }, { ...createEmptyPerson("other"), id: "other_person", givenName: "Other" });
  state.reportDrafts.push({ id: "report", treeId: "tree_demo", personId: state.people[0].id, title: "Person report", type: "Person Report", body: "Sensitive story", updatedAt: "2026-01-01" });
  state.people[0].facts.push({ id: "fact_test", type: "Height", value: "165 cm", sourceIds: [state.sources[0].id] });
  state.people[0].accessNeeds = [{ id: "access_test", glyphId: "need-blind", label: "Blind", detail: "Screen reader", private: true, sourceId: state.sources[0].id }];
  state.customEventTypes = ["Custom occasion"]; state.customFactTypes = ["Favourite book"]; state.customFamilyTypes = ["My household"]; state.customRelationshipSubtypes = ["Mentor"];
  state.media[0].dataUrl = "data:application/pdf;base64,JVBERi0xLjcK";
  state.protectionRecords = [
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "person", entityId: state.people[0].id }), id: "protection_person", type: "Custody Removal", caseReference: "CASE-123", notes: "Supplied person record", sourceIds: [state.sources[0].id], mediaIds: [state.media[0].id] },
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "family", entityId: state.families[0].id }, false), id: "protection_family", type: "Care Arrangement", notes: "Supplied family record" },
    { ...createProtectionRecord({ treeId: "tree_demo", entityKind: "relationship", entityId: "rel_alex_june" }), id: "protection_relationship", type: "Custody Change", notes: "Supplied relationship record" },
    { ...createProtectionRecord({ treeId: "nested_tree", entityKind: "person", entityId: "nested_person" }), id: "protection_nested", type: "Government Record" },
    { ...createProtectionRecord({ treeId: "other", entityKind: "person", entityId: "other_person" }), id: "protection_other", type: "Government Record", notes: "Keep other tree record" }
  ];
  return state;
}

describe("confirmed item deletion", () => {
  it("deletes a collection's descendants while preserving other books and trees", () => {
    const state = fixture(), before = structuredClone(state);
    const plan = planDeletion(state, { kind: "collections", id: state.collections[0].id });
    expect(plan.removed.trees?.size).toBe(2);
    const next = applyDeletion(state, plan.target);
    expect(next.trees.map(t => t.id)).toEqual(["other"]);
    expect(next.people.map(p => p.id)).toEqual(["other_person"]);
    expect(next.reportDrafts).toEqual([]);
    expect(next.protectionRecords?.map(record => record.id)).toEqual(["protection_other"]);
    expect(next.books).toEqual(state.books);
    expect(next.collections).toEqual([]);
    expect(state).toEqual(before);
  });
  it("can delete the last book and retains library-wide templates", () => {
    const state = createSeedState(), next = applyDeletion(state, { kind: "books", id: state.books[0].id });
    for (const key of ["books", "collections", "trees", "people", "relationships", "families", "places", "sources", "media", "todos", "dnaMatches", "records", "protectionRecords", "reportDrafts"] as const) expect(next[key]).toEqual([]);
    expect(next.placeTemplates).toEqual(state.placeTemplates);
  });
  it("removes a person and links, but preserves an event used by another person", () => {
    const state = fixture(); const id = state.people[0].id;
    state.people[0].eventIds = [state.events[0].id]; state.people[1].eventIds.push(state.events[0].id);
    const next = applyDeletion(state, { kind: "people", id });
    expect(next.people).toHaveLength(state.people.length - 1);
    expect(next.relationships.every(r => r.fromId !== id && r.toId !== id)).toBe(true);
    expect(next.families.every(f => !f.partnerIds.includes(id) && !f.childIds.includes(id))).toBe(true);
    expect(next.events.some(e => e.id === state.events[0].id)).toBe(true);
    expect(next.media).toHaveLength(state.media.length);
    expect(next.media.every(m => m.assignedTo.every(a => a.id !== id))).toBe(true);
    expect(next.protectionRecords?.map(record => record.id)).toEqual(["protection_family", "protection_nested", "protection_other"]);
  });
  it("cleans source, media, place and nested fact references", () => {
    const state = fixture(); const source = state.sources[0].id, media = state.media[0].id, place = state.places[0].id;
    let next = applyDeletion(state, { kind: "sources", id: source });
    expect(next.people.flatMap(p => p.sourceIds)).not.toContain(source);
    expect(next.people[0].facts.find(f => f.id === "fact_test")?.sourceIds).toEqual([]);
    expect(next.people[0].accessNeeds?.[0].sourceId).toBeUndefined();
    expect(next.protectionRecords?.find(record => record.id === "protection_person")?.sourceIds).toEqual([]);
    next = applyDeletion(next, { kind: "media", id: media });
    expect(next.people.some(p => p.profileMediaId === media)).toBe(false);
    expect(next.protectionRecords?.find(record => record.id === "protection_person")?.mediaIds).toEqual([]);
    next = applyDeletion(next, { kind: "places", id: place });
    expect(next.events.some(e => e.placeId === place)).toBe(false);
    next = applyDeletion(next, { kind: "facts", ownerId: state.people[0].id, id: "fact_test" });
    expect(next.people[0].facts.some(f => f.id === "fact_test")).toBe(false);
  });
  it("has a working delete path for every stored item kind", () => {
    const state = fixture();
    for (const kind of Object.keys(DELETABLE_RECORDS) as (keyof typeof DELETABLE_RECORDS)[]) {
      const entry = deletionEntries(state, kind)[0];
      expect(entry, kind).toBeDefined();
      const next = applyDeletion(state, entry.target);
      expect(deletionEntries(next, kind).some(e => e.target.id === entry.target.id && e.target.ownerId === entry.target.ownerId), kind).toBe(false);
    }
  });
  it("does nothing for a stale deletion target", () => { const state = fixture(); expect(applyDeletion(state, { kind: "trees", id: "missing" })).toBe(state); });

  it("deletes family-owned protection records while keeping people and relationships", () => {
    const state = fixture(), target = { kind: "families" as const, id: state.families[0].id };
    const plan = planDeletion(state, target), next = applyDeletion(state, target);
    expect(plan.removed.protectionRecords).toEqual(new Set(["protection_family"]));
    expect(plan.counts).toContainEqual({ label: "Protection or government record", count: 1 });
    expect(next.protectionRecords?.some(record => record.id === "protection_family")).toBe(false);
    expect(next.people).toEqual(state.people); expect(next.relationships).toEqual(state.relationships);
  });

  it("resyncs children after the last parent link is removed without deleting family records", () => {
    const state = fixture();
    const afterFirst = applyDeletion(state, { kind: "relationships", id: "rel_alex_june" });
    expect(afterFirst.families[0].childIds).toContain("person_june");
    expect(afterFirst.protectionRecords?.some(record => record.id === "protection_relationship")).toBe(false);
    const afterLast = applyDeletion(afterFirst, { kind: "relationships", id: "rel_mei_june" });
    expect(afterLast.families).toEqual([{ ...state.families[0], childIds: [] }]);
    expect(afterLast.people).toEqual(state.people);
    expect(afterLast.protectionRecords?.some(record => record.id === "protection_family")).toBe(true);
  });

  it("preserves family membership when deleting a partner relationship", () => {
    const state = fixture(), next = applyDeletion(state, { kind: "relationships", id: "rel_alex_mei" });
    expect(next.families).toEqual(state.families);
  });

  it("deletes a protection record without deleting its entity, citations or attachments", () => {
    const state = fixture(), next = applyDeletion(state, { kind: "protectionRecords", id: "protection_person" });
    expect(next.people).toEqual(state.people); expect(next.sources).toEqual(state.sources); expect(next.media).toEqual(state.media);
    expect(next.protectionRecords).toEqual(state.protectionRecords!.filter(record => record.id !== "protection_person"));
  });

  it("labels protection entries by recorded type and entity and scopes them to the requested tree/person", () => {
    const state = fixture(), entries = deletionEntries(state, "protectionRecords", "tree_demo");
    expect(entries.map(entry => entry.title)).toEqual(["Custody Removal: Alex Chang (CASE-123)", "Care Arrangement: Chang-Tan family", "Custody Change: Alex Chang / June Chang (parent-child)"]);
    expect(deletionEntries(state, "protectionRecords", "tree_demo", "person_alex")).toEqual([entries[0]]);
    expect(deletionEntries(state, "protectionRecords", "other")).toHaveLength(1);
    delete state.protectionRecords;
    expect(deletionEntries(state, "protectionRecords")).toEqual([]);
    expect(applyDeletion(state, { kind: "protectionRecords", id: "missing" })).toBe(state);
    expect(() => applyDeletion(state, { kind: "trees", id: "tree_demo" })).not.toThrow();
  });
});

describe("item downloads", () => {
  it("exports a collection as a restore-compatible scoped backup including its ancestors", () => {
    const state = fixture(), file = buildItemDownload(state, { kind: "collections", id: "nested" });
    const backup = JSON.parse(file.content as string);
    expect(backup.app).toBe("KinForge Genealogy Studio"); expect(file.name).toMatch(/\.kinforge\.json$/);
    expect(backup.state.trees.map((t: { id: string }) => t.id)).toEqual(["nested_tree"]);
    expect(backup.state.people.map((p: { id: string }) => p.id)).toEqual(["nested_person"]);
    expect(backup.state.collections).toHaveLength(2); expect(backup.state.books).toHaveLength(1);
    expect(backup.state.protectionRecords.map((record: { id: string }) => record.id)).toEqual(["protection_nested"]);
  });
  it("downloads exact stored file bytes and preserves MIME type", () => {
    const state = fixture(); state.media[0].dataUrl = "data:application/pdf;base64,JVBERi0xLjcK"; state.media[0].title = "Private file";
    const file = buildItemDownload(state, { kind: "media", id: state.media[0].id });
    expect(file.name).toBe("Private file.pdf"); expect(file.type).toBe("application/pdf"); expect(new TextDecoder().decode(file.content as Uint8Array)).toBe("%PDF-1.7\n");
  });
  it("builds a nonempty file for every saved-item category without changing the data", () => {
    const state = fixture(), before = structuredClone(state);
    for (const kind of Object.keys(DELETABLE_RECORDS) as (keyof typeof DELETABLE_RECORDS)[]) {
      const file = buildItemDownload(state, deletionEntries(state, kind)[0].target);
      expect(file.content.length, kind).toBeGreaterThan(0); expect(file.name).not.toMatch(/[<>:"/\\|?*]/);
      if (file.type === "application/json") expect(() => JSON.parse(file.content as string)).not.toThrow();
    }
    expect(state).toEqual(before);
  });
  it("downloads the protection record with its citations and stored attachments only", () => {
    const state = fixture(), file = buildItemDownload(state, { kind: "protectionRecords", id: "protection_person" });
    const saved = JSON.parse(file.content as string);
    expect(saved.kind).toBe("protectionRecords"); expect(saved.data).toEqual(state.protectionRecords![0]);
    expect(saved.related.sources).toEqual([state.sources[0]]); expect(saved.related.media).toEqual([state.media[0]]);
    expect(saved.related.people).toBeUndefined(); expect(saved.related.protectionRecords).toEqual([state.protectionRecords![0]]);
    expect(file.name).toBe("Custody Removal- Alex Chang (CASE-123).kinforge.json");
  });
  it.each(["people", "families", "relationships"] as const)("includes cascaded protection records in a %s download", kind => {
    const state = fixture(), id = kind === "people" ? "person_alex" : kind === "families" ? "family_chang_tan" : "rel_alex_june";
    const saved = JSON.parse(buildItemDownload(state, { kind, id }).content as string);
    const expected = kind === "people" ? ["protection_person", "protection_relationship"] : [kind === "families" ? "protection_family" : "protection_relationship"];
    expect(saved.related.protectionRecords.map((record: { id: string }) => record.id)).toEqual(expected);
  });
  it("does not carry unrelated protection records into a tree backup", () => {
    const state = fixture(), saved = JSON.parse(buildItemDownload(state, { kind: "trees", id: "tree_demo" }).content as string);
    expect(saved.state.protectionRecords.map((record: { id: string }) => record.id)).toEqual(["protection_person", "protection_family", "protection_relationship"]);
  });
});

describe("container deletion across devices", () => {
  it.each(["books", "collections", "trees"] as const)("asks before discarding an edit inside deleted %s", kind => {
    const base = fixture(), local = applyDeletion(base, { kind, id: base[kind][0].id }), remote = structuredClone(base);
    remote.people[0].givenName = "Remote edit";
    const result = mergeCloudState(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    const keep = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "remote" });
    expect(keep.conflicts).toEqual([]); expect(keep.state.people.find(p => p.id === base.people[0].id)?.givenName).toBe("Remote edit"); expect(keep.state.trees.some(t => t.id === "tree_demo")).toBe(true);
    const remove = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "local" });
    expect(remove.conflicts).toEqual([]); expect(remove.state.people.some(p => p.treeId === "tree_demo")).toBe(false);
    expect(remove.state.trees.some(t => t.id === "tree_demo")).toBe(false);
  });
  it("preserves unrelated device edits without a conflict", () => {
    const base = fixture(), local = applyDeletion(base, { kind: "trees", id: "tree_demo" }), remote = structuredClone(base);
    remote.people.find(p => p.id === "other_person")!.givenName = "Unrelated edit";
    const result = mergeCloudState(base, local, remote);
    expect(result.conflicts).toEqual([]); expect(result.state.people.find(p => p.id === "other_person")?.givenName).toBe("Unrelated edit");
  });
  it("detects a concurrently added tree inside a deleted book", () => {
    const base = fixture(), local = applyDeletion(base, { kind: "books", id: base.books[0].id }), remote = structuredClone(base);
    remote.trees.push({ ...base.trees[0], id: "new_remote_tree" });
    const result = mergeCloudState(base, local, remote); expect(result.conflicts).toHaveLength(1);
    const keep = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "remote" });
    expect(keep.state.trees.find(t => t.id === "new_remote_tree")).toBeDefined(); expect(keep.state.books.find(b => b.id === base.books[0].id)).toBeDefined();
  });
  it("detects a protection edit inside a deleted tree and restores the chosen side", () => {
    const base = fixture(), local = applyDeletion(base, { kind: "trees", id: "tree_demo" }), remote = structuredClone(base);
    remote.protectionRecords![0].notes = "Remote supplied correction";
    const result = mergeCloudState(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    const keep = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "remote" });
    expect(keep.conflicts).toEqual([]); expect(keep.state.protectionRecords?.find(record => record.id === "protection_person")?.notes).toBe("Remote supplied correction");
    const remove = mergeCloudState(base, local, remote, { [result.conflicts[0].path]: "local" });
    expect(remove.conflicts).toEqual([]); expect(remove.state.protectionRecords?.some(record => record.treeId === "tree_demo")).toBe(false);
    expect(remove.state.protectionRecords?.some(record => record.id === "protection_other")).toBe(true);
  });
});

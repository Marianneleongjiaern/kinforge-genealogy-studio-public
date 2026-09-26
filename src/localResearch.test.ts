import { describe, expect, it } from "vitest";
import { createSeedState } from "./domain";
import { linkLocalRecord, searchLocalArchive } from "./localResearch";

describe("Built-in archive research", () => {
  it("searches names, aliases, sources, fields, places and record transcriptions locally", () => {
    const s = createSeedState();
    expect(searchLocalArchive(s, "tree_demo", "Junie")[0].id).toBe("person_june");
    expect(searchLocalArchive(s, "tree_demo", "BC-1988-JC", "source")[0].id).toBe("source_birth");
    expect(searchLocalArchive(s, "tree_demo", "birth details", "record")[0].id).toBe("record_birth");
    expect(searchLocalArchive(s, "tree_demo", "civil registry", "place")[0].id).toBe("place_singapore");
  });
  it("uses all query terms, normalizes accents and handles empty results", () => {
    const s = createSeedState(); s.people[0].givenName = "Andre\u0301";
    expect(searchLocalArchive(s, "tree_demo", "ANDRE chang", "person")[0].id).toBe("person_alex");
    expect(searchLocalArchive(s, "tree_demo", "Andre absent")).toEqual([]);
    expect(searchLocalArchive(s, "tree_demo", "   ")).toEqual([]);
  });
  it("isolates every result type to the active tree", () => {
    const s = createSeedState();
    expect(searchLocalArchive(s, "another_tree", "Singapore")).toEqual([]);
    expect(searchLocalArchive(s, "another_tree", "June")).toEqual([]);
    expect(searchLocalArchive(s, "another_tree", "birth")).toEqual([]);
  });
  it("links reviewed evidence without overwriting vital facts or duplicating citations", () => {
    const s = createSeedState(); const p = s.people[2]; const before = { birth: p.birthDate, name: p.givenName };
    s.records[0].personId = undefined;
    linkLocalRecord(s, "tree_demo", "record_birth", p.id);
    linkLocalRecord(s, "tree_demo", "record_birth", p.id);
    expect(s.records[0].personId).toBe(p.id);
    expect(p.sourceIds.filter(id => id === "source_birth")).toHaveLength(1);
    expect({ birth: p.birthDate, name: p.givenName }).toEqual(before);
  });
  it("rejects conflicting links, cross-tree references and missing sources without mutation", () => {
    const s = createSeedState(); const before = structuredClone(s);
    expect(() => linkLocalRecord(s, "tree_demo", "record_birth", "person_alex")).toThrow("already linked");
    expect(() => linkLocalRecord(s, "other", "record_birth", "person_june")).toThrow("active tree");
    expect(s).toEqual(before);
    s.records[0].sourceId = "missing";
    expect(() => linkLocalRecord(s, "tree_demo", "record_birth", "person_june")).toThrow("source is missing");
  });
});

import { describe, expect, it } from "vitest";
import { createSeedState } from "./domain";
import { hydrateLibrary } from "./libraryState";

describe("saved library upgrades", () => {
  it("opens pre-glossary cloud libraries without changing their original records", () => {
    const old = createSeedState();
    delete (old as any).customFactTerms;
    delete (old as any).customFamilyTypes;
    delete (old.people[0] as any).government;
    delete (old.people[0] as any).deathDetails;
    old.people[0].biography = "Keep this biography";
    const original = JSON.stringify(old);
    const upgraded = hydrateLibrary(old);
    expect(upgraded.customFactTerms).toEqual([]);
    expect(upgraded.customFamilyTypes).toEqual([]);
    expect(upgraded.people[0].government.custodyRemoved).toBe(false);
    expect(upgraded.people[0].biography).toBe("Keep this biography");
    expect(upgraded.people.map(p => p.id)).toEqual(old.people.map(p => p.id));
    expect(JSON.stringify(old)).toBe(original);
    expect(hydrateLibrary(upgraded)).toEqual(upgraded);
  });
  it("adds only empty collections, never sample records", () => {
    const state = hydrateLibrary({} as any);
    for (const value of Object.values(state)) if (Array.isArray(value)) expect(value).toEqual([]);
    expect(state.chartConfig.type).toBe("Tree Chart");
  });
  it("keeps custom terms, privacy and unknown fields intact", () => {
    const old = createSeedState();
    old.customFactTerms = [{ id: "custom", category: "Belief", term: "My term", meaning: "My definition" }];
    old.people[0].sensitiveVisibility = "private";
    (old as any).futureField = { keep: true };
    const upgraded = hydrateLibrary(old);
    expect(upgraded.customFactTerms).toEqual(old.customFactTerms);
    expect(upgraded.people[0]).toEqual(old.people[0]);
    expect((upgraded as any).futureField).toEqual({ keep: true });
  });
  it("does not silently discard malformed data", () => {
    const state = createSeedState();
    (state as any).customFactTerms = { unexpected: "data" };
    expect(() => hydrateLibrary(state)).toThrow("original data has been kept");
    expect((state as any).customFactTerms).toEqual({ unexpected: "data" });
  });
});

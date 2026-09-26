import { describe, expect, it } from "vitest";
import { createEmptyPerson, createSeedState } from "./domain";
import { buildEvidenceDashboard } from "./analysis";
import { MAINTENANCE_ACTIONS, planMaintenance } from "./maintenance";

function fixture() {
  const state = createSeedState();
  const treeId = state.trees[0].id;
  state.trees.push({ ...state.trees[0], id: "other-tree" });
  const other = { ...structuredClone(state.people[0]), id: "other-person", treeId: "other-tree", biography: "token", birthDate: "2000/1/2", givenName: " Other  Person " };
  state.people.push(other);
  state.sources.push({ ...structuredClone(state.sources[0]), id: "other-source", treeId: "other-tree", title: "token" });
  state.places.push({ ...structuredClone(state.places[0]), id: "other-place", treeId: "other-tree", name: "token" });
  state.media.push({ id: "media-test", treeId, title: "Portrait", type: "picture", dataUrl: "data:image/png;base64,AA==", externalUrl: "", assignedTo: [], tags: [], rotation: 0, crop: "full image", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "2026-09-23" });
  return { state, treeId, other };
}

describe("reviewable maintenance", () => {
  it.each(MAINTENANCE_ACTIONS)("%s does not mutate the input or records in another tree", action => {
    const { state, treeId, other } = fixture();
    const before = structuredClone(state);
    const plan = planMaintenance(state, treeId, action, { find: "token", replace: "new" });
    expect(state).toEqual(before);
    expect(plan.next.people.find(person => person.id === other.id)).toEqual(other);
    expect(plan.next.sources.find(source => source.id === "other-source")).toEqual(state.sources.at(-1));
    expect(plan.next.places.find(place => place.id === "other-place")).toEqual(state.places.at(-1));
  });

  it("replaces literal punctuation and dollar signs without replacement interpolation", () => {
    const { state, treeId } = fixture();
    state.people[0].notes = "A.* a.*";
    const plan = planMaintenance(state, treeId, "Search and replace", { find: "a.*", replace: "$&" });
    expect(plan.next.people[0].notes).toBe("$& $&");
    expect(plan.changes).toContainEqual({ record: `${state.people[0].givenName} ${state.people[0].familyName}`, field: "notes", before: "A.* a.*", after: "$& $&" });
  });

  it("returns no changes for a non-match and rejects an empty query or missing tree", () => {
    const { state, treeId } = fixture();
    expect(planMaintenance(state, treeId, "Search and replace", { find: "NO_MATCH_1234", replace: "" }).changes).toEqual([]);
    expect(() => planMaintenance(state, treeId, "Search and replace")).toThrow("Enter the text");
    expect(() => planMaintenance(state, "missing", "Normalize dates")).toThrow("existing tree");
  });

  it("normalizes only unambiguous valid dates and preserves qualifiers", () => {
    const { state, treeId } = fixture();
    state.people[0].birthDate = "2000/2/29";
    state.people[0].deathDate = "1900/2/29";
    state.people[1].birthDate = "ABT 1800";
    state.people[1].deathDate = "01/02/1900";
    const plan = planMaintenance(state, treeId, "Normalize dates");
    expect(plan.next.people[0].birthDate).toBe("2000-02-29");
    expect(plan.next.people[0].deathDate).toBe("1900/2/29");
    expect(plan.next.people[1].birthDate).toBe("ABT 1800");
    expect(plan.next.people[1].deathDate).toBe("01/02/1900");
  });

  it("does not normalize events referenced by another tree", () => {
    const { state, treeId, other } = fixture();
    const event = state.events[0];
    event.date = "2000/1/2";
    state.people[0].eventIds.push(event.id);
    other.eventIds = [event.id];
    const plan = planMaintenance(state, treeId, "Normalize dates");
    expect(plan.next.events[0].date).toBe("2000/1/2");
    expect(plan.notices.join(" ")).toContain("shared with another tree");
  });

  it("preserves cultural capitalization when cleaning spacing", () => {
    const { state, treeId } = fixture();
    state.people[0].familyName = "  van  McDonald  ";
    expect(planMaintenance(state, treeId, "Reformat names").next.people[0].familyName).toBe("van McDonald");
  });

  it("removes only entirely empty, unreferenced people", () => {
    const { state, treeId } = fixture();
    const blank = createEmptyPerson(treeId);
    const linked = createEmptyPerson(treeId);
    const noted = createEmptyPerson(treeId);
    noted.notes = "Preserve this evidence";
    const needs = createEmptyPerson(treeId);
    needs.accessNeeds = [{ id: "need", glyphId: "blind", label: "Blind", detail: "", private: true }];
    state.people.push(blank, linked, noted, needs);
    state.todos.push({ id: "task", treeId, personId: linked.id, title: "Research", status: "open", priority: "normal", dueDate: "" });
    const plan = planMaintenance(state, treeId, "Remove empty entries");
    expect(plan.next.people.some(person => person.id === blank.id)).toBe(false);
    for (const person of [linked, noted, needs]) expect(plan.next.people).toContainEqual(person);
    expect(plan.next.events).toEqual(state.events);
  });

  it("repairs only invalid family references inside the selected tree", () => {
    const { state, treeId, other } = fixture();
    state.families[0].partnerIds = [state.people[0].id, state.people[0].id, other.id, "missing"];
    const otherFamily = { ...structuredClone(state.families[0]), id: "other-family", treeId: "other-tree" };
    state.families.push(otherFamily);
    const plan = planMaintenance(state, treeId, "Repair family links");
    expect(plan.next.families[0].partnerIds).toEqual([state.people[0].id]);
    expect(plan.next.families.at(-1)).toEqual(otherFamily);
  });

  it("cleans media tags without claiming to change image bytes", () => {
    const { state, treeId } = fixture();
    state.media[0].tags = [" portrait ", "portrait", ""];
    const otherMedia = { ...structuredClone(state.media[0]), id: "other-media", treeId: "other-tree" };
    state.media.push(otherMedia);
    const plan = planMaintenance(state, treeId, "Clean media tags");
    expect(plan.next.media[0].tags).toEqual(["portrait"]);
    expect(plan.next.media[0].dataUrl).toBe(state.media[0].dataUrl);
    expect(plan.next.media.at(-1)).toEqual(otherMedia);
  });
});

describe("evidence dashboard", () => {
  it("scores source coverage, duplicate risk and actionable weak profiles", () => {
    const state = createSeedState();
    state.people.push({
      ...structuredClone(state.people[0]),
      id: "duplicate-june",
      sourceIds: [],
      eventIds: [],
      mediaIds: [],
      facts: [],
      aliases: []
    });
    const dashboard = buildEvidenceDashboard(state, state.trees[0].id);
    expect(dashboard.scores.length).toBeGreaterThan(0);
    expect(dashboard.sourceCoverage).toBeGreaterThan(0);
    expect(dashboard.duplicateCount).toBeGreaterThan(0);
    const weak = dashboard.needsReview.find(entry => entry.person.id === "duplicate-june");
    expect(weak?.weaknesses.map(item => item.kind)).toContain("duplicate-risk");
    expect(weak?.weaknesses.map(item => item.kind)).toContain("no-sources");
    expect(dashboard.strongest[0].score).toBeGreaterThanOrEqual(dashboard.needsReview[0].score);
  });
});

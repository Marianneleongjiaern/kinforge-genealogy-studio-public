import { describe, expect, it } from "vitest";
import { createSeedState, createEmptyPerson } from "./domain";
import { ahnentafel, buildCatalogReport, CATALOG_TYPES, reportScope } from "./reportCatalog";
import { buildReportDocument, reportPortrait } from "./reportDocument";
import { linkPeople } from "./treeGraph";

describe("Distinct report generators", () => {
  it.each(CATALOG_TYPES)("generates a structured %s without the generic person fallback", type => {
    const state = createSeedState();
    const doc = buildCatalogReport(state, "tree_demo", type, "person_june", { comparisonId: "person_alex" });
    expect(doc?.content?.[0].content?.[0].text).toBe(type);
    expect(doc!.content!.length).toBeGreaterThan(3);
    expect(JSON.stringify(doc)).not.toContain("Government and Sensitive Details");
  });
  it("uses father/mother roles for numbered ancestry; repeated ancestors keep each slot and unknown roles are not guessed", () => {
    const state = createSeedState();
    state.relationships.filter(r => r.toId === "person_june").forEach(r => { r.parentRole = r.fromId === "person_alex" ? "father" : "mother"; });
    const shared = { ...createEmptyPerson("tree_demo"), id: "shared", givenName: "Shared", private: false };
    state.people.push(shared);
    linkPeople(state, "tree_demo", "parent-child", "shared", "person_alex", "father");
    linkPeople(state, "tree_demo", "parent-child", "shared", "person_mei", "father");
    const result = ahnentafel(state, "person_june", 3);
    expect(result.slots.map(s => [s.number, s.id])).toEqual([[1, "person_june"], [2, "person_alex"], [4, "shared"], [3, "person_mei"], [6, "shared"]]);
    const legacy = createSeedState();
    legacy.relationships.filter(r => r.type === "parent-child").forEach(r => { delete r.parentRole; });
    const unknown = ahnentafel(legacy, "person_june", 3);
    expect(unknown.slots).toHaveLength(1); expect(unknown.unresolved).toHaveLength(2);
  });
  it("uses actual descendants and actual union records", () => {
    const state = createSeedState();
    const descent = JSON.stringify(buildCatalogReport(state, "tree_demo", "Descendancy Report", "person_alex", { includePrivate: true }));
    expect(descent).toContain("Alex Chang -> June Chang -> Kai Chang");
    const marriage = JSON.stringify(buildCatalogReport(state, "tree_demo", "Marriage List", "person_alex"));
    expect(marriage).toContain("Alex Chang / Mei Tan");
  });
  it("separates cited records from uncited claims and missing source records", () => {
    const state = createSeedState(); state.people[0].sourceIds.push("missing-source");
    const doc = JSON.stringify(buildCatalogReport(state, "tree_demo", "Sources List"));
    expect(doc).toContain("Missing source record: missing-source"); expect(doc).toContain("Claims without attached citations"); expect(doc).toContain("Unlinked bibliography");
  });
  it("keeps private and cross-tree people out of analyses and diagrams", () => {
    const state = createSeedState(); state.people.push({ ...createEmptyPerson("other-tree"), id: "other", givenName: "Outsider", private: false });
    for (const type of CATALOG_TYPES) {
      const text = JSON.stringify(buildCatalogReport(state, "tree_demo", type, "person_june", { comparisonId: "person_alex" }));
      expect(text).not.toContain("Kai Chang"); expect(text).not.toContain("Outsider");
    }
    expect(reportScope(state, "tree_demo").people).toHaveLength(3);
  });
  it("renders real diagram models, surname counts, event positions and connection ranking", () => {
    const state = createSeedState();
    for (const type of ["Fan Chart", "Hourglass Chart", "Relationship Chart", "Ahnentafel Diagram", "Genogram", "Timeline Chart", "Name Distribution Chart", "Sociogram"]) {
      const doc = buildCatalogReport(state, "tree_demo", type, "person_june", { comparisonId: "person_alex" });
      const chart = doc?.content?.find(n => n.type === "reportChart"); expect(chart?.attrs?.diagram.title).toBeTruthy();
    }
    expect(JSON.stringify(buildCatalogReport(state, "tree_demo", "Name Distribution Report"))).toContain("Chang: 2 people (66.7%)");
    expect(JSON.stringify(buildCatalogReport(state, "tree_demo", "Influential People Report"))).toContain("degree centrality");
  });
  it("prefers the chosen profile photograph and includes it in both person and kinship headers", () => {
    const state = createSeedState(), person = state.people.find(p => p.id === "person_june")!;
    const photo = { id: "portrait", treeId: "tree_demo", title: "Portrait", type: "picture" as const, dataUrl: "data:image/png;base64,AAAA", externalUrl: "", assignedTo: [{ kind: "person" as const, id: person.id }], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "" };
    state.media.push({ ...photo, id: "earlier" }, photo); person.profileMediaId = photo.id;
    expect(reportPortrait(state, person)?.id).toBe("portrait");
    for (const type of ["Person Report", "Kinship Report"]) expect(buildReportDocument(state, "tree_demo", type, person.id).content?.[0].content?.[0]).toMatchObject({ type: "image", attrs: { src: photo.dataUrl, alt: "June Chang profile picture" } });
  });
  it("includes custom religious term meanings in facts reports", () => {
    const state = createSeedState();
    state.customFactTerms.push({ id: "term_moon", category: "Religion", term: "Moon Garden Fellowship", meaning: "A fictional family tradition centred on moonlit garden ceremonies." });
    state.people[0].facts.push({ id: "fact_moon", type: "Religion", value: "Moon Garden Fellowship", date: "", private: false, sourceIds: [] });
    const person = JSON.stringify(buildReportDocument(state, "tree_demo", "Person Report", state.people[0].id, { includePrivate: true }));
    const facts = JSON.stringify(buildCatalogReport(state, "tree_demo", "Facts List", state.people[0].id, { includePrivate: true }));
    expect(person).toContain("A fictional family tradition centred on moonlit garden ceremonies.");
    expect(facts).toContain("A fictional family tradition centred on moonlit garden ceremonies.");
  });
});

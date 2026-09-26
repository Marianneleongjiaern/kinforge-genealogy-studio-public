import { describe, expect, it } from "vitest";
import { createEmptyPerson, createSeedState } from "./domain";
import { generateKinshipReport, kinshipMatchesCategories } from "./kinship";
import { reportParentageState } from "./reportParentage";
import { linkPeople } from "./treeGraph";

function fixture() {
  const state = createSeedState(), treeId = "tree_demo";
  state.people = []; state.relationships = []; state.families = [];
  for (const id of ["Child", "Biological", "Adoptive", "Unspecified", "Partner", "Grandchild"])
    state.people.push({ ...createEmptyPerson(treeId), id, givenName: id, familyName: "Example", private: false });
  linkPeople(state, treeId, "parent-child", "Biological", "Child", "mother", "biological");
  linkPeople(state, treeId, "parent-child", "Adoptive", "Child", "father", "adoptive");
  linkPeople(state, treeId, "parent-child", "Unspecified", "Child", "parent");
  linkPeople(state, treeId, "parent-child", "Child", "Grandchild", "parent", "foster");
  linkPeople(state, treeId, "spouse", "Child", "Partner");
  state.families.push({ id: "f", treeId, name: "Adoptive family", partnerIds: ["Adoptive"], childIds: ["Child"], eventIds: [], sourceIds: [], notes: "" });
  return { state, treeId };
}

describe("Recorded parentage in reports", () => {
  it("filters explicitly typed parentage without treating untyped links as biological or changing the tree", () => {
    const { state } = fixture(), original = JSON.stringify(state);
    const biological = reportParentageState(state, "biological");
    expect(biological.relationships.filter(r => r.type === "parent-child").map(r => r.fromId)).toEqual(["Biological"]);
    expect(biological.relationships.some(r => r.type === "spouse")).toBe(true);
    expect(biological.families[0].childIds).toEqual([]);
    expect(reportParentageState(state, "adoptive").families[0].childIds).toEqual(["Child"]);
    expect(reportParentageState(state, "unspecified").relationships.filter(r => r.type === "parent-child").map(r => r.fromId)).toEqual(["Unspecified"]);
    expect(reportParentageState(state, "all")).toBe(state);
    expect(JSON.stringify(state)).toBe(original);
  });

  it("states the selected scope and the actual recorded parentage in named paths", () => {
    const { state, treeId } = fixture();
    const report = generateKinshipReport(state, treeId, "Child", { parentage: "adoptive", onlyRelated: true });
    expect(report).toContain("Parentage scope: Adoptive.");
    expect(report).toContain("Recorded parentage: Adoptive Example to Child Example: Adoptive.");
    expect(report).toContain("Paternal means this connection starts with Child Example's father, Adoptive Example.");
    expect(report).not.toContain("RELATIVE: Biological Example");
    expect(report).not.toContain("RELATIVE: Unspecified Example");
    expect(report).not.toContain("RELATIVE: Grandchild Example");
  });

  it("honors category selection, including an explicitly empty selection", () => {
    const { state, treeId } = fixture();
    const ancestors = generateKinshipReport(state, treeId, "Child", { kinshipCategories: ["ancestors"] });
    expect(ancestors).toContain("RELATIVE: Adoptive Example");
    expect(ancestors).not.toContain("RELATIVE: Grandchild Example");
    expect(ancestors).not.toContain("RELATIVE: Partner Example");
    expect(generateKinshipReport(state, treeId, "Child", { kinshipCategories: ["descendants"] })).toContain("RELATIVE: Grandchild Example");
    expect(generateKinshipReport(state, treeId, "Child", { kinshipCategories: [] })).not.toContain("RELATIVE:");
    const partners = generateKinshipReport(state, treeId, "Child", { kinshipCategories: ["partners"] });
    expect(partners).toContain("RELATIVE: Partner Example");
    expect(partners).not.toContain("RELATIVE: Adoptive Example");
  });

  it("retains typed parentage in normal JSON backups", () => {
    const { state } = fixture();
    const restored = JSON.parse(JSON.stringify(state));
    expect(reportParentageState(restored, "foster").relationships.filter(r => r.type === "parent-child").map(r => r.toId)).toEqual(["Grandchild"]);
  });

  it("keeps social categories separate from ancestry", () => {
    const result = { paths: [], direct: ["Recorded sibling", "Guardian"], connection: [] };
    expect(kinshipMatchesCategories(result, ["siblings"])).toBe(true);
    expect(kinshipMatchesCategories(result, ["other"])).toBe(true);
    expect(kinshipMatchesCategories(result, ["ancestors"])).toBe(false);
    expect(kinshipMatchesCategories({ ...result, direct: ["Spouse (divorced)"] }, ["partners"])).toBe(true);
  });
});

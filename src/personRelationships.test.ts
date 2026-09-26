import { describe, expect, it } from "vitest";
import { Relationship, RelationshipType, createEmptyPerson, createSeedState } from "./domain";
import { relationshipsByPerson } from "./personRelationships";

const people = ["Alex", "Mei", "June", "Kai"].map(id => ({ ...createEmptyPerson("tree"), id, givenName: id }));
const link = (type: RelationshipType, fromId = "Alex", toId = "June"): Relationship => ({ id: `${type}:${fromId}:${toId}`, treeId: "tree", type, fromId, toId, sourceIds: [] });

describe("Relationship labels on person cards", () => {
  it("names the person's role and the relative's role in the correct direction", () => {
    const labels = relationshipsByPerson(people, [link("parent-child"), link("guardian", "June", "Kai")]);
    expect(labels.get("Alex")![0]).toMatchObject({ role: "Parent", relativeRole: "Child", description: "Parent of June" });
    expect(labels.get("Alex")![0].glyphId).toBe("relationship-parent");
    expect(labels.get("June")![0]).toMatchObject({ role: "Child", relativeRole: "Parent", description: "Child of Alex" });
    expect(labels.get("June")![0].glyphId).toBe("relationship-child");
    expect(labels.get("June")![1]).toMatchObject({ role: "Guardian", relativeRole: "Ward", description: "Guardian of Kai" });
    expect(labels.get("June")![1].glyphId).toBe("relationship-guardian");
    expect(labels.get("Kai")![0]).toMatchObject({ role: "Ward", relativeRole: "Guardian", description: "Ward of June" });
    expect(labels.get("Kai")![0].glyphId).toBe("relationship-ward");
  });

  it("uses mother, father, son, daughter, brother and sister labels when the data supports them", () => {
    const gendered = people.map(person => person.id === "Alex" ? { ...person, gender: "male" as const } : person.id === "Mei" ? { ...person, gender: "female" as const } : person.id === "June" ? { ...person, gender: "female" as const } : { ...person, gender: "male" as const });
    const labels = relationshipsByPerson(gendered, [
      { ...link("parent-child", "Alex", "June"), parentRole: "father" },
      { ...link("parent-child", "Mei", "June"), parentRole: "mother" },
      { ...link("sibling", "June", "Kai") }
    ]);
    expect(labels.get("June")!.find(rel => rel.person.id === "Alex")).toMatchObject({ role: "Daughter", relativeRole: "Father" });
    expect(labels.get("June")!.find(rel => rel.person.id === "Mei")).toMatchObject({ role: "Daughter", relativeRole: "Mother" });
    expect(labels.get("June")!.find(rel => rel.person.id === "Kai")).toMatchObject({ role: "Sister", relativeRole: "Brother" });
  });

  it("keeps spouse, partner and sibling names distinct on both cards", () => {
    for (const type of ["spouse", "partner", "sibling"] as const) {
      const labels = relationshipsByPerson(people, [link(type)]);
      const role = type[0].toUpperCase() + type.slice(1);
      expect(labels.get("Alex")![0]).toMatchObject({ role, relativeRole: role, description: `${role} of June` });
      expect(labels.get("Alex")![0].glyphId).toBe({ spouse: "relationship-spouse", partner: "relationship-partner", sibling: "relationship-sibling" }[type]);
      expect(labels.get("June")![0].description).toBe(`${role} of Alex`);
    }
  });

  it("retains recorded relationship statuses without inventing parentage or marriage", () => {
    const relationships = [{ ...link("spouse", "Alex", "Mei"), status: "divorced" }, link("parent-child")];
    const before = JSON.stringify(relationships);
    const labels = relationshipsByPerson(people, relationships);
    expect(labels.get("Alex")![0].description).toBe("Spouse of Mei (divorced)");
    expect(labels.get("Alex")![0].glyphId).toBe("divorce");
    expect(labels.get("Mei")).toHaveLength(1);
    expect(labels.get("Kai")).toEqual([]);
    expect(JSON.stringify(relationships)).toBe(before);
  });

  it("excludes missing people, self links and links from other trees", () => {
    const stranger = { ...people[0], id: "stranger", treeId: "other" };
    const labels = relationshipsByPerson([...people, stranger], [
      link("spouse", "Alex", "missing"), link("sibling", "Alex", "Alex"),
      { ...link("parent-child"), treeId: "other" }, link("partner", "Alex", "stranger"),
    ]);
    expect([...labels.values()].flat()).toEqual([]);
  });

  it("labels typed biological, adoptive, foster, step and half siblings", () => {
    const state = createSeedState();
    const june = state.people.find(person => person.id === "person_june")!;
    const sibling = { ...createEmptyPerson(june.treeId), id: "sibling", givenName: "Morgan", familyName: "Chang" };
    state.people.push(sibling);
    for (const [status, label] of [["biological", "Biological sister"], ["adoptive", "Adoptive sister"], ["foster", "Foster sister"], ["step", "Step sister"], ["half", "Half sister"]] as const) {
      state.relationships = state.relationships.filter(rel => rel.id !== "typed-sibling");
      state.relationships.push({ id: "typed-sibling", treeId: june.treeId, type: "sibling", fromId: june.id, toId: sibling.id, status, sourceIds: [] });
      const rel = relationshipsByPerson(state.people, state.relationships).get(june.id)!.find(entry => entry.id === "typed-sibling")!;
      expect(rel.role).toBe(label);
      expect(rel.description).toContain(label);
    }
  });

  it("labels user-defined relatives and in-laws from the saved relationship subtype", () => {
    const labels = relationshipsByPerson(people, [{ ...link("relative", "Alex", "Mei"), subtype: "Cousin-in-law" }]);
    expect(labels.get("Alex")![0]).toMatchObject({
      role: "Cousin In Law",
      relativeRole: "Cousin In Law",
      status: "Cousin-in-law",
      glyphId: "relationship-cousin-in-law",
      description: "Cousin In Law of Mei (Cousin-in-law)"
    });
    expect(labels.get("Mei")![0]).toMatchObject({ role: "Cousin In Law", description: "Cousin In Law of Alex (Cousin-in-law)" });
  });
});

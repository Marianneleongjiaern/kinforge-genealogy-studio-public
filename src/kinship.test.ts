import { describe, expect, it } from "vitest";
import { ParentRole, RelationshipType, createEmptyPerson, createSeedState } from "./domain";
import { createKinshipIndex, generateKinshipReport, kinshipName } from "./kinship";
import { generateReportBody } from "./analysis";
import { linkPeople } from "./treeGraph";

function fixture() {
  const state = createSeedState(), treeId = state.trees[0].id;
  state.people = []; state.relationships = []; state.families = [];
  const person = (id: string, privatePerson = false) => {
    state.people.push({ ...createEmptyPerson(treeId), id, givenName: id, familyName: "Example", private: privatePerson }); return id;
  };
  const link = (fromId: string, toId: string, parentRole?: ParentRole, type: RelationshipType = "parent-child") => linkPeople(state, treeId, type, fromId, toId, parentRole);
  const branch = (ancestor: string, count: number, prefix: string, role: ParentRole = "parent") => {
    let current = ancestor;
    for (let i = 1; i <= count; i++) { const child = person(`${prefix}${i}`); link(current, child, i === count ? role : "parent"); current = child; }
    return current;
  };
  return { state, treeId, person, link, branch };
}

describe("Offline kinship calculation", () => {
  it.each([[2, 2, "1st cousin", 1, 0], [3, 3, "2nd cousin", 2, 0], [2, 5, "1st cousin, three times removed", 1, 3], [3, 6, "2nd cousin, three times removed", 2, 3], [3, 4, "2nd cousin, once removed", 2, 1], [2, 4, "1st cousin, twice removed", 1, 2]])("calculates %i versus %i generations as %s", (a, b, label, degree, removed) => {
    const f = fixture(), root = f.person("Root");
    const left = f.branch(root, a as number, "A", "mother"), right = f.branch(root, b as number, "B", "father");
    const calculate = createKinshipIndex(f.state, f.treeId);
    expect(calculate(left, right).paths).toHaveLength(1);
    expect(calculate(left, right).paths[0]).toMatchObject({ label, degree, removed, side: "Maternal", referenceDistance: a, relativeDistance: b });
    expect(calculate(right, left).paths[0]).toMatchObject({ label, degree, removed, side: "Paternal", referenceDistance: b, relativeDistance: a });
  });

  it.each([[0, 0, "Self"], [1, 0, "Parent"], [2, 0, "grandparent"], [4, 0, "2nd-great-grandparent"], [0, 1, "Child"], [0, 3, "great-grandchild"], [1, 1, "Sibling"], [2, 1, "aunt/uncle"], [1, 2, "niece/nephew"], [3, 1, "great-aunt/uncle"]])("names direct and collateral relatives at %i / %i", (a, b, label) => {
    expect(kinshipName(a as number, b as number).label).toBe(label);
  });

  it("retains both equally close shared grandparents without reporting more distant ancestors", () => {
    const f = fixture();
    for (const name of ["Earlier", "Grandmother", "Grandfather", "A", "B", "Ref", "Relative"]) f.person(name);
    f.link("Earlier", "Grandmother");
    for (const grandparent of ["Grandmother", "Grandfather"]) for (const parent of ["A", "B"]) f.link(grandparent, parent);
    f.link("A", "Ref", "father"); f.link("B", "Relative");
    const result = createKinshipIndex(f.state, f.treeId)("Ref", "Relative");
    expect(result.paths.map(p => p.ancestorId).sort()).toEqual(["Grandfather", "Grandmother"]);
    expect(result.paths.every(p => p.label === "1st cousin" && p.side === "Paternal")).toBe(true);
  });

  it("keeps maternal and paternal routes in a repeated-ancestor family", () => {
    const f = fixture();
    ["Root", "Mother", "Father", "Uncle", "Ref", "Relative"].forEach(p => f.person(p));
    for (const id of ["Mother", "Father", "Uncle"]) f.link("Root", id);
    f.link("Mother", "Ref", "mother"); f.link("Father", "Ref", "father"); f.link("Uncle", "Relative");
    expect(createKinshipIndex(f.state, f.treeId)("Ref", "Relative").paths.map(p => p.side).sort()).toEqual(["Maternal", "Paternal"]);
  });

  it("never infers parent roles from gender, including previously stored trees", () => {
    const state = createSeedState();
    state.relationships.filter(rel => rel.type === "parent-child").forEach(rel => { delete rel.parentRole; });
    expect(createKinshipIndex(state, state.trees[0].id)("person_june", "person_alex").paths[0].side).toBe("Side not recorded");
    const f = fixture(), root = f.person("Root"), ref = f.branch(root, 2, "A");
    const relative = f.branch(root, 2, "B");
    expect(createKinshipIndex(f.state, f.treeId)(ref, relative).paths[0].side).toBe("Side not recorded");
  });

  it("keeps sibling-only, marital and guardian links distinct from ancestry", () => {
    const f = fixture(); ["Ref", "Sibling", "Partner", "Ward"].forEach(p => f.person(p));
    f.link("Ref", "Sibling", undefined, "sibling"); f.link("Ref", "Partner", undefined, "spouse"); f.link("Ref", "Ward", undefined, "guardian");
    f.state.relationships.find(r => r.type === "spouse")!.status = "divorced";
    const calculate = createKinshipIndex(f.state, f.treeId);
    expect(calculate("Ref", "Sibling")).toMatchObject({ paths: [], direct: ["Recorded sibling"] });
    expect(calculate("Ref", "Partner")).toMatchObject({ paths: [], direct: ["Spouse (divorced)"] });
    expect(calculate("Ref", "Ward").direct).toEqual(["Ward"]);
    expect(calculate("Ward", "Ref").direct).toEqual(["Guardian"]);
    expect(calculate("Partner", "Sibling").connection).toEqual(["Partner", "Ref", "Sibling"]);
    expect(calculate("Sibling", "Partner").connection).toEqual(["Sibling", "Ref", "Partner"]);
  });

  it("reports both a spouse link and shared ancestry when both are recorded", () => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, 2, "A"), b = f.branch(root, 2, "B");
    f.link(a, b, undefined, "spouse");
    const result = createKinshipIndex(f.state, f.treeId)(a, b);
    expect(result.paths[0].label).toBe("1st cousin"); expect(result.direct).toEqual(["Spouse"]);
  });

  it("rejects reachable ancestry cycles but not unrelated corrupt branches", () => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, 2, "A"), b = f.branch(root, 2, "B");
    f.person("Cycle"); f.state.relationships.push({ id: "cycle", treeId: f.treeId, type: "parent-child", fromId: "Cycle", toId: "Cycle", sourceIds: [] });
    expect(createKinshipIndex(f.state, f.treeId)(a, b).paths[0].label).toBe("1st cousin");
    f.link("Cycle", "Root");
    const invalid = createKinshipIndex(f.state, f.treeId)(a, b);
    expect(invalid.paths).toEqual([]); expect(invalid.warning).toContain("cycle");
  });

  it("does not use cross-tree people or links and distinguishes absent paths", () => {
    const f = fixture(); f.person("Ref"); f.person("Separate");
    f.state.people.push({ ...createEmptyPerson("other-tree"), id: "Outsider" });
    f.state.relationships.push({ id: "bad", treeId: f.treeId, type: "parent-child", fromId: "Outsider", toId: "Ref", sourceIds: [] });
    const calculate = createKinshipIndex(f.state, f.treeId);
    expect(calculate("Ref", "Separate")).toEqual({ paths: [], direct: [], connection: [] });
    expect(calculate("Ref", "Outsider").warning).toContain("this tree");
    expect(generateKinshipReport(f.state, f.treeId, "Ref", { comparisonId: "Outsider" })).toContain("Choose a comparison");
  });

  it("persists parent roles through JSON backup and does not mutate data during calculation", () => {
    const f = fixture(); f.person("Parent"); f.person("Child"); f.link("Parent", "Child", "mother");
    const saved = JSON.stringify(f.state), restored = JSON.parse(saved);
    expect(createKinshipIndex(restored, f.treeId)("Child", "Parent").paths[0].side).toBe("Maternal");
    expect(JSON.stringify(f.state)).toBe(saved);
  });
});

describe("Generated kinship report", () => {
  it("shows named paths, maternal side, degree, removal, direction and an explanatory glossary", () => {
    const f = fixture(), root = f.person("Root"), ref = f.branch(root, 3, "A", "mother"), cousin = f.branch(root, 6, "B");
    const report = generateReportBody(f.state, f.treeId, "Kinship Report", ref, { comparisonId: cousin });
    expect(report).toContain("2nd cousin, three times removed"); expect(report).toContain("Family side: Maternal");
    expect(report).toContain("Generation distances: reference 3; relative 6.");
    expect(report).toContain("3 generation(s) further from"); expect(report).toContain("A3 Example -> A2 Example -> A1 Example -> Root Example");
    expect(report).toContain("HOW TO READ THIS REPORT"); expect(report).toContain("Thrice removed (three times removed) = 3 generations apart");
    expect(report).toContain("B3 Example is A3 Example's 2nd cousin. B6 Example is B3 Example's great-grandchild.");
    expect(generateKinshipReport(f.state, f.treeId, cousin, { comparisonId: ref })).toContain("3 generation(s) closer to");
  });

  it("redacts private names even on intermediary paths until explicitly included", () => {
    const f = fixture(), root = f.person("SecretAncestor", true), a = f.branch(root, 2, "A"), b = f.branch(root, 2, "B");
    f.state.people.find(p => p.id === a)!.private = true;
    const report = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b });
    expect(report).toContain("[Private person]"); expect(report).not.toContain("SecretAncestor"); expect(report).not.toContain("A2 Example");
    expect(generateKinshipReport(f.state, f.treeId, a, { comparisonId: b, includePrivate: true })).toContain("SecretAncestor Example");
    expect(generateKinshipReport(f.state, f.treeId, b)).not.toContain("RELATIVE: A2 Example");
  });

  it("explains social-only paths and unknown connections without inventing cousins", () => {
    const f = fixture(); ["Ref", "Spouse", "Sibling", "Disconnected"].forEach(p => f.person(p));
    f.link("Ref", "Spouse", undefined, "spouse"); f.link("Spouse", "Sibling", undefined, "sibling");
    const report = generateKinshipReport(f.state, f.treeId, "Ref", { comparisonId: "Sibling" });
    expect(report).toContain("Connected through recorded relationships"); expect(report).toContain("Ref Example -> spouse: Spouse Example");
    expect(generateKinshipReport(f.state, f.treeId, "Ref", { comparisonId: "Disconnected" })).toContain("Relationship to Ref Example: No recorded path");
  });
});

describe("Everyday relationship explanations", () => {
  it.each([1, 2, 3].flatMap(degree => [0, 1, 2, 3, 4, 5].map(removed => ({ degree, removed }))))("explains the shared ancestor for cousin degree $degree with $removed removals in both directions", ({ degree, removed }) => {
    const f = fixture(), root = f.person("Root");
    const a = f.branch(root, degree + 1, "A", "mother"), b = f.branch(root, degree + 1 + removed, "B", "father");
    const cousin = ["1st cousin", "2nd cousin", "3rd cousin"][degree - 1];
    const ancestor = ["grandparent", "great-grandparent", "great-great-grandparent"][degree - 1];
    const down = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b });
    const up = generateKinshipReport(f.state, f.treeId, b, { comparisonId: a });
    expect(down).toContain(`Why ${cousin}: Root Example is a ${ancestor} of both ${a} Example and B${degree + 1} Example.`);
    expect(up).toContain(`Why ${cousin}: Root Example is a ${ancestor} of both B${degree + 1} Example and ${a} Example.`);
    expect(down).toContain(`Maternal means this connection starts with ${a} Example's mother, A${degree} Example.`);
    expect(up).toContain(`Paternal means this connection starts with ${b} Example's father, B${degree + removed} Example.`);
    for (const report of [down, up]) expect(report).toContain(`Cousin degree: ${degree}. Generations removed: ${removed}.`);
  });

  it("explains both recorded family sides and does not assign a side when the parent role is missing", () => {
    const f = fixture();
    ["Root", "Mother", "Father", "Uncle", "Ref", "Relative"].forEach(p => f.person(p));
    for (const id of ["Mother", "Father", "Uncle"]) f.link("Root", id);
    f.link("Mother", "Ref", "mother"); f.link("Father", "Ref", "father"); f.link("Uncle", "Relative");
    const report = generateKinshipReport(f.state, f.treeId, "Ref", { comparisonId: "Relative" });
    expect(report).toContain("Family side: Maternal and Paternal");
    expect(report).toContain("Maternal means this connection starts with Ref Example's mother, Mother Example.");
    expect(report).toContain("Paternal means this connection starts with Ref Example's father, Father Example.");
    const reverse = generateKinshipReport(f.state, f.treeId, "Relative", { comparisonId: "Ref" });
    expect(reverse).toContain("Family side: Side not recorded");
    expect(reverse).toContain("This connection starts with Relative Example's recorded parent, Uncle Example. A maternal or paternal role has not been recorded for this parent-child link.");
  });

  it("redacts the parent, intermediate cousin and shared ancestor in everyday explanations", () => {
    const f = fixture(), root = f.person("Root", true), a = f.branch(root, 2, "A", "mother"), b = f.branch(root, 5, "B");
    for (const id of ["A1", "B2"]) f.state.people.find(p => p.id === id)!.private = true;
    const hidden = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b });
    for (const name of ["Root Example", "A1 Example", "B2 Example"]) expect(hidden).not.toContain(name);
    expect(hidden).toContain("Maternal means this connection starts with A2 Example's mother, [Private person].");
    expect(hidden).toContain("Why 1st cousin: [Private person] is a grandparent of both A2 Example and [Private person].");
    const shown = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b, includePrivate: true });
    expect(shown).toContain("Maternal means this connection starts with A2 Example's mother, A1 Example.");
    expect(shown).toContain("Why 1st cousin: Root Example is a grandparent of both A2 Example and B2 Example.");
  });

  it.each([1, 2, 3, 4, 5])("explains %i generations removed using actual intermediate people in both directions", removal => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, 2, "A"), b = f.branch(root, 2 + removal, "B");
    const down = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b });
    expect(down).toContain("B2 Example is A2 Example's 1st cousin.");
    expect(down).toContain(`${removal} family generation${removal === 1 ? "" : "s"} apart`);
    const up = generateKinshipReport(f.state, f.treeId, b, { comparisonId: a });
    expect(up).toContain("A2 Example is B2 Example's 1st cousin.");
    expect(up).toContain("older generation's branch");
  });

  it.each([1, 2, 3])("explains cousin degree %i without conflating removal", degree => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, degree + 1, "A"), b = f.branch(root, degree + 1, "B");
    const report = generateKinshipReport(f.state, f.treeId, a, { comparisonId: b });
    expect(report).toContain("same family generation, so neither is removed");
    expect(report).toContain("Your child and your first cousin's child are second cousins to each other");
  });

  it("names cousin's spouse and spouse's cousin separately, retaining divorce status and privacy", () => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, 2, "A"), cousin = f.branch(root, 3, "B"), spouse = f.person("Spouse");
    f.link(cousin, spouse, undefined, "spouse");
    f.state.relationships.find(r => r.type === "spouse")!.status = "divorced";
    const calculate = createKinshipIndex(f.state, f.treeId);
    expect(calculate(a, spouse).inLaws?.[0]).toMatchObject({ kind: "cousins-spouse", status: "divorced", cousin: { degree: 1, removed: 1 } });
    expect(calculate(spouse, a).inLaws?.[0].kind).toBe("spouses-cousin");
    const report = generateKinshipReport(f.state, f.treeId, a, { comparisonId: spouse });
    expect(report).toContain("cousin's spouse connection"); expect(report).toContain("status: divorced");
    expect(report).toContain("marriage itself adds no generations removed");
    f.state.people.find(p => p.id === cousin)!.private = true;
    expect(generateKinshipReport(f.state, f.treeId, a, { comparisonId: spouse })).not.toContain("B3 Example");
  });

  it("does not call a cousin's unmarried partner a cousin-in-law", () => {
    const f = fixture(), root = f.person("Root"), a = f.branch(root, 2, "A"), b = f.branch(root, 2, "B"), partner = f.person("Partner");
    f.link(b, partner, undefined, "partner");
    expect(createKinshipIndex(f.state, f.treeId)(a, partner).inLaws).toBeUndefined();
  });
});

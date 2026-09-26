import { describe, expect, it } from "vitest";
import { Relationship, RelationshipType, createEmptyPerson, createSeedState } from "./domain";
import { LINE_STYLES, familyLines, siblingLineKind, statusMark, unionStatus } from "./familyLines";
import { NODE_HEIGHT, NODE_WIDTH, layoutFamily } from "./treeGraph";

function fixture(names: string[], connections: Array<[RelationshipType, string, string]>) {
  const people = names.map(id => ({ ...createEmptyPerson("tree"), id, givenName: id }));
  const relationships: Relationship[] = connections.map(([type, fromId, toId], index) => ({ id: `rel-${index}`, treeId: "tree", type, fromId, toId, sourceIds: [] }));
  const layout = layoutFamily(people, relationships);
  const at = (id: string) => layout.find(node => node.person.id === id)!.position;
  return { people, relationships, layout, at, lines: familyLines(layout, relationships) };
}

describe("Family junction lines and legend", () => {
  it("branches from the midpoint of the couple line, not two independent parent edges", () => {
    const state = createSeedState();
    const layout = layoutFamily(state.people, state.relationships);
    const lines = familyLines(layout, state.relationships);
    const union = lines.find(line => line.id.startsWith("union:"))!;
    const family = lines.find(line => line.childIds.includes("person_june"))!;
    const [alex, mei, june] = layout;
    expect(union.junction).toEqual({ x: (alex.position.x + mei.position.x + NODE_WIDTH) / 2, y: alex.position.y + NODE_HEIGHT / 2 });
    expect(family.junction).toEqual(union.junction);
    expect(family.parentIds.sort()).toEqual(["person_alex", "person_mei"]);
    expect(family.paths).toHaveLength(1);
    expect(family.paths[0].d).toContain(`M${union.junction!.x} ${union.junction!.y} V`);
    expect(family.paths[0].d).toContain(`V${june.position.y}`);
    expect(lines).toHaveLength(3);
  });

  it("keeps sibling couples adjacent and gives each couple its own descendants", () => {
    const { at, lines } = fixture(["root", "sibling-a", "sibling-b", "child-a1", "child-a2", "child-b", "spouse-a", "spouse-b"], [
      ["parent-child", "root", "sibling-a"], ["parent-child", "root", "sibling-b"],
      ["spouse", "sibling-a", "spouse-a"], ["partner", "sibling-b", "spouse-b"],
      ["parent-child", "sibling-a", "child-a1"], ["parent-child", "spouse-a", "child-a1"],
      ["parent-child", "sibling-a", "child-a2"], ["parent-child", "spouse-a", "child-a2"],
      ["parent-child", "sibling-b", "child-b"], ["parent-child", "spouse-b", "child-b"],
    ]);
    expect(at("spouse-a").x).toBeLessThan(at("sibling-b").x);
    const a = lines.find(line => line.childIds.includes("child-a1"))!;
    const b = lines.find(line => line.childIds.includes("child-b"))!;
    expect(a.childIds).toEqual(["child-a1", "child-a2"]);
    expect(a.parentIds).toEqual(["sibling-a", "spouse-a"]);
    expect(b.parentIds).toEqual(["sibling-b", "spouse-b"]);
    expect(a.junction!.x).toBeLessThan(b.junction!.x);
    expect(at("child-a2").x).toBeLessThan(at("child-b").x);
    expect(a.fork!.x).toBe((at("child-a1").x + at("child-a2").x + NODE_WIDTH) / 2);
    expect(a.paths[a.paths.length - 1].d).toContain(`V${a.fork!.y} M${at("child-a1").x + NODE_WIDTH / 2} ${a.fork!.y} H${at("child-a2").x + NODE_WIDTH / 2}`);
  });

  it("drops straight from the couple midpoint into the centre of a two- or three-child branch", () => {
    for (const children of [["a", "b"], ["a", "b", "c"]]) {
      const { at, lines } = fixture(["parent", "spouse", ...children], [
        ["spouse", "parent", "spouse"], ...children.flatMap(child => [["parent-child", "parent", child], ["parent-child", "spouse", child]] as Array<[RelationshipType, string, string]>),
      ]);
      const family = lines.find(line => line.childIds.length)!;
      expect(family.fork!.x).toBe(family.junction!.x);
      expect(family.paths[0].d.startsWith(`M${family.junction!.x} ${family.junction!.y} V${family.fork!.y} M`)).toBe(true);
      expect(at(children[0]).x + NODE_WIDTH / 2).toBeLessThan(family.fork!.x);
      expect(at(children[children.length - 1]).x + NODE_WIDTH / 2).toBeGreaterThan(family.fork!.x);
    }
  });

  it("centres the final stem even when a mixed-parent branch is offset or cards are moved", () => {
    const { layout, relationships } = fixture(["parent", "spouse", "a", "b"], [["spouse", "parent", "spouse"], ["parent-child", "parent", "a"], ["parent-child", "spouse", "a"], ["parent-child", "parent", "b"], ["parent-child", "spouse", "b"]]);
    layout.find(node => node.person.id === "b")!.position.x += 300;
    const family = familyLines(layout, relationships).find(line => line.childIds.length)!;
    const xs = layout.filter(node => ["a", "b"].includes(node.person.id)).map(node => node.position.x + NODE_WIDTH / 2);
    expect(family.fork!.x).toBe((Math.min(...xs) + Math.max(...xs)) / 2);
    expect(family.fork!.x).not.toBe(family.junction!.x);
    expect(family.paths[0].d).toContain(`H${family.fork!.x} V${family.fork!.y} M${Math.min(...xs)} ${family.fork!.y} H${Math.max(...xs)}`);
  });

  it("does not assign a single-parent child to that parent's spouse", () => {
    const { at, lines } = fixture(["parent", "spouse", "child"], [["spouse", "parent", "spouse"], ["parent-child", "parent", "child"]]);
    const family = lines.find(line => line.childIds.length)!;
    expect(family.parentIds).toEqual(["parent"]);
    expect(family.junction).toEqual({ x: at("parent").x + NODE_WIDTH / 2, y: at("parent").y + NODE_HEIGHT });
    expect(family.junction).not.toEqual(lines.find(line => line.id.startsWith("union:"))!.junction);
  });

  it("keeps children of different unions on their own couple junctions", () => {
    const { lines } = fixture(["parent", "first-partner", "second-partner", "first-child", "second-child"], [
      ["spouse", "parent", "first-partner"], ["partner", "parent", "second-partner"],
      ["parent-child", "parent", "first-child"], ["parent-child", "first-partner", "first-child"],
      ["parent-child", "parent", "second-child"], ["parent-child", "second-partner", "second-child"],
    ]);
    const first = lines.find(line => line.childIds.includes("first-child"))!;
    const second = lines.find(line => line.childIds.includes("second-child"))!;
    expect([...first.parentIds].sort()).toEqual(["first-partner", "parent"]);
    expect([...second.parentIds].sort()).toEqual(["parent", "second-partner"]);
    expect(first.junction).not.toEqual(second.junction);
    expect(first.junction!.x).not.toBe(second.junction!.x);
  });

  it("shows shared parenting without inventing a marriage or partnership", () => {
    const { lines } = fixture(["a", "b", "c", "child"], [["parent-child", "a", "child"], ["parent-child", "b", "child"], ["parent-child", "c", "child"]]);
    expect(lines).toHaveLength(1);
    expect(lines[0].paths.map(path => path.kind)).toEqual(["coparent", "descent"]);
    expect(lines[0].parentIds).toHaveLength(3);
  });

  it("colors parent-child branches by explicit biological, adoptive, foster or step parentage", () => {
    const { layout, relationships } = fixture(["parent", "child"], [["parent-child", "parent", "child"]]);
    for (const kind of ["biological", "adoptive", "foster", "step"] as const) {
      relationships[0].parentage = kind;
      const line = familyLines(layout, relationships).find(entry => entry.childIds.includes("child"))!;
      expect(line.paths.at(-1)!.kind).toBe(kind);
      expect(line.description).toContain(LINE_STYLES[kind].label);
    }
    relationships[0].parentage = "unspecified";
    expect(familyLines(layout, relationships).find(entry => entry.childIds.includes("child"))!.paths.at(-1)!.kind).toBe("descent");
  });

  it("keeps mixed parentage branches neutral instead of pretending one role covers the whole family", () => {
    const { layout, relationships } = fixture(["parent", "spouse", "child"], [["parent-child", "parent", "child"], ["parent-child", "spouse", "child"]]);
    relationships[0].parentage = "biological";
    relationships[1].parentage = "adoptive";
    const line = familyLines(layout, relationships).find(entry => entry.childIds.includes("child"))!;
    expect(line.paths.at(-1)!.kind).toBe("descent");
  });

  it("uses a sibling bracket only when a shared parent branch is not already visible", () => {
    const { layout, relationships, lines } = fixture(["parent", "a", "b"], [["parent-child", "parent", "a"], ["parent-child", "parent", "b"], ["sibling", "a", "b"]]);
    expect(lines).toHaveLength(1);
    const filtered = familyLines(layout.filter(node => node.person.id !== "parent"), relationships);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].paths[0].kind).toBe("sibling");
  });

  it("draws explicit biological, adoptive, foster, step and half sibling links with distinct styles", () => {
    const { layout, relationships } = fixture(["a", "b"], [["sibling", "a", "b"]]);
    for (const [status, kind] of [["biological", "biologicalSibling"], ["adoptive", "adoptiveSibling"], ["foster", "fosterSibling"], ["step", "stepSibling"], ["half", "halfSibling"]] as const) {
      relationships[0].status = status;
      expect(familyLines(layout, relationships)[0].paths[0].kind).toBe(kind);
      expect(siblingLineKind(status)).toBe(kind);
    }
    expect(siblingLineKind()).toBe("sibling");
  });

  it("distinguishes guardianship from parentage and every basic line has a legend entry", () => {
    const { lines } = fixture(["a", "b"], [["sibling", "a", "b"], ["guardian", "a", "b"]]);
    expect(lines.map(line => line.paths[0].kind)).toEqual(["sibling", "guardian"]);
    expect(lines.every(line => line.parentIds.length === 0)).toBe(true);
    lines.flatMap(line => line.paths).forEach(path => expect(LINE_STYLES[path.kind].label).toBeTruthy());
    expect(new Set(Object.values(LINE_STYLES).map(style => `${style.color}:${style.dash}:${style.sample}`)).size).toBe(Object.keys(LINE_STYLES).length);
  });

  it("uses only explicit relationship statuses for colored union line types", () => {
    const { layout, relationships } = fixture(["a", "b"], [["spouse", "a", "b"]]);
    for (const [stored, expected] of [["Engaged", "engaged"], ["dating", "dating"], ["married", "married"], ["civil union", "civilUnion"], ["Separated", "separated"], ["divorced", "divorced"], ["annulled", "annulled"]] as const) {
      relationships[0].status = stored;
      const line = familyLines(layout, relationships)[0];
      expect(line.status).toBe(expected);
      expect(line.paths[0].kind).toBe(expected);
    expect(LINE_STYLES[line.paths[0].kind].color).toMatch(/^#/);
    expect(statusMark(expected, line.junction!)).toContain("M");
    }
    relationships[0].status = "";
    expect(familyLines(layout, relationships)[0].paths[0].kind).toBe("married");
    relationships[0].type = "partner";
    expect(familyLines(layout, relationships)[0].paths[0].kind).toBe("partner");
    expect(unionStatus("deceased")).toBeUndefined();
    expect(unionStatus()).toBeUndefined();
    for (const kind of ["immediateFamily", "extendedFamily", "cousin"] as const) expect(LINE_STYLES[kind].label).toBeTruthy();
  });

  it("ignores self, missing-person and cross-tree records without mutating the source", () => {
    const { layout, relationships } = fixture(["a", "b"], [["spouse", "a", "b"]]);
    relationships.push({ ...relationships[0], id: "other", treeId: "other-tree" }, { ...relationships[0], id: "self", toId: "a" }, { ...relationships[0], id: "missing", toId: "missing" });
    const before = JSON.stringify(relationships);
    expect(familyLines(layout, relationships)).toHaveLength(1);
    expect(JSON.stringify(relationships)).toBe(before);
    expect(familyLines([], relationships)).toEqual([]);
  });
});

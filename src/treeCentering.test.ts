import { describe, expect, it } from "vitest";
import { Relationship, RelationshipType, createEmptyPerson } from "./domain";
import { familyLines } from "./familyLines";
import { NODE_WIDTH, layoutFamily, moveWithinGeneration, positionFamily } from "./treeGraph";

function screenshotFixture() {
  const people = ["Alex", "Mei", "June", "Kai", "Robin", "Morgan", "Taylor", "Sam", "Lee", "Lou", "Kit"].map(id => ({ ...createEmptyPerson("tree"), id, givenName: id }));
  const data: Array<[RelationshipType, string, string]> = [
    ["spouse", "Alex", "Mei"], ["parent-child", "Alex", "June"], ["parent-child", "Mei", "June"],
    ["sibling", "June", "Robin"], ["spouse", "June", "Taylor"], ["spouse", "Robin", "Morgan"],
    ["parent-child", "June", "Kai"], ["parent-child", "June", "Lee"], ["parent-child", "Taylor", "Lee"],
    ["parent-child", "June", "Lou"], ["parent-child", "Taylor", "Lou"],
    ["parent-child", "Robin", "Sam"], ["parent-child", "Morgan", "Sam"], ["parent-child", "Lee", "Kit"],
  ];
  const relationships: Relationship[] = data.map(([type, fromId, toId], index) => ({ id: `rel-${index}`, treeId: "tree", type, fromId, toId, sourceIds: [] }));
  return { layout: layoutFamily(people, relationships), people, relationships };
}

function expectCentred(layout: ReturnType<typeof layoutFamily>, relationships: Relationship[]) {
  familyLines(layout, relationships).filter(line => line.childIds.length).forEach(line => {
    expect(line.fork!.x, `offset in ${line.description}`).toBeCloseTo(line.junction!.x, 5);
    const d = line.paths[line.paths.length - 1].d;
    expect(d.startsWith(`M${line.junction!.x} ${line.junction!.y} V${line.fork!.y} M`)).toBe(true);
  });
  layout.forEach((a, index) => layout.slice(index + 1).forEach(b => {
    if (a.position.y === b.position.y) expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThanOrEqual(NODE_WIDTH + 48 - 0.00001);
  }));
}

describe("Structural family centring", () => {
  it("fixes every parent-child offset in the user's eleven-person screenshot without changing parentage", () => {
    const { layout, relationships } = screenshotFixture();
    expectCentred(layout, relationships);
    const at = (id: string) => layout.find(node => node.person.id === id)!.position;
    const couple = (at("June").x + at("Taylor").x) / 2;
    expect(couple).toBeCloseTo((at("Lee").x + at("Lou").x) / 2, 5);
    expect(at("Lee").x).toBeLessThan(couple);
    expect(at("Lou").x).toBeGreaterThan(couple);
    expect(at("Kai").x).toBe(at("June").x);
    expect(at("Kit").x).toBe(at("Lee").x);
    expect(relationships).toHaveLength(14);
    expect(relationships.some(rel => rel.type === "parent-child" && rel.toId === "Robin")).toBe(false);
  });

  it("keeps the couple, child bar and other descendants centred after dragging and restoring", () => {
    const { layout, relationships } = screenshotFixture();
    for (const id of ["June", "Taylor", "Lee", "Lou", "Robin", "Kit"]) {
      const x = layout.find(node => node.person.id === id)!.position.x + 350;
      const moved = moveWithinGeneration(layout, {}, id, x, relationships);
      expect(moved[id].x).toBeCloseTo(x, 5);
      const restored = positionFamily(layout, moved, relationships);
      expectCentred(restored, relationships);
      restored.forEach(node => expect(node.position.y).toBe(layout.find(original => original.person.id === node.person.id)!.position.y));
      expect(positionFamily(layout, Object.fromEntries(restored.map(node => [node.person.id, node.position])), relationships)).toEqual(restored);
    }
  });

  it("repairs older saved offsets instead of preserving a sideways dogleg", () => {
    const { layout, relationships } = screenshotFixture();
    const restored = positionFamily(layout, { Lou: { x: 2000, y: -2000 } }, relationships);
    expectCentred(restored, relationships);
  });

  it("centres two separate unions without overlapping their children", () => {
    const { people } = screenshotFixture();
    const connections: Array<[RelationshipType, string, string]> = [
      ["spouse", "June", "Taylor"], ["partner", "June", "Robin"],
      ["parent-child", "June", "Kai"], ["parent-child", "Taylor", "Kai"],
      ["parent-child", "June", "Lee"], ["parent-child", "Taylor", "Lee"],
      ["parent-child", "June", "Lou"], ["parent-child", "Robin", "Lou"],
      ["parent-child", "June", "Kit"], ["parent-child", "Robin", "Kit"],
    ];
    const relationships: Relationship[] = connections.map(([type, fromId, toId], index) => ({ id: `${index}`, treeId: "tree", type, fromId, toId, sourceIds: [] }));
    expectCentred(layoutFamily(people, relationships), relationships);
  });
});

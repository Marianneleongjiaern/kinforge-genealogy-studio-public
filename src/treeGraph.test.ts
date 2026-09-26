import { describe, expect, it } from "vitest";
import { Relationship, RelationshipType, createEmptyPerson, createSeedState } from "./domain";
import { NODE_HEIGHT, NODE_WIDTH, familyGroups, layoutFamily, linkPeople, moveWithinGeneration, positionFamily, relationshipError, syncFamilyMembership, visiblePeople } from "./treeGraph";
import { resolveWorkspaceRoute, workspacePath } from "./workspace";

describe("Dynamic genealogy chart", () => {
  it("traverses multiple generations in the selected direction and respects depth", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const kai = state.people.find(person => person.givenName === "Kai")!;
    const alex = state.people.find(person => person.givenName === "Alex")!;
    expect(visiblePeople(state, treeId, kai.id, "ancestors", 1).map(person => person.givenName)).toEqual(["June", "Kai"]);
    expect(visiblePeople(state, treeId, kai.id, "ancestors", 2).map(person => person.givenName)).toEqual(["Alex", "Mei", "June", "Kai"]);
    expect(visiblePeople(state, treeId, alex.id, "descendants", 4).map(person => person.givenName)).toEqual(["Alex", "June", "Kai"]);
  });

  it("lays out partners together, descendants below parents, without overlapping nodes", () => {
    const state = createSeedState();
    const layout = layoutFamily(state.people, state.relationships);
    const at = (name: string) => layout.find(node => node.person.givenName === name)!.position;
    expect(at("Alex").y).toBe(at("Mei").y);
    expect(at("June").y).toBeGreaterThan(at("Alex").y + NODE_HEIGHT);
    expect(at("Kai").y).toBeGreaterThan(at("June").y + NODE_HEIGHT);
    for (let a = 0; a < layout.length; a++) for (let b = a + 1; b < layout.length; b++) {
      expect(Math.abs(layout[a].position.x - layout[b].position.x) >= NODE_WIDTH || Math.abs(layout[a].position.y - layout[b].position.y) >= NODE_HEIGHT).toBe(true);
    }
  });

  it("handles wide families, disconnected people and shared ancestors without dropping people", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    for (let index = 0; index < 30; index++) {
      const person = createEmptyPerson(treeId);
      state.people.push(person);
      linkPeople(state, treeId, "parent-child", state.people[0].id, person.id);
    }
    state.people.push(createEmptyPerson(treeId));
    const nodes = layoutFamily(state.people, state.relationships);
    expect(new Set(nodes.map(node => node.person.id)).size).toBe(35);
    nodes.forEach(node => expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true));
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      expect(Math.abs(nodes[a].position.x - nodes[b].position.x) >= NODE_WIDTH || Math.abs(nodes[a].position.y - nodes[b].position.y) >= NODE_HEIGHT).toBe(true);
    }
  });

  it("rejects self links, cross-tree links, duplicates, reversed partners and ancestry cycles", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const [alex, mei, june, kai] = state.people;
    expect(relationshipError(state, treeId, "parent-child", kai.id, alex.id)).toContain("circular");
    expect(relationshipError(state, treeId, "parent-child", alex.id, june.id)).toContain("already exists");
    expect(relationshipError(state, treeId, "spouse", mei.id, alex.id)).toContain("already exists");
    expect(relationshipError(state, treeId, "parent-child", alex.id, alex.id)).toContain("themselves");
    const stranger = createEmptyPerson("another-tree");
    state.people.push(stranger);
    expect(relationshipError(state, treeId, "partner", alex.id, stranger.id)).toContain("this tree");
    expect(() => linkPeople(state, treeId, "parent-child", kai.id, alex.id)).toThrow();
  });

  it("updates family memberships and groups when a child is linked and unlinked", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const child = createEmptyPerson(treeId);
    state.people.push(child);
    linkPeople(state, treeId, "parent-child", state.people[0].id, child.id);
    expect(state.families[0].childIds).toContain(child.id);
    expect(familyGroups(state, treeId)[0].children.map(person => person.id)).toContain(child.id);
    state.relationships = state.relationships.filter(rel => rel.toId !== child.id);
    syncFamilyMembership(state, treeId);
    expect(state.families[0].childIds).not.toContain(child.id);
    expect(familyGroups(state, treeId)[0].children.map(person => person.id)).not.toContain(child.id);
  });

  it("stores relationship subtypes for custom relatives without changing ancestry", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const relative = createEmptyPerson(treeId);
    relative.id = "person_in_law";
    relative.givenName = "Morgan";
    state.people.push(relative);
    linkPeople(state, treeId, "relative", "person_june", relative.id, undefined, undefined, undefined, "Cousin-in-law");
    const relationship = state.relationships.find(rel => rel.type === "relative" && rel.toId === relative.id)!;
    expect(relationship.subtype).toBe("Cousin-in-law");
    expect(visiblePeople(state, treeId, relative.id, "ancestors", 3).map(person => person.id)).toEqual([relative.id]);
  });
});

function layoutFixture(names: string[], connections: Array<[RelationshipType, string, string]>) {
  const people = names.map(id => ({ ...createEmptyPerson("tree"), id, givenName: id }));
  const relationships: Relationship[] = connections.map(([type, fromId, toId], index) => ({ id: `rel-${index}`, treeId: "tree", type, fromId, toId, sourceIds: [] }));
  const layout = layoutFamily(people, relationships);
  const at = (id: string) => layout.find(node => node.person.id === id)!.position;
  return { people, relationships, layout, at };
}

function expectNoOverlap(layout: ReturnType<typeof layoutFamily>) {
  layout.forEach(node => expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true));
  for (let a = 0; a < layout.length; a++) for (let b = a + 1; b < layout.length; b++) {
    expect(Math.abs(layout[a].position.x - layout[b].position.x) >= NODE_WIDTH || Math.abs(layout[a].position.y - layout[b].position.y) >= NODE_HEIGHT).toBe(true);
  }
}

describe("Sibling and generation placement", () => {
  it("places an explicitly linked sibling beside a descendant, without inventing parents", () => {
    const { at, layout, relationships } = layoutFixture(["parent", "child", "sibling", "grandchild"], [
      ["parent-child", "parent", "child"], ["sibling", "child", "sibling"], ["parent-child", "sibling", "grandchild"]
    ]);
    expect(at("sibling").y).toBe(at("child").y);
    expect(at("sibling").x).toBeGreaterThan(at("child").x + NODE_WIDTH);
    expect(at("child").y).toBeGreaterThan(at("parent").y + NODE_HEIGHT);
    expect(at("grandchild").y).toBeGreaterThan(at("sibling").y + NODE_HEIGHT);
    expect(relationships).toHaveLength(3);
    expectNoOverlap(layout);
  });

  it("aligns siblings inferred from a shared parent despite different descendant depths", () => {
    const { at, layout } = layoutFixture(["parent", "a", "b", "c", "grandchild", "great-grandchild"], [
      ["parent-child", "parent", "a"], ["parent-child", "parent", "b"], ["parent-child", "parent", "c"],
      ["parent-child", "a", "grandchild"], ["parent-child", "grandchild", "great-grandchild"]
    ]);
    expect(at("a").y).toBe(at("b").y);
    expect(at("b").y).toBe(at("c").y);
    expect(at("grandchild").y).toBeGreaterThan(at("a").y + NODE_HEIGHT);
    expectNoOverlap(layout);
  });

  it("keeps half siblings and their respective partners on the same generation row", () => {
    const { at, layout } = layoutFixture(["parent", "other-parent", "a", "b", "partner-a", "partner-b", "baby"], [
      ["parent-child", "parent", "a"], ["parent-child", "parent", "b"], ["parent-child", "other-parent", "b"],
      ["partner", "a", "partner-a"], ["spouse", "b", "partner-b"], ["parent-child", "b", "baby"]
    ]);
    for (const id of ["b", "partner-a", "partner-b"]) expect(at(id).y).toBe(at("a").y);
    expect(at("partner-a").x - at("a").x).toBeGreaterThanOrEqual(NODE_WIDTH + 48);
    expect(at("partner-b").x - at("b").x).toBeGreaterThanOrEqual(NODE_WIDTH + 48);
    const row = layout.filter(node => node.position.y === at("a").y).sort((a, b) => a.position.x - b.position.x).map(node => node.person.id);
    expect(Math.abs(row.indexOf("a") - row.indexOf("partner-a"))).toBe(1);
    expect(Math.abs(row.indexOf("b") - row.indexOf("partner-b"))).toBe(1);
    expect(at("baby").y).toBeGreaterThan(at("a").y + NODE_HEIGHT);
    expectNoOverlap(layout);
  });

  it("keeps shorter cousin branches at the correct depth instead of sinking to the bottom", () => {
    const { at, layout } = layoutFixture(["root", "a", "b", "cousin-a", "cousin-b", "youngest"], [
      ["parent-child", "root", "a"], ["parent-child", "root", "b"], ["parent-child", "a", "cousin-a"],
      ["parent-child", "b", "cousin-b"], ["parent-child", "cousin-a", "youngest"]
    ]);
    expect(at("cousin-a").y).toBe(at("cousin-b").y);
    expect(at("cousin-a").x).toBeLessThan(at("cousin-b").x);
    expect(at("youngest").x).toBe(at("cousin-a").x);
    expect(at("youngest").y).toBeGreaterThan(at("cousin-b").y + NODE_HEIGHT);
    expectNoOverlap(layout);
  });

  it("recognizes shared parents outside a filtered view", () => {
    const { at, layout } = layoutFixture(["a", "b", "child"], [
      ["parent-child", "hidden-parent", "a"], ["parent-child", "hidden-parent", "b"], ["parent-child", "a", "child"]
    ]);
    expect(at("a").y).toBe(at("b").y);
    expect(at("child").y).toBeGreaterThan(at("a").y + NODE_HEIGHT);
    expectNoOverlap(layout);
  });

  it("does not turn sibling guardianship into a parent generation", () => {
    const { at } = layoutFixture(["a", "b"], [["sibling", "a", "b"], ["guardian", "a", "b"]]);
    expect(at("a").y).toBe(at("b").y);
  });

  it("does not collapse ancestry to force a cross-generation partnership onto one row", () => {
    const { at, layout } = layoutFixture(["a", "b", "c"], [["parent-child", "a", "b"], ["parent-child", "b", "c"], ["partner", "a", "c"]]);
    expect(at("b").y).toBeGreaterThan(at("a").y + NODE_HEIGHT);
    expect(at("c").y).toBeGreaterThan(at("b").y + NODE_HEIGHT);
    expectNoOverlap(layout);
  });

  it("prevents indirect rank cycles when aligning multiple peer groups", () => {
    const { at, layout } = layoutFixture(["a", "b", "c", "d"], [
      ["parent-child", "a", "b"], ["parent-child", "c", "d"], ["sibling", "a", "d"], ["partner", "b", "c"]
    ]);
    expect(at("a").y).toBe(at("d").y);
    expect(at("b").y).toBeGreaterThan(at("a").y);
    expect(at("d").y).toBeGreaterThan(at("c").y);
    expectNoOverlap(layout);
  });

  it("ignores relationships from a different tree", () => {
    const { people, relationships } = layoutFixture(["a", "b"], [["parent-child", "a", "b"]]);
    relationships[0].treeId = "different-tree";
    const layout = layoutFamily(people, relationships);
    expect(layout[0].position.y).toBe(layout[1].position.y);
    expectNoOverlap(layout);
  });

  it("handles empty trees and renders invalid imported cycles without hanging", () => {
    expect(layoutFamily([], [])).toEqual([]);
    expectNoOverlap(layoutFixture(["a", "b"], [["parent-child", "a", "b"], ["parent-child", "b", "a"]]).layout);
  });

  it("ignores saved vertical positions and repairs horizontal collisions", () => {
    const { layout, at } = layoutFixture(["parent", "a", "b"], [["parent-child", "parent", "a"], ["parent-child", "parent", "b"]]);
    const restored = positionFamily(layout, { a: { x: 20, y: -500 }, b: { x: 20, y: 99999 } });
    expect(restored[1].position.y).toBe(at("a").y);
    expect(restored[2].position.y).toBe(at("a").y);
    expectNoOverlap(restored);
  });

  it("moves cards horizontally and makes room without changing generations", () => {
    const { layout } = layoutFixture(["parent", "a", "b", "c"], [["parent-child", "parent", "a"], ["parent-child", "parent", "b"], ["parent-child", "parent", "c"]]);
    for (const x of [900, -900]) {
      const moved = moveWithinGeneration(layout, {}, "b", x);
      expect(moved.b.x).toBe(x);
      layout.forEach(node => expect(moved[node.person.id].y).toBe(node.position.y));
      expectNoOverlap(positionFamily(layout, moved));
      expect(positionFamily(layout, moved).map(node => node.position)).toEqual(layout.map(node => moved[node.person.id]));
    }
  });
});

describe("Workspace page addresses", () => {
  it("restores a specific person and tab from a deep link", () => {
    const state = createSeedState();
    const route = { treeId: state.trees[0].id, view: "people" as const, personId: state.people[2].id, tab: "timeline" };
    expect(resolveWorkspaceRoute(workspacePath(route), state)).toEqual(route);
  });
  it("opens the tree by default and never selects a person from another tree", () => {
    const state = createSeedState();
    const other = createEmptyPerson("other-tree");
    state.people.push(other);
    expect(resolveWorkspaceRoute("/", state).view).toBe("tree");
    expect(resolveWorkspaceRoute(`/trees/${state.trees[0].id}/people/${other.id}/edit`, state).personId).toBeUndefined();
    expect(resolveWorkspaceRoute("/broken/address", state).treeId).toBe(state.trees[0].id);
  });
});

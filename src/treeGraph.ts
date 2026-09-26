import dagre from "@dagrejs/dagre";
import { AppState, ParentRole, Person, Relationship, RelationshipType, fullName, makeId } from "./domain";
import { hasAncestryCycle } from "./analysis";
import { centerFamilyGroups } from "./treeCentering";

export type TreeMode = "family" | "ancestors" | "descendants" | "hourglass";
export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 254;
export const NODE_GAP = 48;
export type FamilyPosition = { x: number; y: number };
export type FamilyLayout = Array<{ person: Person; position: FamilyPosition }>;
export type FamilyPositions = Record<string, FamilyPosition>;

export function visiblePeople(state: AppState, treeId: string, focusId: string, mode: TreeMode, generations: number) {
  const people = state.people.filter(person => person.treeId === treeId);
  if (mode === "family") return people;
  const ids = new Set([focusId]);
  const links = state.relationships.filter(rel => rel.treeId === treeId && rel.type === "parent-child");
  const walk = (direction: "ancestors" | "descendants") => {
    let frontier = [focusId];
    for (let depth = 0; depth < generations && frontier.length; depth++) {
      const next = new Set<string>();
      links.forEach(rel => {
        const from = direction === "ancestors" ? rel.toId : rel.fromId;
        const to = direction === "ancestors" ? rel.fromId : rel.toId;
        if (frontier.includes(from) && !ids.has(to)) next.add(to);
      });
      next.forEach(id => ids.add(id));
      frontier = [...next];
    }
  };
  if (mode === "hourglass") { walk("ancestors"); walk("descendants"); }
  else walk(mode);
  return people.filter(person => ids.has(person.id));
}

export function layoutFamily(people: Person[], relationships: Relationship[]): FamilyLayout {
  const byId = new Map(people.map(person => [person.id, person]));
  const links = relationships.filter(rel => byId.get(rel.fromId)?.treeId === rel.treeId && byId.get(rel.toId)?.treeId === rel.treeId);
  const group = new Map(people.map(person => [person.id, person.id]));
  const root = (id: string): string => {
    let current = id;
    while (group.get(current) !== current) current = group.get(current)!;
    return current;
  };
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: 64, ranksep: 115, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));
  people.forEach(person => graph.setNode(person.id, {}));
  links.filter(rel => rel.type === "parent-child" && rel.fromId !== rel.toId).forEach(rel => graph.setEdge(rel.fromId, rel.toId));
  const reaches = (from: string, to: string) => dagre.graphlib.alg.preorder(graph, from).includes(to);
  const alignPeers = (first: string, second: string) => {
    const a = root(first), b = root(second);
    if (a === b || reaches(a, b) || reaches(b, a)) return;
    // Contract compatible same-generation groups without collapsing an ancestry path.
    const parents = graph.predecessors(b) ?? [];
    const children = graph.successors(b) ?? [];
    group.set(b, a);
    graph.removeNode(b);
    parents.forEach(parent => graph.setEdge(parent, a));
    children.forEach(child => graph.setEdge(a, child));
  };
  links.filter(rel => rel.type === "sibling").forEach(rel => alignPeers(rel.fromId, rel.toId));
  const firstChild = new Map<string, string>();
  relationships.filter(rel => rel.type === "parent-child" && byId.get(rel.toId)?.treeId === rel.treeId).forEach(rel => {
    const key = `${rel.treeId}:${rel.fromId}`;
    const sibling = firstChild.get(key);
    if (sibling) alignPeers(sibling, rel.toId);
    else firstChild.set(key, rel.toId);
  });
  links.filter(rel => rel.type === "partner" || rel.type === "spouse").forEach(rel => alignPeers(rel.fromId, rel.toId));
  // A sibling can also be a guardian; care relationships must not override generations.
  links.filter(rel => rel.type === "guardian").forEach(rel => {
    const from = root(rel.fromId), to = root(rel.toId);
    if (from !== to && !reaches(to, from)) graph.setEdge(from, to);
  });
  const households = new Map<string, Person[]>();
  people.forEach(person => households.set(root(person.id), [...(households.get(root(person.id)) ?? []), person]));
  // Keep each partner group contiguous inside its sibling generation, including
  // partners entered after the rest of the family.
  households.forEach((members, id) => {
    const remaining = new Set(members.map(person => person.id));
    const ordered: Person[] = [];
    const partners = (person: Person) => links.filter(rel => (rel.type === "spouse" || rel.type === "partner") && (rel.fromId === person.id || rel.toId === person.id))
      .map(rel => byId.get(rel.fromId === person.id ? rel.toId : rel.fromId)!).filter(partner => root(partner.id) === id);
    const visit = (person: Person) => {
      if (!remaining.delete(person.id)) return;
      ordered.push(person);
      partners(person).forEach(visit);
    };
    members.forEach(person => {
      if (!remaining.has(person.id)) return;
      const component = new Set<Person>();
      const collect = (member: Person) => {
        if (component.has(member)) return;
        component.add(member);
        partners(member).forEach(collect);
      };
      collect(person);
      // Starting at an endpoint puts a person with two partners between them.
      visit([...component].find(member => partners(member).length <= 1) ?? person);
    });
    households.set(id, ordered);
  });
  households.forEach((members, id) => graph.setNode(id, { width: members.length * (NODE_WIDTH + NODE_GAP) - NODE_GAP, height: NODE_HEIGHT }));
  const generations = new Map<string, number>();
  if (dagre.graphlib.alg.isAcyclic(graph)) {
    dagre.graphlib.alg.topsort(graph).forEach(id => generations.set(id, Math.max(0, ...(graph.predecessors(id) ?? []).map(parent => generations.get(parent)! + 1))));
  }
  dagre.layout(graph);
  const groupPositions = new Map<string, FamilyPosition>();
  const rowY = (id: string) => generations.has(id) ? 40 + generations.get(id)! * (NODE_HEIGHT + 115) : graph.node(id).y - NODE_HEIGHT / 2;
  const parentIds = new Map<string, Set<string>>();
  links.filter(rel => ["parent-child", "guardian"].includes(rel.type)).forEach(rel => {
    const id = root(rel.toId);
    if (root(rel.fromId) !== id) parentIds.set(id, new Set([...(parentIds.get(id) ?? []), rel.fromId]));
  });
  const rows = new Map<number, string[]>();
  households.forEach((_, id) => rows.set(rowY(id), [...(rows.get(rowY(id)) ?? []), id]));
  // Keep each child branch under its actual parents within the generation row.
  [...rows].sort(([a], [b]) => a - b).forEach(([y, ids]) => {
    const anchored = ids.map(id => {
      const anchors = [...(parentIds.get(id) ?? [])].flatMap(parent => {
        const parentGroup = root(parent), position = groupPositions.get(parentGroup);
        return position && position.y < y ? [position.x + households.get(parentGroup)!.findIndex(person => person.id === parent) * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2] : [];
      });
      return { id, center: anchors.length ? anchors.reduce((sum, x) => sum + x, 0) / anchors.length : graph.node(id).x };
    }).sort((a, b) => a.center - b.center);
    let rightEdge = -Infinity;
    anchored.forEach(({ id, center }) => {
      const width = graph.node(id).width;
      const x = Math.max(center - width / 2, rightEdge);
      groupPositions.set(id, { x, y });
      rightEdge = x + width + 64;
    });
  });
  const layout = people.map(person => {
    const members = households.get(root(person.id))!;
    const position = groupPositions.get(root(person.id))!;
    return { person, position: { x: position.x + members.indexOf(person) * (NODE_WIDTH + NODE_GAP), y: position.y } };
  });
  return centerFamilyGroups(layout, links, NODE_WIDTH + NODE_GAP);
}

export function positionFamily(layout: FamilyLayout, saved: FamilyPositions = {}, relationships: Relationship[] = []): FamilyLayout {
  const rightEdges = new Map<number, number>();
  const positions = new Map<string, FamilyPosition>();
  [...layout].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x).forEach(({ person, position }) => {
    const desired = saved[person.id]?.x;
    const x = Math.max(Number.isFinite(desired) ? desired : position.x, rightEdges.get(position.y) ?? -Infinity);
    positions.set(person.id, { x, y: position.y });
    rightEdges.set(position.y, x + NODE_WIDTH + NODE_GAP);
  });
  return centerFamilyGroups(layout.map(node => ({ ...node, position: positions.get(node.person.id)! })), relationships, NODE_WIDTH + NODE_GAP);
}

export function moveWithinGeneration(layout: FamilyLayout, current: FamilyPositions, personId: string, x: number, relationships: Relationship[] = []): FamilyPositions {
  const positioned = positionFamily(layout, current, relationships);
  const selected = positioned.find(node => node.person.id === personId);
  if (selected && Number.isFinite(x)) {
    const row = positioned.filter(node => node.position.y === selected.position.y).sort((a, b) => a.position.x - b.position.x);
    const index = row.indexOf(selected);
    selected.position.x = x;
    for (let i = index + 1; i < row.length; i++) row[i].position.x = Math.max(row[i].position.x, row[i - 1].position.x + NODE_WIDTH + NODE_GAP);
    for (let i = index - 1; i >= 0; i--) row[i].position.x = Math.min(row[i].position.x, row[i + 1].position.x - NODE_WIDTH - NODE_GAP);
  }
  const centred = centerFamilyGroups(positioned, relationships, NODE_WIDTH + NODE_GAP, selected && Number.isFinite(x) ? { id: personId, x } : undefined);
  return Object.fromEntries(centred.map(node => [node.person.id, node.position]));
}

export function relationshipError(state: AppState, treeId: string, type: RelationshipType, fromId: string, toId: string) {
  const people = state.people.filter(person => person.treeId === treeId);
  if (!people.some(person => person.id === fromId) || !people.some(person => person.id === toId)) return "Choose two people from this tree.";
  if (fromId === toId) return "A person cannot be related to themselves.";
  const directed = type === "parent-child" || type === "guardian";
  if (state.relationships.some(rel => rel.treeId === treeId && rel.type === type && ((rel.fromId === fromId && rel.toId === toId) || (!directed && rel.fromId === toId && rel.toId === fromId)))) return "This relationship already exists.";
  if (type === "parent-child" && hasAncestryCycle(state.relationships.filter(rel => rel.treeId === treeId), fromId, toId)) return "This would create a circular ancestry. A descendant cannot be their own ancestor.";
  return "";
}

export function linkPeople(draft: AppState, treeId: string, type: RelationshipType, fromId: string, toId: string, parentRole?: ParentRole, parentage?: import("./reportOptions").Parentage, status?: string, subtype?: string) {
  const error = relationshipError(draft, treeId, type, fromId, toId);
  if (error) throw new Error(error);
  draft.relationships.push({ id: makeId("rel"), treeId, type, fromId, toId, sourceIds: [], ...(status ? { status } : {}), ...(subtype?.trim() ? { subtype: subtype.trim() } : {}), ...(type === "parent-child" && parentRole ? { parentRole } : {}), ...(type === "parent-child" && parentage ? { parentage } : {}) });
  syncFamilyMembership(draft, treeId);
}

export function syncFamilyMembership(draft: AppState, treeId: string) {
  const links = draft.relationships.filter(rel => rel.treeId === treeId);
  draft.families.filter(family => family.treeId === treeId).forEach(family => {
    family.childIds = [...new Set(links.filter(rel => rel.type === "parent-child" && family.partnerIds.includes(rel.fromId)).map(rel => rel.toId))];
  });
}

export function familyGroups(state: AppState, treeId: string) {
  const people = state.people.filter(person => person.treeId === treeId);
  const links = state.relationships.filter(rel => rel.treeId === treeId);
  const groups: Array<{ id: string; title: string; parents: Person[]; children: Person[] }> = [];
  const assigned = new Set<string>();
  links.filter(rel => rel.type === "spouse" || rel.type === "partner").forEach(rel => {
    const parents = people.filter(person => person.id === rel.fromId || person.id === rel.toId);
    const children = people.filter(person => links.some(link => link.type === "parent-child" && parents.some(parent => parent.id === link.fromId) && link.toId === person.id));
    parents.forEach(parent => assigned.add(parent.id));
    groups.push({ id: rel.id, title: parents.map(fullName).join(" & "), parents, children });
  });
  people.filter(person => !assigned.has(person.id)).forEach(parent => {
    const children = people.filter(person => links.some(rel => rel.type === "parent-child" && rel.fromId === parent.id && rel.toId === person.id));
    if (children.length) groups.push({ id: parent.id, title: fullName(parent), parents: [parent], children });
  });
  return groups;
}

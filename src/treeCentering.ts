import { Constraint, Expression, Operator, Solver, Strength, Variable } from "@lume/kiwi";
import type { Relationship } from "./domain";
import type { FamilyLayout } from "./treeGraph";

export function centerFamilyGroups(layout: FamilyLayout, relationships: Relationship[], spacing: number, move?: { id: string; x: number }): FamilyLayout {
  if (!layout.length) return layout;
  const at = new Map(layout.map(node => [node.person.id, node]));
  let ordered = [...layout].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const parentSets = new Map<string, Set<string>>();
  relationships.filter(rel => rel.type === "parent-child" && at.get(rel.fromId)?.person.treeId === rel.treeId && at.get(rel.toId)?.person.treeId === rel.treeId && at.get(rel.fromId)!.position.y < at.get(rel.toId)!.position.y).forEach(rel => {
    parentSets.set(rel.toId, new Set([...(parentSets.get(rel.toId) ?? []), rel.fromId]));
  });
  const rows = new Map<number, FamilyLayout>();
  ordered.forEach(node => rows.set(node.position.y, [...(rows.get(node.position.y) ?? []), node]));
  ordered = [...rows.values()].flatMap(row => {
    const remaining = new Set(row.map(node => node.person.id));
    const units: Array<{ nodes: FamilyLayout; parents: Set<string> }> = [];
    row.forEach(node => {
      if (!remaining.has(node.person.id)) return;
      const members = new Set<string>();
      const visit = (id: string) => {
        if (!remaining.delete(id)) return;
        members.add(id);
        relationships.filter(rel => (rel.type === "spouse" || rel.type === "partner") && rel.treeId === node.person.treeId && (rel.fromId === id || rel.toId === id)).forEach(rel => visit(rel.fromId === id ? rel.toId : rel.fromId));
      };
      visit(node.person.id);
      const nodes = row.filter(member => members.has(member.person.id));
      units.push({ nodes, parents: new Set(nodes.flatMap(member => [...(parentSets.get(member.person.id) ?? [])])) });
    });
    // Shared-parent families need the same left-to-right order as their parents.
    // Leave incomplete sibling records in their existing order.
    if (units.every(unit => unit.parents.size)) units.sort((a, b) => {
      const anchor = (unit: typeof a) => [...unit.parents].reduce((sum, id) => sum + at.get(id)!.position.x, 0) / unit.parents.size;
      return anchor(a) - anchor(b);
    });
    return units.flatMap(unit => unit.nodes);
  });
  const families = new Map<string, { parents: string[]; children: string[] }>();
  ordered.forEach(node => {
    const parents = [...(parentSets.get(node.person.id) ?? [])].sort();
    if (!parents.length) return;
    const key = JSON.stringify([parents, node.position.y]);
    const family = families.get(key) ?? { parents, children: [] };
    family.children.push(node.person.id);
    families.set(key, family);
  });
  const centred = [...families.values()].every(({ parents, children }) => Math.abs(
    parents.reduce((sum, id) => sum + at.get(id)!.position.x, 0) / parents.length
    - (at.get(children[0])!.position.x + at.get(children[children.length - 1])!.position.x) / 2
  ) < 0.000001);
  const separated = ordered.every((node, index) => !index || ordered[index - 1].position.y !== node.position.y || node.position.x - ordered[index - 1].position.x >= spacing - 0.000001);
  if (centred && separated && (!move || !at.has(move.id) || Math.abs(at.get(move.id)!.position.x - move.x) < 0.000001)) return layout;

  const solver = new Solver();
  const xs = new Map(layout.map(node => [node.person.id, new Variable(node.person.id)]));
  ordered.forEach((node, index) => {
    const x = xs.get(node.person.id)!;
    solver.addConstraint(new Constraint(x, Operator.Eq, node.position.x, Strength.medium));
    const previous = ordered[index - 1];
    if (previous?.position.y === node.position.y) {
      const gap = new Expression(x, [-1, xs.get(previous.person.id)!]);
      solver.addConstraint(new Constraint(gap, Operator.Ge, spacing));
      solver.addConstraint(new Constraint(gap, Operator.Eq, spacing, Strength.weak));
    }
  });
  relationships.filter(rel => (rel.type === "spouse" || rel.type === "partner") && at.get(rel.fromId)?.person.treeId === rel.treeId && at.get(rel.toId)?.person.treeId === rel.treeId && at.get(rel.fromId)!.position.y === at.get(rel.toId)!.position.y).forEach(rel => {
    const [left, right] = [rel.fromId, rel.toId].sort((a, b) => at.get(a)!.position.x - at.get(b)!.position.x);
    const index = ordered.findIndex(node => node.person.id === left);
    if (ordered[index + 1]?.person.id === right) solver.addConstraint(new Constraint(new Expression(xs.get(right)!, [-1, xs.get(left)!]), Operator.Eq, spacing, Strength.create(0, 10, 0)));
  });
  // Solve centres and card spacing together, so centring moves whole families
  // instead of disguising an offset with a sideways connector.
  families.forEach(({ parents, children }) => {
    const expression = new Expression(...parents.map(id => [1 / parents.length, xs.get(id)!]), [-0.5, xs.get(children[0])!], [-0.5, xs.get(children[children.length - 1])!]);
    // Hard non-overlap constraints still take precedence for contradictory imports.
    solver.addConstraint(new Constraint(expression, Operator.Eq, 0, Strength.create(100, 0, 0)));
  });
  if (move && xs.has(move.id) && Number.isFinite(move.x)) solver.addConstraint(new Constraint(xs.get(move.id)!, Operator.Eq, move.x));
  solver.updateVariables();
  return layout.map(node => ({ ...node, position: { x: Math.round(xs.get(node.person.id)!.value() * 1000000) / 1000000, y: node.position.y } }));
}

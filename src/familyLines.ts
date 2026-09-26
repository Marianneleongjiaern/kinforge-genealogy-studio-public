import { Relationship, fullName } from "./domain";
import { FamilyLayout, FamilyPosition, NODE_HEIGHT, NODE_WIDTH } from "./treeGraph";

export const LINE_STYLES = {
  married: { label: "Married", color: "#8b4f73", dash: undefined, sample: "M4 14 H60" },
  engaged: { label: "Engaged", color: "#b06f2e", dash: "10 4", sample: "M4 14 H60" },
  dating: { label: "Dating", color: "#4f77a8", dash: "2 4", sample: "M4 14 H60" },
  partner: { label: "Partners", color: "#735aa6", dash: "8 4", sample: "M4 14 H60" },
  civilUnion: { label: "Civil union", color: "#6b6fb3", dash: "14 3 3 3", sample: "M4 14 H60" },
  separated: { label: "Separated", color: "#b48539", dash: "12 5", sample: "M4 14 H60" },
  divorced: { label: "Divorced", color: "#a34d45", dash: "6 3 1 3", sample: "M4 14 H60" },
  annulled: { label: "Annulled", color: "#5f6068", dash: "3 3", sample: "M4 14 H60" },
  descent: { label: "Parents & children", color: "#396e75", dash: undefined, sample: "M32 2 V14 M8 26 V14 H56 V26" },
  biological: { label: "Biological parentage", color: "#2f7b58", dash: undefined, sample: "M32 2 V14 M8 26 V14 H56 V26" },
  adoptive: { label: "Adoptive parentage", color: "#7b5bb5", dash: "9 3", sample: "M32 2 V14 M8 26 V14 H56 V26" },
  foster: { label: "Foster parentage", color: "#9b6a2f", dash: "2 3", sample: "M32 2 V14 M8 26 V14 H56 V26" },
  step: { label: "Step parentage", color: "#5f7fa5", dash: "14 4 2 4", sample: "M32 2 V14 M8 26 V14 H56 V26" },
  immediateFamily: { label: "Immediate family", color: "#226d7b", dash: "5 2", sample: "M4 14 H60" },
  extendedFamily: { label: "Extended family", color: "#7b6a42", dash: "3 5", sample: "M4 14 H60" },
  cousin: { label: "Cousins", color: "#7f5a94", dash: "1 4", sample: "M8 24 V8 H56 V24" },
  relative: { label: "Other relatives and in-laws", color: "#9f7a85", dash: "5 4 1 4", sample: "M4 14 H60" },
  sibling: { label: "Siblings, parents not linked", color: "#506d97", dash: "2 4", sample: "M8 24 V8 H56 V24" },
  biologicalSibling: { label: "Biological siblings", color: "#2f7b58", dash: "4 2", sample: "M8 24 V8 H56 V24" },
  adoptiveSibling: { label: "Adoptive siblings", color: "#7b5bb5", dash: "9 3", sample: "M8 24 V8 H56 V24" },
  fosterSibling: { label: "Foster siblings", color: "#9b6a2f", dash: "2 3", sample: "M8 24 V8 H56 V24" },
  stepSibling: { label: "Step siblings", color: "#5f7fa5", dash: "14 4 2 4", sample: "M8 24 V8 H56 V24" },
  halfSibling: { label: "Half siblings", color: "#8a6778", dash: "6 3", sample: "M8 24 V8 H56 V24" },
  coparent: { label: "Co-parents, no union recorded", color: "#396e75", dash: "2 4", sample: "M8 2 V14 H56 V2 M32 14 V26" },
  guardian: { label: "Guardian & ward", color: "#736841", dash: "8 3 2 3", sample: "M4 4 H32 V24 H60" },
} as const;
export type LineKind = keyof typeof LINE_STYLES;
export type LinePath = { kind: LineKind; d: string };
export type UnionStatus = "engaged" | "dating" | "married" | "partner" | "civilUnion" | "separated" | "divorced" | "annulled";
export const UNION_STATUS_LABELS: Record<UnionStatus, string> = {
  engaged: "Engaged",
  dating: "Dating",
  married: "Married",
  partner: "Partners",
  civilUnion: "Civil union",
  separated: "Separated",
  divorced: "Divorced",
  annulled: "Annulled"
};
export type FamilyLine = {
  id: string;
  source: string;
  target: string;
  description: string;
  paths: LinePath[];
  parentIds: string[];
  childIds: string[];
  junction?: FamilyPosition;
  fork?: FamilyPosition;
  status?: UnionStatus;
};

export function unionStatus(status?: string): UnionStatus | undefined {
  const key = status?.trim().toLowerCase();
  if (!key) return undefined;
  if (key === "engaged" || key === "engagement" || key === "fiance" || key === "fiancee") return "engaged";
  if (key === "dating" || key === "courting" || key === "courtship") return "dating";
  if (key === "married" || key === "marriage" || key === "spouse") return "married";
  if (key === "partner" || key === "partnership" || key === "domestic partner") return "partner";
  if (key === "civil union" || key === "civil-union" || key === "civil_union") return "civilUnion";
  if (key === "separated" || key === "separation") return "separated";
  if (key === "divorced" || key === "divorce") return "divorced";
  if (key === "annulled" || key === "annulment") return "annulled";
}

export function statusMark(status: UnionStatus, { x, y }: FamilyPosition): string {
  if (status === "annulled") return `M${x - 6} ${y - 7} L${x + 6} ${y + 7} M${x - 6} ${y + 7} L${x + 6} ${y - 7}`;
  if (status === "divorced") return `M${x - 7} ${y + 7} L${x - 1} ${y - 7} M${x + 1} ${y + 7} L${x + 7} ${y - 7}`;
  if (status === "separated") return `M${x - 3} ${y + 7} L${x + 3} ${y - 7}`;
  return `M${x - 3} ${y + 7} L${x + 3} ${y - 7}`;
}

export function unionLineKind(type: "spouse" | "partner", status?: string): LineKind {
  const explicit = unionStatus(status);
  if (explicit) return explicit;
  return type === "spouse" ? "married" : "partner";
}

export function siblingLineKind(status?: string): LineKind {
  const key = status?.trim().toLowerCase();
  if (key === "biological" || key === "biology" || key === "bio") return "biologicalSibling";
  if (key === "adoptive" || key === "adopted") return "adoptiveSibling";
  if (key === "foster") return "fosterSibling";
  if (key === "step" || key === "step-sibling") return "stepSibling";
  if (key === "half" || key === "half-sibling") return "halfSibling";
  return "sibling";
}

const pairKey = (ids: string[]) => JSON.stringify([...ids].sort());
const parentageKinds = new Set<LineKind>(["biological", "adoptive", "foster", "step"]);

/** Render junctions from recorded parent links, never from a partner's assumed parentage. */
export function familyLines(layout: FamilyLayout, relationships: Relationship[]): FamilyLine[] {
  const at = new Map(layout.map(node => [node.person.id, node]));
  const links = relationships.filter(rel => rel.fromId !== rel.toId && at.get(rel.fromId)?.person.treeId === rel.treeId && at.get(rel.toId)?.person.treeId === rel.treeId);
  const center = (id: string) => at.get(id)!.position.x + NODE_WIDTH / 2;
  const top = (id: string) => at.get(id)!.position.y;
  const bottom = (id: string) => top(id) + NODE_HEIGHT;
  const names = (ids: string[]) => ids.map(id => fullName(at.get(id)!.person)).join(" and ");
  const result: FamilyLine[] = [];
  const unions = new Map<string, FamilyLine>();
  const parents = new Map<string, Set<string>>();
  links.filter(rel => rel.type === "parent-child").forEach(rel => parents.set(rel.toId, new Set([...(parents.get(rel.toId) ?? []), rel.fromId])));
  const descentKind = (parentIds: string[], childIds: string[]): LineKind => {
    const values = new Set(links
      .filter(rel => rel.type === "parent-child" && parentIds.includes(rel.fromId) && childIds.includes(rel.toId))
      .map(rel => rel.parentage || "unspecified"));
    const [only] = [...values];
    return values.size === 1 && parentageKinds.has(only as LineKind) ? only as LineKind : "descent";
  };

  links.filter(rel => rel.type === "spouse" || rel.type === "partner").sort((a, b) => Number(b.type === "spouse") - Number(a.type === "spouse")).forEach(rel => {
    const key = pairKey([rel.fromId, rel.toId]);
    if (unions.has(key)) return;
    const [left, right] = [rel.fromId, rel.toId].sort((a, b) => center(a) - center(b));
    const adjacent = top(left) === top(right) && !layout.some(node => node.position.y === top(left) && center(node.person.id) > center(left) && center(node.person.id) < center(right));
    const junction = adjacent
      ? { x: (center(left) + center(right)) / 2, y: top(left) + NODE_HEIGHT / 2 }
      : { x: (center(left) + center(right)) / 2, y: Math.max(bottom(left), bottom(right)) + 20 };
    // Non-adjacent unions run below the cards instead of through another person.
    const d = adjacent
      ? `M${center(left) + NODE_WIDTH / 2} ${junction.y} H${center(right) - NODE_WIDTH / 2}`
      : `M${center(left)} ${bottom(left)} V${junction.y} H${center(right)} V${bottom(right)}`;
    const status = unionStatus(rel.status);
    const kind = unionLineKind(rel.type as "spouse" | "partner", rel.status);
    const line: FamilyLine = {
      id: `union:${rel.id}`, source: left, target: right, junction,
      description: `${LINE_STYLES[kind].label}: ${names([left, right])}${status ? `; ${UNION_STATUS_LABELS[status]}` : ""}`,
      paths: [{ kind, d }], parentIds: [], childIds: [], status,
    };
    unions.set(key, line);
    result.push(line);
  });

  // A single sibling bar serves children with the same recorded parent set and row.
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  parents.forEach((ids, child) => {
    const parentIds = [...ids].sort((a, b) => center(a) - center(b));
    const key = JSON.stringify([pairKey(parentIds), top(child)]);
    const family = families.get(key) ?? { parentIds, childIds: [] };
    family.childIds.push(child);
    families.set(key, family);
  });
  families.forEach(({ parentIds, childIds }, key) => {
    const union = parentIds.length === 2 && top(parentIds[0]) === top(parentIds[1]) ? unions.get(pairKey(parentIds)) : undefined;
    const railY = Math.max(...parentIds.map(bottom)) + 20;
    const junction = union?.junction ?? {
      x: parentIds.reduce((sum, id) => sum + center(id), 0) / parentIds.length,
      y: parentIds.length === 1 ? bottom(parentIds[0]) : railY,
    };
    const paths: LinePath[] = [];
    if (!union && parentIds.length > 1) {
      paths.push({ kind: "coparent", d: `${parentIds.map(id => `M${center(id)} ${bottom(id)} V${railY}`).join(" ")} M${center(parentIds[0])} ${railY} H${center(parentIds[parentIds.length - 1])}` });
    }
    const busY = Math.max(junction.y + 18, top(childIds[0]) - 34);
    const xs = childIds.map(center);
    const fork = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: busY };
    // Keep the final stem in the middle of this family's children. Mixed-parent
    // branches may need an elbow above the fork, never an off-centre sibling bar.
    const approachY = (Math.max(junction.y, ...parentIds.map(bottom)) + busY) / 2;
    const stem = Math.abs(junction.x - fork.x) < 0.00001
      ? `M${junction.x} ${junction.y} V${busY}`
      : `M${junction.x} ${junction.y} V${approachY} H${fork.x} V${busY}`;
    const kind = descentKind(parentIds, childIds);
    paths.push({ kind, d: `${stem} M${Math.min(...xs)} ${busY} H${Math.max(...xs)} ${childIds.map(id => `M${center(id)} ${busY} V${top(id)}`).join(" ")}` });
    result.push({ id: `family:${key}`, source: parentIds[0], target: childIds[0], parentIds, childIds, junction, fork, paths, description: `${LINE_STYLES[kind].label}: Parents: ${names(parentIds)}. Children: ${names(childIds)}.` });
  });

  links.filter(rel => rel.type === "sibling" || rel.type === "guardian" || rel.type === "relative").forEach((rel, index) => {
    if (rel.type === "sibling" && [...(parents.get(rel.fromId) ?? [])].some(id => parents.get(rel.toId)?.has(id))) return;
    const [left, right] = [rel.fromId, rel.toId].sort((a, b) => center(a) - center(b));
    let d: string;
    if (rel.type === "sibling" || rel.type === "relative" || top(left) === top(right)) {
      const y = Math.min(top(left), top(right)) - 20 - index * 10;
      d = `M${center(left)} ${top(left)} V${y} H${center(right)} V${top(right)}`;
    } else {
      const y = (bottom(rel.fromId) + top(rel.toId)) / 2;
      d = `M${center(rel.fromId)} ${bottom(rel.fromId)} V${y} H${center(rel.toId)} V${top(rel.toId)}`;
    }
    const kind = rel.type === "sibling" ? siblingLineKind(rel.status) : rel.type === "relative" ? "relative" : "guardian";
    result.push({ id: rel.id, source: rel.fromId, target: rel.toId, parentIds: [], childIds: [], description: `${rel.subtype || LINE_STYLES[kind].label}: ${names([rel.fromId, rel.toId])}`, paths: [{ kind, d }] });
  });
  return result;
}

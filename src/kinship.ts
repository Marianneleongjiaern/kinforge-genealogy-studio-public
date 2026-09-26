import dagre from "@dagrejs/dagre";
import { AppState, ParentRole, Relationship, fullName } from "./domain";
import type { Parentage } from "./reportOptions";
import { PARENTAGE_LABELS, reportParentageState } from "./reportParentage";

type Route = { path: string[]; role?: ParentRole };
export type KinshipPath = {
  ancestorId: string;
  referencePath: string[];
  relativePath: string[];
  referenceDistance: number;
  relativeDistance: number;
  label: string;
  side: string;
  degree?: number;
  removed?: number;
};
export type InLawPath = { cousin: KinshipPath; spouseId: string; kind: "cousins-spouse" | "spouses-cousin"; status?: string };
export type KinshipResult = { paths: KinshipPath[]; direct: string[]; connection: string[]; warning?: string; inLaws?: InLawPath[] };
export type KinshipOptions = { comparisonId?: string; includePrivate?: boolean; onlyCousins?: boolean; onlyRelated?: boolean; parentage?: "all" | Parentage; kinshipCategories?: string[] };
type ShortestPaths = Record<string, { distance: number; predecessor?: string }>;

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th"}`;
const removal = (n: number) => n === 1 ? "once" : n === 2 ? "twice" : n === 3 ? "three times" : `${n} times`;
const great = (n: number, base: string) => n === 0 ? base : n === 1 ? `great-${base}` : `${ordinal(n)}-great-${base}`;

export function kinshipName(referenceDistance: number, relativeDistance: number) {
  const a = referenceDistance, b = relativeDistance;
  if (!a && !b) return { label: "Self" };
  if (!a) return { label: b === 1 ? "Child" : great(b - 2, "grandchild") };
  if (!b) return { label: a === 1 ? "Parent" : great(a - 2, "grandparent") };
  if (a === 1 && b === 1) return { label: "Sibling" };
  if (b === 1) return { label: great(a - 2, "aunt/uncle") };
  if (a === 1) return { label: great(b - 2, "niece/nephew") };
  const degree = Math.min(a, b) - 1, removed = Math.abs(a - b);
  return { label: `${ordinal(degree)} cousin${removed ? `, ${removal(removed)} removed` : ""}`, degree, removed };
}

function restorePath(paths: ShortestPaths, source: string, target: string): string[] {
  if (!Number.isFinite(paths[target]?.distance)) return [];
  const path = [target], seen = new Set(path);
  while (path[0] !== source) {
    const previous = paths[path[0]]?.predecessor;
    if (!previous || seen.has(previous)) return [];
    path.unshift(previous); seen.add(previous);
  }
  return path;
}

export function createKinshipIndex(state: AppState, treeId: string) {
  const people = new Map(state.people.filter(p => p.treeId === treeId).map(p => [p.id, p]));
  const relationships = state.relationships.filter(r => r.treeId === treeId && people.has(r.fromId) && people.has(r.toId));
  const ancestry = new dagre.graphlib.Graph({ directed: true });
  const connections = new dagre.graphlib.Graph({ directed: false });
  for (const id of people.keys()) { ancestry.setNode(id); connections.setNode(id); }
  for (const rel of relationships) {
    connections.setEdge(rel.fromId, rel.toId);
    if (rel.type === "parent-child") ancestry.setEdge(rel.toId, rel.fromId);
  }
  const cyclic = new Set(dagre.graphlib.alg.findCycles(ancestry).flat());
  const cache = new Map<string, { routes: Map<string, Route[]>; invalid: boolean }>();
  const shortest = new Map<string, ShortestPaths>();
  const from = (id: string) => {
    if (!shortest.has(id)) shortest.set(id, dagre.graphlib.alg.dijkstra(ancestry, id));
    return shortest.get(id)!;
  };
  const routesFor = (id: string) => {
    if (cache.has(id)) return cache.get(id)!;
    const routes = new Map<string, Route[]>([[id, [{ path: [id] }]]]);
    const invalid = [...cyclic].some(node => Number.isFinite(from(id)[node]?.distance));
    if (!invalid) {
      // Keep a shortest route through each recorded first parent, including both sides.
      for (const parent of relationships.filter(r => r.type === "parent-child" && r.toId === id)) {
        const paths = from(parent.fromId);
        for (const ancestorId of Object.keys(paths)) {
          const path = restorePath(paths, parent.fromId, ancestorId);
          if (path.length) routes.set(ancestorId, [...(routes.get(ancestorId) || []), { path: [id, ...path], role: parent.parentRole }]);
        }
      }
    }
    const result = { routes, invalid }; cache.set(id, result); return result;
  };
  const calculate = (referenceId: string, relativeId: string): KinshipResult => {
    if (!people.has(referenceId) || !people.has(relativeId)) return { paths: [], direct: [], connection: [], warning: "Choose two people from this tree." };
    const direct = relationships.filter(r => r.type !== "parent-child" && ((r.fromId === referenceId && r.toId === relativeId) || (r.toId === referenceId && r.fromId === relativeId))).map(r => {
      const role = r.type === "guardian" ? (r.fromId === relativeId ? "Guardian" : "Ward") : r.type === "spouse" ? "Spouse" : r.type === "partner" ? "Partner" : r.type === "sibling" ? "Recorded sibling" : r.subtype || "Recorded relative";
      return `${role}${[r.status, r.subtype && r.subtype !== role ? r.subtype : ""].filter(Boolean).length ? ` (${[r.status, r.subtype && r.subtype !== role ? r.subtype : ""].filter(Boolean).join(", ")})` : ""}`;
    });
    const left = routesFor(referenceId), right = routesFor(relativeId);
    if (left.invalid || right.invalid) return { paths: [], direct, connection: [], warning: "Cannot calculate kinship: a parent-child cycle is reachable from one of these people. Correct the recorded ancestry first." };
    const candidates: KinshipPath[] = [];
    for (const [ancestorId, leftRoutes] of left.routes) {
      for (const a of leftRoutes) for (const b of right.routes.get(ancestorId) || []) {
        // A shared lower ancestor is the actual junction, not this higher ancestor.
        if (a.path.slice(0, -1).some(id => b.path.slice(0, -1).includes(id))) continue;
        const referenceDistance = a.path.length - 1, relativeDistance = b.path.length - 1;
        candidates.push({ ancestorId, referencePath: a.path, relativePath: b.path, referenceDistance, relativeDistance,
          ...kinshipName(referenceDistance, relativeDistance),
          side: !referenceDistance ? (relativeDistance ? "Direct descendant" : "Self") : a.role === "mother" ? "Maternal" : a.role === "father" ? "Paternal" : "Side not recorded" });
      }
    }
    const closest = Math.min(...candidates.map(p => p.referenceDistance + p.relativeDistance));
    const paths = candidates.filter(p => p.referenceDistance + p.relativeDistance === closest);
    const connection = paths.length ? [] : restorePath(dagre.graphlib.alg.dijkstra(connections, referenceId, () => 1, id => connections.nodeEdges(id) || []), referenceId, relativeId);
    return { paths, direct: [...new Set(direct)], connection };
  };
  return (referenceId: string, relativeId: string): KinshipResult => {
    const result = calculate(referenceId, relativeId);
    if (result.warning || referenceId === relativeId) return result;
    const inLaws: InLawPath[] = [];
    for (const marriage of relationships.filter(r => r.type === "spouse")) {
      for (const [endpoint, other, kind] of [[relativeId, referenceId, "cousins-spouse"], [referenceId, relativeId, "spouses-cousin"]] as const) {
        if (marriage.fromId !== endpoint && marriage.toId !== endpoint) continue;
        const spouseId = marriage.fromId === endpoint ? marriage.toId : marriage.fromId;
        const cousins = kind === "cousins-spouse" ? calculate(other, spouseId) : calculate(spouseId, other);
        const cousin = cousins.paths.find(p => p.degree !== undefined);
        if (cousin) inLaws.push({ cousin, spouseId, kind, status: marriage.status || (marriage.endDate ? `ended ${marriage.endDate}` : undefined) });
      }
    }
    return inLaws.length ? { ...result, inLaws } : result;
  };
}

export const KINSHIP_GUIDE = `HOW TO READ THIS REPORT
Start with the reference person. Every relationship in this report is described from that person's point of view.

WHAT DOES REMOVED MEAN?
Removed counts how many family generations apart two cousins are. It does not mean their age difference, a distant relationship, or marriage.
Once removed = 1 generation apart.
Twice removed = 2 generations apart.
Thrice removed (three times removed) = 3 generations apart.
Four times removed = 4 generations apart. Keep counting one more for each parent-child step.

LOOKING DOWN THE FAMILY TREE
Your first cousin's child is your first cousin once removed.
Your first cousin's grandchild is your first cousin twice removed.
Your first cousin's great-grandchild is your first cousin thrice removed.

LOOKING UP THE FAMILY TREE
Your parent's first cousin is your first cousin once removed.
Your grandparent's first cousin is your first cousin twice removed.
Your great-grandparent's first cousin is your first cousin thrice removed.
The same rule works for second, third, and later cousins. A second cousin's child is your second cousin once removed, not your third cousin.

FIRST, SECOND, OR THIRD COUSIN?
First cousins share a grandparent. Their parents are siblings.
Second cousins share a great-grandparent. Their parents are first cousins.
Third cousins share a great-great-grandparent. Their parents are second cousins.
Those examples are in the same family generation, so no removal is needed. Your child and your first cousin's child are second cousins to each other.

PUTTING THE TWO NUMBERS TOGETHER
1st cousin, three times removed: your first cousin's great-grandchild, or your great-grandparent's first cousin.
2nd cousin, three times removed: your second cousin's great-grandchild, or your great-grandparent's second cousin.
The cousin number describes the shared ancestry. The removal tells you the gap between family generations. Three times removed is also called thrice removed; it does not turn a first cousin into a fourth cousin.

COUSIN-IN-LAW IS DIFFERENT
A cousin-in-law can mean your cousin's spouse, or your spouse's cousin. The report names the people and the marriage connection so you can tell which it means.
Example: Bea is Alex's first cousin. Bea marries Chris. Chris is Alex's cousin-in-law, not Alex's first cousin once removed just because of the marriage.
Removed counts generations. In-law describes a marriage connection. A person can have both an ancestry connection and a marriage connection; these are listed separately. A partner link alone is not labelled cousin-in-law.

MATERNAL AND PATERNAL
Maternal means through your mother. Paternal means through your father. These labels use the recorded parent role, never a guess from gender or name. Side not recorded means that role is missing.

ABOUT THE RECORDS
One generation is one parent-child step. The detailed paths list those steps towards a shared ancestor. For cousins, the shorter path minus one gives the cousin number; the difference between the two path lengths gives the removal.
Relationships use recorded parent-child links, not proof of genetic relatedness. Parentage types follow the selected report filter; links without a recorded type are not assumed biological. Sibling does not assert full or half sibling status. Spouse, partner, guardian, and ward links do not establish ancestry.

The report shows the closest recorded ancestry connection(s), using a shortest route through each first parent. It is not an exhaustive list of every longer route in families with repeated ancestors. No recorded path does not prove that two people are unrelated. Private names are hidden unless Include private people and annotations is selected.`;

export function explainCousin(path: KinshipPath, name: (id: string) => string) {
  if (path.degree === undefined) return "";
  const a = name(path.referencePath[0]), b = name(path.relativePath[0]);
  const difference = path.relativeDistance - path.referenceDistance;
  const distance = Math.abs(difference);
  const cousin = `${ordinal(path.degree)} cousin`;
  const bridge = difference > 0 ? name(path.relativePath[distance]) : name(path.referencePath[distance]);
  const cousinPair = difference > 0 ? `${a} and ${bridge}` : `${bridge} and ${b}`;
  const ancestorRole = ["grandparent", "great-grandparent", "great-great-grandparent"][path.degree - 1] || great(path.degree - 1, "grandparent");
  const degreeExplanation = `Why ${cousin}: ${name(path.ancestorId)} is a ${ancestorRole} of both ${cousinPair}.`;
  if (!distance) return `${b} is ${a}'s ${cousin}. They are in the same family generation, so neither is removed from the other. This is about their position in the tree, not their ages. ${degreeExplanation}`;
  const step = distance === 1 ? (difference > 0 ? "child" : "parent") : great(distance - 2, difference > 0 ? "grandchild" : "grandparent");
  const example = difference > 0
    ? `${bridge} is ${a}'s ${cousin}. ${b} is ${bridge}'s ${step}.`
    : `${bridge} is ${a}'s ${step}. ${b} is ${bridge}'s ${cousin}.`;
  return `${example} That makes ${b} ${a}'s ${path.label}. ${distance === 3 ? "Thrice (three times)" : removal(distance)[0].toUpperCase() + removal(distance).slice(1)} removed means ${distance} family generation${distance === 1 ? "" : "s"} apart. ${b} is on the ${difference > 0 ? "younger" : "older"} generation's branch; their actual ages do not change this relationship. ${degreeExplanation}`;
}

function explainFamilySide(path: KinshipPath, name: (id: string) => string) {
  if (path.referencePath.length < 2) return "";
  const reference = name(path.referencePath[0]), parent = name(path.referencePath[1]);
  const role = path.side === "Maternal" ? "mother" : path.side === "Paternal" ? "father" : undefined;
  return role
    ? `${path.side} means this connection starts with ${reference}'s ${role}, ${parent}.`
    : `This connection starts with ${reference}'s recorded parent, ${parent}. A maternal or paternal role has not been recorded for this parent-child link.`;
}

function connectionLabel(rel: Relationship, fromId: string) {
  if (rel.type === "parent-child") return rel.fromId === fromId ? "child" : "parent";
  if (rel.type === "guardian") return rel.fromId === fromId ? "ward" : "guardian";
  const base = rel.subtype || rel.type;
  return `${base}${rel.status ? ` (${rel.status})` : ""}`;
}

export function kinshipMatchesCategories(result: KinshipResult, categories?: string[]) {
  if (!categories) return true;
  const matches = new Set<string>();
  for (const path of result.paths) {
    if (!path.relativeDistance && path.referenceDistance) matches.add("ancestors");
    else if (!path.referenceDistance && path.relativeDistance) matches.add("descendants");
    else if (path.degree !== undefined) matches.add("cousins");
    else if (path.referenceDistance === 1 && path.relativeDistance === 1) matches.add("siblings");
    else if (path.referenceDistance && path.relativeDistance) matches.add("collateral");
  }
  if (result.direct.some(label => /^(Spouse|Partner)/.test(label))) matches.add("partners");
  if (result.direct.some(label => label.startsWith("Recorded sibling"))) matches.add("siblings");
  if (result.inLaws?.length) matches.add("in-laws");
  if (!matches.size || result.direct.some(label => /^(Guardian|Ward)/.test(label))) matches.add("other");
  return categories.some(category => matches.has(category));
}

export function generateKinshipReport(state: AppState, treeId: string, referenceId?: string, options: KinshipOptions = {}) {
  state = reportParentageState(state, options.parentage);
  const people = state.people.filter(p => p.treeId === treeId);
  const reference = people.find(p => p.id === referenceId);
  const name = (id: string) => { const p = people.find(person => person.id === id); return !p ? "Unknown person" : p.private && !options.includePrivate ? "[Private person]" : fullName(p); };
  if (!reference) return "Kinship Report\nChoose a reference person from this tree.";
  if (options.comparisonId && !people.some(p => p.id === options.comparisonId)) return "Kinship Report\nChoose a comparison person from this tree.";
  const calculate = createKinshipIndex(state, treeId);
  const targets = options.comparisonId ? people.filter(p => p.id === options.comparisonId) : people.filter(p => p.id !== reference.id && (!p.private || options.includePrivate));
  const lines = ["Kinship Report", `Tree: ${state.trees.find(t => t.id === treeId)?.title || "Untitled tree"}`, `Reference person: ${name(reference.id)}`, `Prepared: ${new Date().toLocaleString()}`, `Private names: ${options.includePrivate ? "included" : "hidden"}`, ""];
  lines.push(`Parentage scope: ${!options.parentage || options.parentage === "all" ? "All recorded parent-child links" : PARENTAGE_LABELS[options.parentage]}.`);
  if (!targets.length) lines.push("No comparison people available with these privacy settings.", "");
  for (const target of targets) {
    const result = calculate(reference.id, target.id);
    if (!kinshipMatchesCategories(result, options.kinshipCategories)) continue;
    if (options.onlyCousins && !result.paths.some(p => p.degree !== undefined) && !result.inLaws?.length) continue;
    if (options.onlyRelated && !result.paths.length && !result.direct.length && !result.connection.length) continue;
    lines.push(`RELATIVE: ${name(target.id)}`, `Relationship to ${name(reference.id)}: ${[...new Set(result.paths.map(p => p.label)), ...result.direct, ...(result.inLaws?.length ? ["Cousin-in-law (marriage connection; see status below)"] : [])].join("; ") || (result.warning ? "Not calculated" : result.connection.length ? "Connected through recorded relationships" : "No recorded path")}`);
    if (result.warning) lines.push(result.warning);
    if (result.paths.length) lines.push(`Family side: ${[...new Set(result.paths.map(p => p.side))].join(" and ")}`);
    for (const explanation of new Set(result.paths.map(path => explainFamilySide(path, name)).filter(Boolean))) lines.push(explanation);
    for (const explanation of new Set(result.paths.map(path => explainCousin(path, name)).filter(Boolean))) lines.push(`In everyday words: ${explanation}`);
    for (const inLaw of result.inLaws || []) {
      const cousinOf = inLaw.kind === "cousins-spouse" ? name(reference.id) : name(inLaw.spouseId);
      const cousinName = inLaw.kind === "cousins-spouse" ? name(inLaw.spouseId) : name(target.id);
      lines.push(`${cousinName} is ${cousinOf}'s ${inLaw.cousin.label}. ${name(inLaw.spouseId)} and ${inLaw.kind === "cousins-spouse" ? name(target.id) : name(reference.id)} have a recorded marriage${inLaw.status ? ` (status: ${inLaw.status})` : " (no end recorded)"}. This is a ${inLaw.kind === "cousins-spouse" ? "cousin's spouse" : "spouse's cousin"} connection. The marriage itself adds no generations removed. ${inLaw.status ? "Read the recorded status before treating this as a current in-law relationship." : ""}`.trim());
    }
    if (result.paths.length) lines.push("RECORDED FAMILY PATHS");
    for (const path of result.paths) {
      lines.push(`Shared ancestor / direct-line junction: ${name(path.ancestorId)} (${path.side})`,
        `Generation distances: reference ${path.referenceDistance}; relative ${path.relativeDistance}.`,
        `Reference path (toward parents): ${path.referencePath.map(name).join(" -> ")}`,
        `Relative path (toward parents): ${path.relativePath.map(name).join(" -> ")}`);
      const linkDetails = new Set([...path.referencePath.slice(1).map((id, i) => [id, path.referencePath[i]]), ...path.relativePath.slice(1).map((id, i) => [id, path.relativePath[i]])].map(([parent, child]) => {
        const relationship = state.relationships.find(r => r.treeId === treeId && r.type === "parent-child" && r.fromId === parent && r.toId === child);
        return relationship?.parentage && relationship.parentage !== "unspecified" ? `${name(parent)} to ${name(child)}: ${PARENTAGE_LABELS[relationship.parentage]}` : "";
      }).filter(Boolean));
      if (linkDetails.size) lines.push(`Recorded parentage: ${[...linkDetails].join("; ")}.`);
      if (path.degree !== undefined) {
        const difference = path.relativeDistance - path.referenceDistance;
        lines.push(`Cousin degree: ${path.degree}. Generations removed: ${path.removed}.`,
          difference ? `${name(target.id)} is ${Math.abs(difference)} generation(s) ${difference > 0 ? "further from" : "closer to"} this ancestor than the reference person. This describes generation position, not age.` : "Both people are the same number of generations from this ancestor.");
      }
    }
    if (!result.paths.length && result.connection.length) {
      lines.push("Recorded connection (not a calculated ancestry relationship):");
      result.connection.slice(1).forEach((id, index) => {
        const previous = result.connection[index];
        const rel = state.relationships.find(r => r.treeId === treeId && ((r.fromId === previous && r.toId === id) || (r.toId === previous && r.fromId === id)));
        lines.push(`${name(previous)} -> ${rel ? connectionLabel(rel, previous) : "relative"}: ${name(id)}`);
      });
    }
    lines.push("");
  }
  return [...lines, KINSHIP_GUIDE].join("\n");
}

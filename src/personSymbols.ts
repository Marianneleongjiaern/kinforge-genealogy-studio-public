import { AppState, Person, fullName } from "./domain";
import { glyphById } from "./glyphs";

export type PersonSymbol = { id: string; glyphId: string; label: string; meaning: string; detail?: string };

export function personSymbols(state: AppState, person: Person, includePrivate = false): PersonSymbol[] {
  if (person.private && !includePrivate) return [];
  const gender = glyphById(`gender-${person.gender}`)!;
  const symbols: PersonSymbol[] = [{ id: gender.id, glyphId: gender.id, label: gender.label, meaning: gender.meaning }];
  const people = new Map(state.people.filter(entry => entry.treeId === person.treeId && (!entry.private || includePrivate)).map(entry => [entry.id, entry]));
  const addGlyph = (id: string, glyphId: string, detail?: string) => {
    const glyph = glyphById(glyphId);
    if (glyph) symbols.push({ id, glyphId, label: glyph.label, meaning: glyph.meaning, detail });
  };
  for (const rel of state.relationships.filter(r => r.treeId === person.treeId && ["spouse", "partner"].includes(r.type) && [r.fromId, r.toId].includes(person.id))) {
    const other = people.get(rel.fromId === person.id ? rel.toId : rel.fromId);
    if (!other) continue;
    const status = rel.status?.trim().toLowerCase();
    const glyphId = ({ separated: "separation", separation: "separation", divorced: "divorce", divorce: "divorce", annulled: "annulment", annulment: "annulment" } as Record<string, string>)[status || ""];
    if (!glyphId) continue;
    addGlyph(rel.id, glyphId, `Recorded union with ${fullName(other)}${rel.endDate ? `; end date ${rel.endDate}` : ""}.`);
  }
  for (const rel of state.relationships.filter(r => r.treeId === person.treeId && r.type === "parent-child" && r.parentage && r.parentage !== "unspecified" && [r.fromId, r.toId].includes(person.id))) {
    const glyphId = ({ biological: "relationship-biological", adoptive: "relationship-adopted", foster: "relationship-foster", step: "relationship-step" } as Record<string, string>)[rel.parentage || ""];
    const other = people.get(rel.fromId === person.id ? rel.toId : rel.fromId);
    if (!glyphId || !other) continue;
    addGlyph(`${rel.id}:parentage`, glyphId, person.id === rel.fromId ? `Recorded parentage link to child ${fullName(other)}.` : `Recorded parentage link from parent ${fullName(other)}.`);
  }
  const parentLinksByChild = new Map<string, string[]>();
  for (const rel of state.relationships.filter(r => r.treeId === person.treeId && r.type === "parent-child")) {
    parentLinksByChild.set(rel.toId, [...(parentLinksByChild.get(rel.toId) ?? []), rel.fromId]);
  }
  for (const [childId, parentIds] of parentLinksByChild) {
    if (parentIds.length !== 1 || parentIds[0] !== person.id) continue;
    const child = people.get(childId);
    if (!child) continue;
    const glyphId = person.gender === "female" ? "single-mom" : person.gender === "male" ? "single-dad" : "single-parent";
    addGlyph(`single-parent:${childId}`, glyphId, `Only one parent is currently linked for ${fullName(child)}.`);
  }
  if (includePrivate) for (const need of person.accessNeeds || []) {
    const glyph = glyphById(need.glyphId);
    symbols.push({ id: need.id, glyphId: glyph?.id || "other-support", label: need.label, meaning: glyph ? `${glyph.label}: ${glyph.meaning}` : "Unrecognized annotation symbol. Read the person's recorded wording; no condition is inferred.", detail: need.detail });
  }
  return symbols;
}

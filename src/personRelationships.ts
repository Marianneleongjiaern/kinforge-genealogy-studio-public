import { Person, Relationship, fullName } from "./domain";
import { relationshipGlyph } from "./glyphs";

export type PersonRelationship = {
  id: string;
  person: Person;
  role: string;
  relativeRole: string;
  status: string;
  glyphId: string;
  glyphLabel: string;
  glyphMeaning: string;
  description: string;
};

export const SIBLING_STATUS_LABELS: Record<string, string> = {
  biological: "Biological sibling",
  biology: "Biological sibling",
  bio: "Biological sibling",
  adoptive: "Adoptive sibling",
  adopted: "Adoptive sibling",
  foster: "Foster sibling",
  step: "Step sibling",
  half: "Half sibling"
};

const parentRoleLabel = (relationship: Relationship) => relationship.parentRole === "mother" ? "Mother" : relationship.parentRole === "father" ? "Father" : "Parent";

const childRoleLabel = (person: Person) => person.gender === "female" ? "Daughter" : person.gender === "male" ? "Son" : "Child";

const siblingRoleLabel = (person: Person, status = "") => {
  const base = person.gender === "female" ? "Sister" : person.gender === "male" ? "Brother" : "Sibling";
  const statusLabel = SIBLING_STATUS_LABELS[status.trim().toLowerCase()] || "";
  if (!statusLabel) return base;
  return statusLabel.replace(/sibling$/i, base.toLowerCase()).replace(/^./, letter => letter.toUpperCase());
};

const titleCaseRelationship = (value: string) => value.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const partnerRoleLabel = (relationship: Relationship) => {
  const subtype = relationship.subtype?.trim();
  if (!subtype) return relationship.type === "spouse" ? "Spouse" : "Partner";
  return titleCaseRelationship(subtype);
};

export function relationshipsByPerson(people: Person[], relationships: Relationship[]) {
  const peopleById = new Map(people.map(person => [person.id, person]));
  const result = new Map<string, PersonRelationship[]>(people.map(person => [person.id, []]));
  relationships.forEach(relationship => {
    const from = peopleById.get(relationship.fromId), to = peopleById.get(relationship.toId);
    if (!from || !to || from.id === to.id || from.treeId !== relationship.treeId || to.treeId !== relationship.treeId) return;
    const status = relationship.status?.trim() || "";
    const subtype = relationship.subtype?.trim() || "";
    const displayedStatus = [status, relationship.type === "relative" && subtype && subtype.toLowerCase() !== status.toLowerCase() ? subtype : ""].filter(Boolean).join(", ");
    const subtypeRole = subtype ? titleCaseRelationship(subtype) : "Relative";
    const roles = relationship.type === "parent-child" ? [parentRoleLabel(relationship), childRoleLabel(to)]
      : relationship.type === "guardian" ? ["Guardian", "Ward"]
      : relationship.type === "sibling" ? [siblingRoleLabel(from, status), siblingRoleLabel(to, status)]
      : relationship.type === "relative" ? [subtypeRole, subtypeRole]
      : Array(2).fill(partnerRoleLabel(relationship));
    [from, to].forEach((person, index) => {
      const relative = index === 0 ? to : from;
      const glyph = relationshipGlyph(subtype || roles[index], status || subtype);
      result.get(person.id)!.push({
        id: relationship.id, person: relative, role: roles[index], relativeRole: roles[1 - index], status: displayedStatus,
        glyphId: glyph.id, glyphLabel: glyph.label, glyphMeaning: glyph.meaning,
        description: `${roles[index]} of ${fullName(relative)}${displayedStatus ? ` (${displayedStatus})` : ""}`,
      });
    });
  });
  return result;
}

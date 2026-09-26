import { AppState, createEmptyPerson, fullName, makeId, Person, Relationship } from "./domain";
import { PUBLIC_EXPORT_COPYRIGHT, PUBLIC_EXPORT_CREDIT, PUBLIC_EXPORT_PERMISSION } from "./exportAttribution";

type GedcomRecord = {
  level: number;
  pointer?: string;
  tag: string;
  value: string;
};

const parseLine = (line: string): GedcomRecord | undefined => {
  const match = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/i);
  if (!match) return undefined;
  return {
    level: Number(match[1]),
    pointer: match[2],
    tag: match[3].toUpperCase(),
    value: match[4] ?? ""
  };
};

export const parseGedcom = (text: string, treeId: string) => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(parseLine).filter(Boolean) as GedcomRecord[];
  const people = new Map<string, Person>();
  const familyPointers: Record<string, { partners: string[]; children: string[] }> = {};
  let currentPersonPointer = "";
  let currentFamilyPointer = "";
  let currentEventTag = "";

  lines.forEach((record, index) => {
    if (record.level === 0 && record.pointer && record.tag === "INDI") {
      currentPersonPointer = record.pointer;
      currentFamilyPointer = "";
      const person = createEmptyPerson(treeId);
      person.id = makeId("person");
      people.set(record.pointer, person);
      currentEventTag = "";
      return;
    }
    if (record.level === 0 && record.pointer && record.tag === "FAM") {
      currentFamilyPointer = record.pointer;
      currentPersonPointer = "";
      familyPointers[record.pointer] = { partners: [], children: [] };
      currentEventTag = "";
      return;
    }
    const person = currentPersonPointer ? people.get(currentPersonPointer) : undefined;
    if (person) {
      if (record.level === 1 && record.tag === "NAME") {
        const clean = record.value.replace(/\//g, "").trim();
        const bits = clean.split(/\s+/);
        person.givenName = bits.slice(0, -1).join(" ") || bits[0] || "";
        person.familyName = bits.length > 1 ? bits[bits.length - 1] : "";
      }
      if (record.level === 1 && record.tag === "SEX") person.gender = record.value === "F" ? "female" : record.value === "M" ? "male" : "unknown";
      if (record.level === 1 && ["BIRT", "DEAT"].includes(record.tag)) currentEventTag = record.tag;
      if (record.level === 2 && record.tag === "DATE" && currentEventTag === "BIRT") person.birthDate = normalizeGedcomDate(record.value);
      if (record.level === 2 && record.tag === "DATE" && currentEventTag === "DEAT") {
        person.deathDate = normalizeGedcomDate(record.value);
        person.living = false;
      }
      if (record.level === 1 && record.tag === "NOTE") person.notes = [person.notes, record.value].filter(Boolean).join("\n");
      if (record.level === 1 && record.tag === "ALIA") person.aliases.push(record.value.replace(/@/g, ""));
      if (record.level === 1 && record.tag === "FACT") {
        const dateRecord = lines[index + 1]?.level === 2 && lines[index + 1]?.tag === "DATE" ? normalizeGedcomDate(lines[index + 1].value) : "";
        person.facts.push({ id: makeId("fact"), type: "Imported GEDCOM fact", value: record.value, date: dateRecord, sourceIds: [] });
      }
    }
    if (currentFamilyPointer && familyPointers[currentFamilyPointer]) {
      if (record.level === 1 && ["HUSB", "WIFE"].includes(record.tag)) familyPointers[currentFamilyPointer].partners.push(record.value);
      if (record.level === 1 && record.tag === "CHIL") familyPointers[currentFamilyPointer].children.push(record.value);
    }
  });

  const relationships: Relationship[] = [];
  Object.values(familyPointers).forEach((family) => {
    const partnerIds = family.partners.map((pointer) => people.get(pointer)?.id).filter(Boolean) as string[];
    if (partnerIds.length > 1) {
      relationships.push({ id: makeId("rel"), treeId, type: "spouse", fromId: partnerIds[0], toId: partnerIds[1], sourceIds: [] });
    }
    family.children.forEach((childPointer) => {
      const child = people.get(childPointer);
      if (!child) return;
      partnerIds.forEach((parentId) => {
        relationships.push({ id: makeId("rel"), treeId, type: "parent-child", fromId: parentId, toId: child.id, sourceIds: [] });
      });
    });
  });
  return { people: Array.from(people.values()), relationships };
};

export const normalizeGedcomDate = (value: string) => {
  const original = value.trim();
  if (/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(original) || /^(?:@#D|ABT\s|CAL\s|EST\s|BEF\s|AFT\s|BET\s|FROM\s)/i.test(original)) return original;
  const monthMap: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12"
  };
  const match = original.toUpperCase().match(/^(?:(\d{1,2})\s+)?([A-Z]{3})?\s*(\d{3,4})$/);
  if (!match) return value;
  const year = match[3];
  const month = match[2] ? monthMap[match[2]] : "";
  if (match[2] && !month) return original;
  const day = match[1]?.padStart(2, "0") ?? "";
  return [year, month, day].filter(Boolean).join("-");
};

export const exportGedcom = (state: AppState, treeId: string, options: { hideLiving?: boolean; hidePrivate?: boolean; includeMedia?: boolean } = {}) => {
  const people = state.people.filter((person) => person.treeId === treeId).filter((person) => !(options.hidePrivate && person.private)).filter((person) => !(options.hideLiving && person.living));
  const allowedPeople = new Set(people.map((person) => person.id));
  const lines = ["0 HEAD", "1 SOUR KinForge", "1 GEDC", "2 VERS 7.0", "1 CHAR UTF-8", `1 NOTE ${PUBLIC_EXPORT_COPYRIGHT}`, `1 NOTE ${PUBLIC_EXPORT_CREDIT}`, `1 NOTE ${PUBLIC_EXPORT_PERMISSION}`];
  people.forEach((person, index) => {
    const pointer = `@I${index + 1}@`;
    lines.push(`0 ${pointer} INDI`);
    lines.push(`1 NAME ${person.givenName} /${person.familyName}/`);
    lines.push(`1 SEX ${person.gender === "female" ? "F" : person.gender === "male" ? "M" : "U"}`);
    if (person.birthDate) lines.push("1 BIRT", `2 DATE ${person.birthDate}`);
    if (person.deathDate) lines.push("1 DEAT", `2 DATE ${person.deathDate}`);
    person.aliases.forEach((alias) => lines.push(`1 ALIA ${alias}`));
    person.facts.forEach((fact) => lines.push(`1 FACT ${fact.type}: ${fact.value}`));
    if (person.biography) lines.push(`1 NOTE ${person.biography.replace(/\n/g, " ")}`);
    if (options.includeMedia) {
      person.mediaIds.forEach((mediaId) => {
        const media = state.media.find((item) => item.id === mediaId);
        if (media) lines.push("1 OBJE", `2 TITL ${media.title}`, `2 FILE ${media.externalUrl || media.title}`);
      });
    }
  });
  const idToPointer = new Map(people.map((person, index) => [person.id, `@I${index + 1}@`]));
  state.relationships.filter((rel) => rel.treeId === treeId && rel.type === "parent-child" && allowedPeople.has(rel.fromId) && allowedPeople.has(rel.toId)).forEach((rel, index) => {
    lines.push(`0 @F${index + 1}@ FAM`);
    lines.push(`1 HUSB ${idToPointer.get(rel.fromId)}`);
    lines.push(`1 CHIL ${idToPointer.get(rel.toId)}`);
  });
  lines.push("0 TRLR");
  return lines.join("\n");
};

export const mergeImportedPeople = (state: AppState, treeId: string, incoming: Person[], relationships: Relationship[]) => {
  const next = structuredClone(state) as AppState;
  incoming.forEach((incomingPerson) => {
    const duplicate = next.people.find((person) =>
      person.treeId === treeId &&
      fullName(person).toLowerCase() === fullName(incomingPerson).toLowerCase() &&
      (!person.birthDate || !incomingPerson.birthDate || person.birthDate.slice(0, 4) === incomingPerson.birthDate.slice(0, 4))
    );
    if (duplicate) {
      duplicate.aliases = Array.from(new Set([...duplicate.aliases, ...incomingPerson.aliases]));
      duplicate.facts = [...duplicate.facts, ...incomingPerson.facts.filter((fact) => !duplicate.facts.some((existing) => existing.type === fact.type && existing.value === fact.value))];
      duplicate.notes = [duplicate.notes, incomingPerson.notes].filter(Boolean).join("\n");
    } else {
      next.people.push(incomingPerson);
    }
  });
  relationships.forEach((relationship) => {
    const exists = next.relationships.some((rel) => rel.type === relationship.type && rel.fromId === relationship.fromId && rel.toId === relationship.toId);
    if (!exists) next.relationships.push(relationship);
  });
  return next;
};

import { AppState, fullName } from "./domain";

export type ArchiveKind = "person" | "record" | "source" | "place";
export type ArchiveResult = { id: string; kind: ArchiveKind; title: string; detail: string; linkedPersonId?: string };
const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();

export function searchLocalArchive(state: AppState, treeId: string, query: string, kind: ArchiveKind | "all" = "all"): ArchiveResult[] {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const entries: Array<ArchiveResult & { search: string }> = [
    ...state.people.filter(p => p.treeId === treeId).map(p => ({ id: p.id, kind: "person" as const, title: fullName(p), detail: [p.birthDate, p.deathDate].filter(Boolean).join(" - "), search: [fullName(p), ...p.aliases, ...p.labels, p.biography, p.birthDate, p.deathDate].join(" ") })),
    ...state.records.filter(r => r.treeId === treeId).map(r => ({ id: r.id, kind: "record" as const, title: r.title, detail: [r.collection, r.date, r.citation, r.transcription].filter(Boolean).join(" | "), linkedPersonId: r.personId, search: [r.title, r.collection, r.date, r.citation, r.transcription].join(" ") })),
    ...state.sources.filter(s => s.treeId === treeId).map(s => ({ id: s.id, kind: "source" as const, title: s.title, detail: s.citation || s.notes, search: [s.title, s.citation, s.notes, ...Object.values(s.fields)].join(" ") })),
    ...state.places.filter(p => p.treeId === treeId).map(p => ({ id: p.id, kind: "place" as const, title: p.name, detail: [p.address, p.pointsOfInterest].filter(Boolean).join(" | "), search: [p.name, p.address, p.notes, p.pointsOfInterest, ...Object.values(p.levels)].join(" ") })),
  ];
  return entries.filter(e => (kind === "all" || e.kind === kind) && terms.every(term => normalized(e.search).includes(term)))
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map(({ search: _search, ...result }) => result);
}

export function linkLocalRecord(state: AppState, treeId: string, recordId: string, personId: string): void {
  const record = state.records.find(r => r.id === recordId && r.treeId === treeId);
  const person = state.people.find(p => p.id === personId && p.treeId === treeId);
  if (!record || !person) throw new Error("The record and person must belong to the active tree.");
  if (record.personId && record.personId !== personId) throw new Error("This record is already linked to another person. Review that link before changing it.");
  if (record.sourceId && !state.sources.some(s => s.id === record.sourceId && s.treeId === treeId)) throw new Error("The record's source is missing from this tree.");
  record.personId = personId;
  if (record.sourceId && !person.sourceIds.includes(record.sourceId)) person.sourceIds.push(record.sourceId);
}

import { AppState, fullName } from "./domain";
import { syncFamilyMembership } from "./treeGraph";

export const DELETABLE_RECORDS = {
  books: "Book", collections: "Collection", trees: "Family tree", people: "Person",
  families: "Family record", relationships: "Relationship", events: "Event", places: "Place",
  sources: "Source", media: "Photo or file", todos: "Research task", dnaMatches: "DNA match",
  records: "Historical record", ideasJournal: "Ideas journal entry", userFeedback: "User feedback", protectionRecords: "Protection or government record", medicalRecords: "Medical or diagnosis record", reportDrafts: "Report draft", placeTemplates: "Place template",
  sourceTemplates: "Source template", facts: "Person fact", accessNeeds: "Access annotation",
  labels: "Label", customEventTypes: "Custom event type", customFactTypes: "Custom fact type",
  customFamilyTypes: "Custom family type", customRelationshipSubtypes: "Custom relationship subtype"
} as const;
export type DeleteKind = keyof typeof DELETABLE_RECORDS;
export type DeleteTarget = { kind: DeleteKind; id: string; ownerId?: string };
type RowKind = Exclude<DeleteKind, "facts" | "accessNeeds" | "labels" | "customEventTypes" | "customFactTypes" | "customFamilyTypes" | "customRelationshipSubtypes">;
export const TREE_RECORDS = ["people", "families", "relationships", "places", "sources", "media", "todos", "dnaMatches", "records", "ideasJournal", "userFeedback", "protectionRecords", "medicalRecords", "reportDrafts"] as const;
const STRING_KINDS = ["labels", "customEventTypes", "customFactTypes", "customFamilyTypes", "customRelationshipSubtypes"] as const;
type Row = { id: string; treeId?: string };
type Removed = Partial<Record<RowKind, Set<string>>>;
export type DeletionPlan = { target: DeleteTarget; title: string; exists: boolean; removed: Removed; counts: Array<{ label: string; count: number }>; container: boolean };

function rows(state: AppState, kind: RowKind): Row[] { return (state[kind] ?? []) as Row[]; }
function titleFor(state: AppState, target: DeleteTarget): string {
  if (target.kind === "protectionRecords") {
    const record = state.protectionRecords?.find(record => record.id === target.id);
    if (!record) return "";
    const person = record.entityKind === "person" ? state.people.find(person => person.id === record.entityId && person.treeId === record.treeId) : undefined;
    const family = record.entityKind === "family" ? state.families.find(family => family.id === record.entityId && family.treeId === record.treeId) : undefined;
    const relationship = record.entityKind === "relationship" ? state.relationships.find(relationship => relationship.id === record.entityId && relationship.treeId === record.treeId) : undefined;
    const entity = person ? fullName(person) : family ? family.name : relationship ? titleFor(state, { kind: "relationships", id: relationship.id }) : `${record.entityKind} unavailable`;
    return `${record.type || DELETABLE_RECORDS.protectionRecords}: ${entity}${record.caseReference ? ` (${record.caseReference})` : ""}`;
  }
  if (target.kind === "medicalRecords") {
    const record = state.medicalRecords?.find(record => record.id === target.id);
    if (!record) return "";
    const person = state.people.find(person => person.id === record.personId && person.treeId === record.treeId);
    return `${record.type || DELETABLE_RECORDS.medicalRecords}: ${record.diagnosisName || "Diagnosis not named"}${person ? ` (${fullName(person)})` : ""}`;
  }
  if (target.kind === "facts" || target.kind === "accessNeeds") {
    const person = state.people.find(p => p.id === target.ownerId);
    const item = person?.[target.kind]?.find(f => f.id === target.id);
    return item ? `${"type" in item ? `${item.type}: ${item.value}` : item.label} (${fullName(person!)})` : "";
  }
  if (STRING_KINDS.includes(target.kind as typeof STRING_KINDS[number])) return (state[target.kind as typeof STRING_KINDS[number]] || []).includes(target.id) ? target.id : "";
  const item = rows(state, target.kind as RowKind).find(r => r.id === target.id) as (Row & { title?: string; name?: string; givenName?: string; type?: string; description?: string; matchName?: string; fromId?: string; toId?: string }) | undefined;
  if (!item) return "";
  if (target.kind === "people") return fullName(state.people.find(p => p.id === item.id)!);
  if (target.kind === "relationships") {
    const name = (id?: string) => { const p = state.people.find(p => p.id === id); return p ? fullName(p) : "Unknown person"; };
    return `${name(item.fromId)} / ${name(item.toId)} (${item.type})`;
  }
  return item.title || item.name || item.matchName || [item.type, item.description].filter(Boolean).join(": ") || DELETABLE_RECORDS[target.kind];
}

export function planDeletion(state: AppState, target: DeleteTarget): DeletionPlan {
  const title = titleFor(state, target);
  const removed: Removed = {};
  const add = (kind: RowKind, ids: string[]) => { const set = removed[kind] ||= new Set(); for (const id of ids) set.add(id); };
  if (title && !STRING_KINDS.includes(target.kind as typeof STRING_KINDS[number]) && target.kind !== "facts" && target.kind !== "accessNeeds") add(target.kind as RowKind, [target.id]);
  if (target.kind === "books") add("collections", state.collections.filter(c => c.bookId === target.id).map(c => c.id));
  // Traverse descendants with a visited set, including imperfect imported hierarchies.
  if (target.kind === "collections" || target.kind === "books") {
    let changed = true;
    while (changed) { changed = false; for (const c of state.collections) if (c.parentId && removed.collections?.has(c.parentId) && !removed.collections.has(c.id)) { add("collections", [c.id]); changed = true; } }
    add("trees", state.trees.filter(t => (target.kind === "books" && t.bookId === target.id) || (t.collectionId && removed.collections?.has(t.collectionId))).map(t => t.id));
  }
  if (removed.trees?.size) for (const kind of TREE_RECORDS) add(kind, rows(state, kind).filter(r => r.treeId && removed.trees!.has(r.treeId)).map(r => r.id));
  if (removed.people?.size) {
    add("relationships", state.relationships.filter(r => removed.people!.has(r.fromId) || removed.people!.has(r.toId)).map(r => r.id));
    add("reportDrafts", state.reportDrafts.filter(r => r.personId && removed.people!.has(r.personId)).map(r => r.id));
    add("medicalRecords", (state.medicalRecords ?? []).filter(r => removed.people!.has(r.personId)).map(r => r.id));
  }
  const protectionOwners = { person: "people", family: "families", relationship: "relationships" } as const;
  add("protectionRecords", (state.protectionRecords ?? []).filter(record => {
    const kind = protectionOwners[record.entityKind];
    return removed[kind]?.has(record.entityId) && state[kind].some(entity => entity.id === record.entityId && entity.treeId === record.treeId);
  }).map(record => record.id));
  const eventCandidates = new Set([...state.people.filter(p => removed.people?.has(p.id)), ...state.families.filter(f => removed.families?.has(f.id))].flatMap(p => p.eventIds));
  const keptEvents = new Set([...state.people.filter(p => !removed.people?.has(p.id)), ...state.families.filter(f => !removed.families?.has(f.id))].flatMap(p => p.eventIds));
  add("events", [...eventCandidates].filter(id => !keptEvents.has(id)));
  const counts: DeletionPlan["counts"] = Object.entries(removed).filter(([, ids]) => ids!.size).map(([kind, ids]) => ({ label: DELETABLE_RECORDS[kind as RowKind], count: ids!.size }));
  if (title && !counts.length) counts.push({ label: DELETABLE_RECORDS[target.kind], count: 1 });
  return { target, title, exists: !!title, removed, counts, container: ["books", "collections", "trees"].includes(target.kind) };
}

function removeRows(state: AppState, removed: Removed) {
  for (const [kind, ids] of Object.entries(removed)) {
    const key = kind as RowKind;
    (state as unknown as Record<RowKind, Row[]>)[key] = rows(state, key).filter(row => !ids!.has(row.id));
  }
}

export function applyDeletion(state: AppState, target: DeleteTarget): AppState {
  const plan = planDeletion(state, target);
  if (!plan.exists) return state;
  const next = structuredClone(state);
  removeRows(next, plan.removed);
  const gone = (kind: RowKind, id?: string) => !!id && !!plan.removed[kind]?.has(id);
  const ids = (kind: RowKind, values: string[]) => values.filter(id => !gone(kind, id));
  const optional = (kind: RowKind, id?: string) => gone(kind, id) ? undefined : id;
  const refs = { person: "people", family: "families", event: "events", source: "sources", place: "places", media: "media", tree: "trees" } as const;
  for (const p of next.people) {
    p.eventIds = ids("events", p.eventIds); p.sourceIds = ids("sources", p.sourceIds); p.mediaIds = ids("media", p.mediaIds);
    p.profileMediaId = optional("media", p.profileMediaId);
    for (const f of p.facts) f.sourceIds = ids("sources", f.sourceIds);
    for (const n of p.accessNeeds || []) n.sourceId = optional("sources", n.sourceId);
    if (target.ownerId === p.id && target.kind === "facts") p.facts = p.facts.filter(f => f.id !== target.id);
    if (target.ownerId === p.id && target.kind === "accessNeeds") p.accessNeeds = p.accessNeeds?.filter(n => n.id !== target.id);
    if (target.kind === "labels") p.labels = p.labels.filter(label => label !== target.id);
  }
  for (const f of next.families) { f.partnerIds = ids("people", f.partnerIds); f.childIds = ids("people", f.childIds); f.eventIds = ids("events", f.eventIds); f.sourceIds = ids("sources", f.sourceIds); }
  const affectedFamilyTrees = new Set(state.relationships.filter(relationship => relationship.type === "parent-child" && gone("relationships", relationship.id)).map(relationship => relationship.treeId));
  for (const treeId of affectedFamilyTrees) syncFamilyMembership(next, treeId);
  for (const r of next.relationships) r.sourceIds = ids("sources", r.sourceIds);
  for (const record of next.protectionRecords ?? []) { record.sourceIds = ids("sources", record.sourceIds); record.mediaIds = ids("media", record.mediaIds); }
  for (const record of next.medicalRecords ?? []) { record.sourceIds = ids("sources", record.sourceIds); record.mediaIds = ids("media", record.mediaIds); record.personId = optional("people", record.personId) || record.personId; }
  for (const e of next.events) { e.placeId = optional("places", e.placeId); e.sourceIds = ids("sources", e.sourceIds); e.mediaIds = ids("media", e.mediaIds); }
  for (const p of next.places) { p.sourceIds = ids("sources", p.sourceIds); p.mediaIds = ids("media", p.mediaIds); if (gone("placeTemplates", p.templateId)) p.templateId = ""; }
  for (const s of next.sources) { s.mediaIds = ids("media", s.mediaIds); if (gone("sourceTemplates", s.templateId)) s.templateId = ""; }
  for (const m of next.media) m.assignedTo = m.assignedTo.filter(a => !gone(refs[a.kind], a.id));
  for (const r of next.records) { r.personId = optional("people", r.personId); r.placeId = optional("places", r.placeId); r.sourceId = optional("sources", r.sourceId); }
  for (const r of next.ideasJournal) r.personId = optional("people", r.personId);
  for (const r of next.userFeedback) r.personId = optional("people", r.personId);
  for (const r of [...next.todos, ...next.dnaMatches]) r.personId = optional("people", r.personId);
  for (const t of next.trees) t.crestMediaId = optional("media", t.crestMediaId);
  next.changes = next.changes.filter(c => !gone("trees", c.treeId));
  if (STRING_KINDS.includes(target.kind as typeof STRING_KINDS[number])) {
    const key = target.kind as typeof STRING_KINDS[number]; next[key] = (next[key] || []).filter(value => value !== target.id);
  }
  return next;
}

export function deletionEntries(state: AppState, kind: DeleteKind, treeId?: string, personId?: string) {
  let targets: DeleteTarget[];
  if (kind === "protectionRecords") targets = (state.protectionRecords ?? []).filter(record => (!treeId || record.treeId === treeId) && (!personId || (record.entityKind === "person" && record.entityId === personId))).map(record => ({ kind, id: record.id }));
  else if (kind === "medicalRecords") targets = (state.medicalRecords ?? []).filter(record => (!treeId || record.treeId === treeId) && (!personId || record.personId === personId)).map(record => ({ kind, id: record.id }));
  else if (kind === "facts" || kind === "accessNeeds") targets = state.people.filter(p => (!treeId || p.treeId === treeId) && (!personId || p.id === personId)).flatMap(p => (p[kind] || []).map(f => ({ kind, id: f.id, ownerId: p.id })));
  else if (STRING_KINDS.includes(kind as typeof STRING_KINDS[number])) targets = (state[kind as typeof STRING_KINDS[number]] || []).map(id => ({ kind, id }));
  else {
    const eventIds = new Set([...state.people.filter(p => (!treeId || p.treeId === treeId) && (!personId || p.id === personId)), ...state.families.filter(f => !treeId || f.treeId === treeId)].flatMap(p => p.eventIds));
    targets = rows(state, kind as RowKind).filter(r => (!treeId || !r.treeId || r.treeId === treeId) && (kind !== "events" || !treeId || eventIds.has(r.id))).map(r => ({ kind, id: r.id }));
  }
  return targets.map(target => ({ target, title: titleFor(state, target) }));
}

// Treat a container deletion and a concurrent change inside it as one choice.
export function deletionSnapshot(state: AppState, target: DeleteTarget) {
  const { removed } = planDeletion(state, target);
  return Object.fromEntries(Object.entries(removed).filter(([, ids]) => ids!.size).map(([kind, ids]) => [kind, rows(state, kind as RowKind).filter(row => ids!.has(row.id))]));
}
export function alignDeletionScope(state: AppState, source: AppState, target: DeleteTarget): AppState {
  const next = structuredClone(state);
  removeRows(next, planDeletion(next, target).removed);
  for (const [kind, entries] of Object.entries(deletionSnapshot(source, target))) {
    const key = kind as RowKind; const added = new Set(entries.map(row => row.id));
    (next as unknown as Record<RowKind, Row[]>)[key] = [...rows(next, key).filter(row => !added.has(row.id)), ...structuredClone(entries)];
  }
  return next;
}

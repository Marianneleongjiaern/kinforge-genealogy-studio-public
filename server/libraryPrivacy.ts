// This boundary classifies structured fields and references, not copied prose.
type Row = Record<string, any>;
export type LibraryDocument = Record<string, any>;
export class LibraryPrivacyError extends Error {
  readonly code = "LIBRARY_PRIVACY_REVIEW";
  constructor(message = "Only the library owner can change private details or sharing settings. Undo the change or review your pending edits.") { super(message); }
}
const deletionPrivacyError = () => new LibraryPrivacyError("Only the library owner can delete this item. Undo the deletion to continue syncing; your pending edits have been kept.");
const rows = (value: unknown): Row[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
const own = (value: Row, key: string) => Object.hasOwn(value, key);
const shared = (row: Row) => row.visibility === "shared";
const governmentFile = (row: Row) => strings(row.tags).some(tag => tag.trim().toLowerCase() === "government-file");
const assetPattern = /^kinforge-asset:([a-f0-9]{64})$/;
const governmentFields = ["governmentEvents", "custodyNotes", "criminalRecord", "fosterRecord", "custodyChangeRecord", "removalRecord", "protectiveServicesRecord", "personalProtectionOrderRecord", "restrainingOrderRecord", "houseArrestRecord", "arrestRecord", "agency", "caseNumber", "governmentFacility", "governmentProtectionStatus", "socialWorkerName", "socialWorkerAgency", "doctorName", "doctorPractice", "inpatientStatus", "daycareStatus", "careTeamNotes", "birthMethod", "birthAssistant", "birthNotes"];
const emptyGovernment = () => Object.fromEntries([...governmentFields.map(key => [key, ""]), ["protectiveServices", false], ["custodyRemoved", false]]);

function walk(value: any, visit: (value: any) => void) {
  visit(value);
  if (Array.isArray(value)) value.forEach(item => walk(item, visit));
  else if (value && typeof value === "object") Object.values(value).forEach(item => walk(item, visit));
}
export function libraryAssetHashes(value: unknown) {
  const result = new Set<string>();
  walk(value, item => { if (typeof item === "string") { const match = assetPattern.exec(item); if (match) result.add(match[1]); } });
  return result;
}
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => own(b, key) && same(a[key], b[key]));
}

export function sanitizeLibraryVisibility(state: LibraryDocument) {
  for (const [key, flag] of [["people", "sensitiveVisibility"], ["media", "visibility"], ["protectionRecords", "visibility"], ["reportDrafts", "visibility"]]) {
    for (const row of rows(state[key])) if (own(row, flag) && row[flag] !== "shared") row[flag] = "private";
  }
  for (const report of rows(state.reportDrafts)) {
    if (!own(report, "visibility") && report.options?.includePrivate === true) report.visibility = "private";
  }
  return state;
}

export function sharedLibraryView(original: LibraryDocument) {
  const state = structuredClone(original);
  const hiddenIds = new Set<string>(), protectedIds = new Set<string>(), blockedAssets = new Set<string>();
  const sourceIds = new Set<string>(), mediaIds = new Set<string>(), sharedSources = new Set<string>();
  const hiddenRows = new Set<Row>();
  function evidence(row: Row, sources = sourceIds, media = mediaIds) {
    strings(row.sourceIds).forEach(id => sources.add(id));
    if (typeof row.sourceId === "string") sources.add(row.sourceId);
    strings(row.mediaIds).forEach(id => media.add(id));
  }
  function protect(row: Row) {
    for (const key of ["id", "treeId", "entityId", "personId"]) if (typeof row[key] === "string") protectedIds.add(row[key]);
  }
  function hide(row: Row) {
    if (hiddenRows.has(row)) return;
    hiddenRows.add(row);
    if (typeof row.id === "string") hiddenIds.add(row.id);
    protect(row); evidence(row);
    libraryAssetHashes(row).forEach(hash => blockedAssets.add(hash));
  }
  for (const record of rows(state.protectionRecords)) {
    if (!shared(record)) hide(record);
    else evidence(record, sharedSources, new Set());
  }
  // Explicit report metadata protects generated private content without guessing at prose.
  for (const report of rows(state.reportDrafts)) {
    if (report.visibility === "private" || (!shared(report) && report.options?.includePrivate === true)) hide(report);
  }
  for (const person of rows(state.people)) {
    if (person.sensitiveVisibility === "shared") {
      evidence(person, sharedSources, new Set());
      [...rows(person.facts), ...rows(person.accessNeeds)].forEach(row => evidence(row, sharedSources, new Set()));
      continue;
    }
    const blank = emptyGovernment();
    if (person.government && !same(person.government, blank)) {
      protect(person);
      libraryAssetHashes(person.government).forEach(hash => blockedAssets.add(hash));
    }
    if (own(person, "government")) person.government = blank;
    for (const fact of rows(person.facts)) if (fact.private === true) { hide(fact); protect(person); }
    for (const need of rows(person.accessNeeds)) { hide(need); protect(person); }
  }
  for (const event of rows(state.events)) {
    // An event has its own privacy choice, independent of any person's legacy group.
    if (event.private === true) hide(event);
  }
  // Evidence attached to private records must not leak through the general catalogues.
  let changed = true;
  while (changed) {
    const size = hiddenRows.size;
    for (const source of rows(state.sources)) if (sourceIds.has(source.id) && !sharedSources.has(source.id)) hide(source);
    for (const media of rows(state.media)) {
      if (shared(media)) continue;
      if (media.visibility === "private" || governmentFile(media) || mediaIds.has(media.id) ||
        rows(media.assignedTo).some(link => hiddenIds.has(link.id))) hide(media);
    }
    changed = size !== hiddenRows.size;
  }
  // Audit entries can contain old field values and private record names/counts.
  // Unmarked reports remain shared; copied/exported prose cannot be classified here.
  for (const change of rows(state.changes)) {
    if (typeof change.id === "string") hiddenIds.add(change.id);
  }
  state.changes = [];

  function clean(value: any): any {
    if (typeof value === "string") {
      const hash = assetPattern.exec(value)?.[1];
      return hiddenIds.has(value) || (hash && blockedAssets.has(hash)) ? undefined : value;
    }
    if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);
    if (!value || typeof value !== "object") return value;
    if (hiddenIds.has(value.id)) return undefined;
    const result: Row = {};
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) continue;
      const next = clean(item);
      if (next !== undefined) result[key] = next;
    }
    return result;
  }
  const visible = clean(state) as LibraryDocument;
  // A container deletion must not silently remove descendants the editor cannot see.
  for (const key of ["people", "families", "relationships"]) for (const row of rows(original[key])) {
    if (protectedIds.has(row.id)) {
      strings(row.partnerIds).concat(strings(row.childIds), [row.fromId, row.toId].filter(Boolean)).forEach(id => protectedIds.add(id));
      if (row.treeId) protectedIds.add(row.treeId);
    }
  }
  for (const tree of rows(original.trees)) if (protectedIds.has(tree.id)) {
    if (tree.bookId) protectedIds.add(tree.bookId);
    if (tree.collectionId) protectedIds.add(tree.collectionId);
  }
  let count = -1;
  while (count !== protectedIds.size) {
    count = protectedIds.size;
    for (const collection of rows(original.collections)) if (protectedIds.has(collection.id)) {
      if (collection.bookId) protectedIds.add(collection.bookId);
      if (collection.parentId) protectedIds.add(collection.parentId);
    }
  }
  return { state: visible, hiddenIds, protectedIds, blockedAssets };
}

function preserveFlags(previous: Row | undefined, next: Row, flags: string[]) {
  for (const flag of flags) {
    if (own(next, flag)) {
      if (previous && next[flag] !== previous[flag]) throw new LibraryPrivacyError();
    } else if (previous && own(previous, flag)) next[flag] = previous[flag];
  }
}

export function mergeSharedLibraryWrite(original: LibraryDocument, submitted: LibraryDocument) {
  const view = sharedLibraryView(original);
  const incoming = structuredClone(submitted);
  if (!own(incoming, "protectionRecords") && own(original, "protectionRecords")) incoming.protectionRecords = structuredClone(view.state.protectionRecords);
  // Clients retain their last acknowledged draft. Replayed audit rows are immutable;
  // preserve the stored originals without accepting edits or exposing them on GET.
  const savedChangeIds = new Set(rows(original.changes).map(row => row.id));
  incoming.changes = rows(incoming.changes).filter(row => !savedChangeIds.has(row.id));
  // Reject hidden identifiers anywhere, including new records, assignments and aliases.
  walk(incoming, value => {
    if (typeof value !== "string") return;
    const hash = assetPattern.exec(value)?.[1];
    if (view.hiddenIds.has(value) || (hash && view.blockedAssets.has(hash))) throw new LibraryPrivacyError();
  });
  for (const [key, flags] of [["people", ["sensitiveVisibility"]], ["media", ["visibility"]], ["protectionRecords", ["visibility"]], ["reportDrafts", ["visibility"]], ["events", ["private"]]] as const) {
    const previous = new Map(rows(original[key]).map(row => [row.id, row]));
    for (const row of rows(incoming[key])) {
      const before = previous.get(row.id);
      preserveFlags(before, row, [...flags]);
      if (key === "people") {
        if (before && before.sensitiveVisibility !== "shared") {
          const shown = rows(view.state.people).find(person => person.id === row.id);
          if (own(row, "government") && !same(row.government, shown?.government)) throw new LibraryPrivacyError();
          if (rows(row.accessNeeds).length) throw new LibraryPrivacyError();
        }
        for (const field of ["facts", "accessNeeds"]) {
          const nested = new Map(rows(before?.[field]).map(item => [item.id, item]));
          for (const item of rows(row[field])) preserveFlags(nested.get(item.id), item, ["private"]);
        }
      }
      if (key === "media" && before && governmentFile(before) !== governmentFile(row)) throw new LibraryPrivacyError();
    }
  }
  for (const key of ["books", "collections", "trees", "people", "families", "relationships"]) {
    const nextIds = new Set(rows(incoming[key]).map(row => row.id));
    if (rows(original[key]).some(row => view.protectedIds.has(row.id) && !nextIds.has(row.id))) throw deletionPrivacyError();
  }

  // Merge only redacted portions back in. Visible edits/deletions retain normal semantics.
  function restore(full: any, visible: any, next: any): any {
    if (same(full, visible)) return next;
    if (visible === undefined) {
      if (next !== undefined) throw new LibraryPrivacyError();
      return structuredClone(full);
    }
    if (Array.isArray(full) && Array.isArray(visible)) {
      if (next !== undefined && !Array.isArray(next)) throw new LibraryPrivacyError();
      const accepted = next ?? [];
      if (full.every(row => row && typeof row === "object" && typeof row.id === "string")) {
        const all = new Map(full.map(row => [row.id, row]));
        const shown = new Map(visible.map(row => [row.id, row]));
        for (const row of visible) if (!accepted.some((item: Row) => item.id === row.id) && !same(all.get(row.id), row)) throw deletionPrivacyError();
        return [...accepted.map((row: Row) => all.has(row.id) ? restore(all.get(row.id), shown.get(row.id), row) : row), ...full.filter(row => !shown.has(row.id))];
      }
      return [...accepted, ...full.filter(item => !visible.some(shown => same(item, shown)))];
    }
    if (full && visible && typeof full === "object" && typeof visible === "object") {
      if (next !== undefined && (!next || typeof next !== "object" || Array.isArray(next))) throw new LibraryPrivacyError();
      const result = { ...(next ?? {}) };
      for (const key of Object.keys(full)) if (!same(full[key], visible[key])) result[key] = restore(full[key], visible[key], result[key]);
      return result;
    }
    if (next !== undefined && !same(next, visible)) throw new LibraryPrivacyError();
    return full;
  }
  const merged = restore(original, view.state, incoming) as LibraryDocument;
  for (const person of rows(merged.people)) {
    const before = rows(original.people).find(row => row.id === person.id);
    if (before && before.sensitiveVisibility !== "shared") {
      if (own(before, "government")) person.government = structuredClone(before.government);
      else delete person.government;
    }
  }
  // Changed evidence links must not indirectly grant access to previously hidden rows.
  const nextView = sharedLibraryView(merged);
  for (const id of view.hiddenIds) {
    if (!nextView.hiddenIds.has(id)) throw new LibraryPrivacyError();
  }
  return merged;
}

import type { JSONContent } from "@tiptap/core";
import dagre from "@dagrejs/dagre";
import { AppState, Person, ProtectionRecord, emptyDeathDetails, fullName } from "./domain";
import { runPlausibilityChecks, findDuplicateCandidates } from "./analysis";
import { createKinshipIndex, generateKinshipReport, KinshipOptions } from "./kinship";
import { layoutFamily, visiblePeople, NODE_HEIGHT, NODE_WIDTH } from "./treeGraph";
import { familyLines, LINE_STYLES, statusMark } from "./familyLines";
import { personSymbols, PersonSymbol } from "./personSymbols";
import { lineLegendDocument, personSymbolDocument } from "./reportSymbols";
import { dateParts, distinctivePatterns, eventMatches, lifeEvents, localToday } from "./reportFacts";
import { ageInterval, compareDates, dateInterval, inDateRange, lifetimeOverlap } from "./reportDates";
import { narrativeNone, narrativeSections, registerEntries } from "./reportNarrative";
import { filterReportSections, reportColumns } from "./reportSections";
import { reportParentageState, PARENTAGE_LABELS } from "./reportParentage";
import type { ReportOptions } from "./reportOptions";
import { GLOSSARY_NOTE, meaningFor } from "./terms";
export type { ReportOptions } from "./reportOptions";

export type Diagram = { kind: "network" | "fan" | "bars" | "timeline"; title: string; width: number; height: number;
  nodes: { id: string; label: string; x: number; y: number; shape?: string; detail?: string; symbols?: PersonSymbol[] }[];
  paths: { d: string; color: string; dash?: string }[]; bars?: { label: string; value: number }[];
  slots?: { number: number; label: string }[]; entries?: { year: number; label: string }[] };
const t = (text: string): JSONContent => ({ type: "text", text });
const p = (text: string): JSONContent => ({ type: "paragraph", content: [t(text || "None recorded.")] });
const h = (text: string, level = 2): JSONContent => ({ type: "heading", attrs: { level }, content: [t(text)] });
const chart = (diagram: Diagram): JSONContent => ({ type: "reportChart", attrs: { diagram } });

export function reportScope(original: AppState, treeId: string, includePrivate = false, parentage?: ReportOptions["parentage"]): AppState {
  const state = reportParentageState(original, parentage);
  const people = state.people.filter(p => p.treeId === treeId && (includePrivate || !p.private));
  const ids = new Set(people.map(p => p.id));
  const families = state.families.filter(f => f.treeId === treeId && [...f.partnerIds, ...f.childIds].some(id => ids.has(id)));
  const eventIds = new Set([...people.flatMap(p => p.eventIds), ...families.flatMap(f => f.eventIds)]);
  const visibleEvents = state.events.filter(e => eventIds.has(e.id) && (includePrivate || !e.private));
  const visibleRelationships = state.relationships.filter(r => r.treeId === treeId && ids.has(r.fromId) && ids.has(r.toId));
  // A shared record still needs a visible, valid owner; mixed-private family notes stay hidden.
  const protectionRecords = (state.protectionRecords || []).filter(record => record.treeId === treeId && (includePrivate || record.visibility === "shared") && (
    record.entityKind === "person" ? ids.has(record.entityId)
      : record.entityKind === "relationship" ? visibleRelationships.some(r => r.id === record.entityId)
        : record.entityKind === "family" && families.some(f => f.id === record.entityId) && original.families.some(f => f.treeId === treeId && f.id === record.entityId && [...f.partnerIds, ...f.childIds].every(id => ids.has(id)))
  ));
  const records = state.records.filter(r => r.treeId === treeId && (!r.personId || ids.has(r.personId)));
  const visibleSources = new Set([...people.flatMap(p => [...p.sourceIds, ...p.facts.filter(f => includePrivate || !f.private).flatMap(f => f.sourceIds)]), ...visibleEvents.flatMap(e => e.sourceIds), ...visibleRelationships.flatMap(r => r.sourceIds), ...families.flatMap(f => f.sourceIds), ...records.flatMap(r => r.sourceId ? [r.sourceId] : []), ...state.places.filter(p => p.treeId === treeId).flatMap(p => p.sourceIds)]);
  const hiddenSources = new Set([...state.people.filter(p => p.treeId === treeId).flatMap(p => [...(!ids.has(p.id) ? p.sourceIds : []), ...p.facts.filter(f => !ids.has(p.id) || !includePrivate && f.private).flatMap(f => f.sourceIds)]), ...state.events.filter(e => !visibleEvents.some(v => v.id === e.id)).flatMap(e => e.sourceIds), ...state.relationships.filter(r => r.treeId === treeId && !visibleRelationships.includes(r)).flatMap(r => r.sourceIds), ...state.families.filter(f => f.treeId === treeId && !families.includes(f)).flatMap(f => f.sourceIds), ...state.records.filter(r => r.treeId === treeId && !records.includes(r)).flatMap(r => r.sourceId ? [r.sourceId] : [])]);
  protectionRecords.forEach(record => record.sourceIds.forEach(id => visibleSources.add(id)));
  (state.protectionRecords || []).filter(record => !protectionRecords.includes(record)).forEach(record => record.sourceIds.forEach(id => hiddenSources.add(id)));
  const medicalRecords = (state.medicalRecords || []).filter(record => record.treeId === treeId && ids.has(record.personId) && (includePrivate || record.visibility === "shared"));
  medicalRecords.forEach(record => record.sourceIds.forEach(id => visibleSources.add(id)));
  (state.medicalRecords || []).filter(record => !medicalRecords.includes(record)).forEach(record => record.sourceIds.forEach(id => hiddenSources.add(id)));
  const sources = state.sources.filter(s => s.treeId === treeId && (includePrivate || !hiddenSources.has(s.id) || visibleSources.has(s.id)));
  const visibleMedia = new Set([...people.flatMap(p => [...p.mediaIds, ...(p.profileMediaId ? [p.profileMediaId] : [])]), ...visibleEvents.flatMap(e => e.mediaIds), ...sources.flatMap(s => s.mediaIds), ...state.places.filter(p => p.treeId === treeId).flatMap(p => p.mediaIds)]);
  const referencedMedia = new Set([...state.people.flatMap(p => [...p.mediaIds, ...(p.profileMediaId ? [p.profileMediaId] : [])]), ...state.events.flatMap(e => e.mediaIds), ...state.sources.flatMap(s => s.mediaIds), ...state.places.flatMap(p => p.mediaIds)]);
  protectionRecords.forEach(record => record.mediaIds.forEach(id => visibleMedia.add(id)));
  (state.protectionRecords || []).forEach(record => record.mediaIds.forEach(id => referencedMedia.add(id)));
  medicalRecords.forEach(record => record.mediaIds.forEach(id => visibleMedia.add(id)));
  (state.medicalRecords || []).forEach(record => record.mediaIds.forEach(id => referencedMedia.add(id)));
  const assignmentVisible = (kind: string, id: string) => kind === "person" ? ids.has(id) : kind === "family" ? families.some(f => f.id === id) : kind === "event" ? visibleEvents.some(e => e.id === id) : kind === "source" ? sources.some(s => s.id === id) : kind === "place" ? state.places.some(p => p.id === id && p.treeId === treeId) : kind === "tree" && id === treeId;
  const media = state.media.filter(m => m.treeId === treeId && (includePrivate || m.visibility !== "private") && (visibleMedia.has(m.id) || m.assignedTo.some(a => assignmentVisible(a.kind, a.id)) || !m.assignedTo.length && !referencedMedia.has(m.id))).map(m => ({ ...m, assignedTo: m.assignedTo.filter(a => assignmentVisible(a.kind, a.id)) }));
  return { ...state, people: people.map(p => ({ ...p, facts: p.facts.filter(f => includePrivate || !f.private) })),
    relationships: state.relationships.filter(r => r.treeId === treeId && ids.has(r.fromId) && ids.has(r.toId)),
    families: families.map(f => ({ ...f, partnerIds: f.partnerIds.filter(id => ids.has(id)), childIds: f.childIds.filter(id => ids.has(id)) })),
    events: visibleEvents, sources, places: state.places.filter(p => p.treeId === treeId),
    media, records, protectionRecords, medicalRecords, todos: state.todos.filter(todo => todo.treeId === treeId && (!todo.personId || ids.has(todo.personId))) };
}

export type ProtectionReportScope = { personIds?: readonly string[]; familyIds?: readonly string[]; relationshipIds?: readonly string[] };

export function reportProtectionRecords(original: AppState, treeId: string, scope: ProtectionReportScope, options: ReportOptions = {}): ProtectionRecord[] {
  const state = reportScope(original, treeId, options.includePrivate, options.parentage);
  return (state.protectionRecords || []).filter(record => (
    record.entityKind === "person" ? scope.personIds : record.entityKind === "family" ? scope.familyIds : scope.relationshipIds
  )?.includes(record.entityId));
}

/** Editable report nodes, limited to the explicitly selected owners and eligible attachments. */
export function protectionReportContent(original: AppState, treeId: string, scope: ProtectionReportScope, options: ReportOptions = {}): JSONContent[] {
  const state = reportScope(original, treeId, options.includePrivate, options.parentage);
  const records = reportProtectionRecords(state, treeId, scope, options);
  if (!records.length) return [];
  const personName = (id: string) => fullName(state.people.find(person => person.id === id));
  const ownerName = (record: ProtectionRecord) => {
    if (record.entityKind === "person") return `Person: ${personName(record.entityId)}`;
    if (record.entityKind === "family") return `Family: ${state.families.find(family => family.id === record.entityId)?.name || "Unnamed family"}`;
    const relationship = state.relationships.find(relationship => relationship.id === record.entityId)!;
    return `Relationship: ${personName(relationship.fromId)} / ${personName(relationship.toId)} (${relationship.type}${relationship.subtype ? `; ${relationship.subtype}` : ""})`;
  };
  return [p(GLOSSARY_NOTE), ...[...records].sort((a, b) => compareDates(a.startDate, b.startDate) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id)).flatMap(record => {
    const meaning = meaningFor(record.type);
    const fields = [
      ["Status", record.status], ["From", record.startDate], ["Until", record.endDate], ["Agency", record.agency],
      ["Contact", record.contact], ["Jurisdiction", record.jurisdiction], ["Case reference", record.caseReference], ["Notes", record.notes]
    ];
    const sources = state.sources.filter(source => record.sourceIds.includes(source.id));
    const media = state.media.filter(item => record.mediaIds.includes(item.id));
    return [h(record.type || "Record type not recorded", 3), p(ownerName(record)),
      ...(meaning ? [p(`Meaning: ${meaning}`)] : []),
      p(`Visibility: ${record.visibility === "shared" ? "Shared-library record" : "Private record (explicitly included)"}`),
      ...fields.filter(([, value]) => value.trim()).map(([label, value]) => p(`${label}: ${value}`)),
      ...sources.map(source => p(`Source: ${source.citation || source.title}${source.url ? ` | ${source.url}` : ""}`)),
      ...media.map(item => p(`Attachment: ${item.title} (${item.type})`))];
  })];
}

export function reportTermMeanings(terms: readonly (string | undefined)[], customTerms: readonly { term: string; meaning: string }[] = []): JSONContent[] {
  const explained = new Set<string>();
  return terms.flatMap(term => {
    if (!term) return [];
    const meaning = meaningFor(term) || customTerms.find(entry => entry.term.toLocaleLowerCase() === term.toLocaleLowerCase())?.meaning;
    if (!meaning || explained.has(meaning)) return [];
    explained.add(meaning);
    return [p(`${term}: ${meaning}`)];
  });
}

export function ahnentafel(state: AppState, personId: string, generations: number) {
  const slots: { number: number; id: string; depth: number }[] = [], unresolved: string[] = [];
  const visit = (id: string, number: number, depth: number, seen: Set<string>) => {
    if (seen.has(id)) { unresolved.push(`Cycle at record ${id}; this branch stops here.`); return; }
    slots.push({ id, number, depth });
    if (depth >= generations) return;
    const parents = state.relationships.filter(r => r.type === "parent-child" && r.toId === id);
    for (const role of ["father", "mother"] as const) {
      const candidates = parents.filter(r => r.parentRole === role);
      if (candidates.length === 1) visit(candidates[0].fromId, number * 2 + (role === "mother" ? 1 : 0), depth + 1, new Set([...seen, id]));
      if (candidates.length > 1) unresolved.push(`${fullName(state.people.find(p => p.id === id))}: multiple ${role} links; no single numbered slot chosen.`);
    }
    for (const parent of parents.filter(r => !r.parentRole || r.parentRole === "parent")) unresolved.push(`${fullName(state.people.find(p => p.id === parent.fromId))} is a parent of ${fullName(state.people.find(p => p.id === id))}; Mother/Father role is not recorded, so no numbered slot is guessed.`);
  };
  visit(personId, 1, 0, new Set());
  const numbered = new Set(slots.map(slot => slot.id)), missing = new Map<string, number>();
  const seen = new Map<string, number>();
  const collect = (id: string, depth: number) => {
    if ((seen.get(id) ?? Infinity) <= depth || depth > generations || !state.people.some(p => p.id === id)) return;
    seen.set(id, depth);
    if (!numbered.has(id)) missing.set(id, depth);
    state.relationships.filter(r => r.type === "parent-child" && r.toId === id).forEach(r => collect(r.fromId, depth + 1));
  };
  collect(personId, 0);
  return { slots, unresolved: [...new Set(unresolved)], unnumbered: [...missing].map(([id, depth]) => ({ id, depth })) };
}

type ListRow = { cells: Record<string, string>; text: string; name?: string; date?: string; type?: string; surname?: string; place?: string; status?: string };
function listNodes(rows: ListRow[], type: string, options: ReportOptions): JSONContent[] {
  const columns = options.columns?.filter(column => reportColumns(type).includes(column));
  if (columns?.length === 0) return [p("No columns selected.")];
  const sorted = [...rows];
  if (options.sortBy) sorted.sort((a, b) => {
    const key = options.sortBy!;
    const result = key === "date" ? compareDates(a.date || "", b.date || "") : (a[key] || "").localeCompare(b[key] || "");
    return (options.sortDirection === "desc" ? -1 : 1) * result;
  });
  else if (options.sortDirection === "desc") sorted.reverse();
  const line = (row: ListRow) => p(columns ? columns.map(column => `${column}: ${row.cells[column] || "Not recorded"}`).join(" | ") : row.text);
  if (!options.groupBy || options.groupBy === "none") return sorted.length ? sorted.map(line) : [p("None recorded.")];
  const groups = new Map<string, ListRow[]>();
  sorted.forEach(row => { const key = row[options.groupBy as "type" | "surname" | "place" | "status"] || "Not recorded"; groups.set(key, [...(groups.get(key) || []), row]); });
  return [...groups].sort(([a], [b]) => a.localeCompare(b) * (options.sortDirection === "desc" ? -1 : 1)).flatMap(([label, entries]) => [h(label, 3), ...entries.map(line)]);
}

export const CATALOG_TYPES = ["Family Group Report", "Family Report", "Narrative Report", "Particularities Report", "Person Analysis", "Plausibility Report", "Sources List", "Descendancy Report", "Descendancy List", "Marriage List", "Marriages List", "Places List", "Events List", "Person Events Report", "Anniversary List", "Ahnentafel Report", "Name Distribution Report", "Influential People Report", "Fan Chart", "Hourglass Chart", "Relationship Chart", "Ahnentafel Diagram", "Genogram", "Timeline Report", "Timeline Chart", "Name Distribution Chart", "Sociogram", "Register Report", "Today Report", "Status Report", "Persons List", "Facts List", "Distinctive Persons List", "ToDo List", "Changes List", "LDS Ordinances List", "Medical Files Report", "Diagnosis Files Report", "Prescription Files Report", "Treatment Files Report", "Work Contracts Report", "Company Files Report", "Character Work Files Report"];

export function buildCatalogReport(original: AppState, treeId: string, type: string, personId?: string, options: ReportOptions = {}): JSONContent | undefined {
  if (!CATALOG_TYPES.includes(type)) return;
  const state = reportScope(original, treeId, options.includePrivate, options.parentage), people = state.people;
  const person = people.find(p => p.id === personId);
  const name = (id: string) => fullName(people.find(p => p.id === id));
  const rels = state.relationships;
  const generations = Math.max(1, Math.min(10, options.generations || 3));
  const content: JSONContent[] = [h(type, 1), p(`Tree: ${state.trees.find(t => t.id === treeId)?.title || "Untitled"}`), p(`Prepared: ${new Date().toLocaleString()} | Private people: ${options.includePrivate ? "included" : "excluded"}`)];
  const section = (title: string, rows: string[]) => content.push(h(title), ...(rows.length ? rows : ["None recorded."]).map(p));
  const list = (title: string, rows: ListRow[]) => content.push(h(title), ...listNodes(rows, type, options));
  const parents = (id: string) => rels.filter(r => r.type === "parent-child" && r.toId === id).map(r => r.fromId);
  const children = (id: string) => rels.filter(r => r.type === "parent-child" && r.fromId === id).map(r => r.toId);
  const personEvents = (id: string) => state.events.filter(e => people.find(p => p.id === id)?.eventIds.includes(e.id));
  const eventLine = (event: AppState["events"][number]) => `${event.date || "Undated"} | ${event.type} | ${people.filter(p => p.eventIds.includes(event.id)).map(fullName).join(", ") || "Family event"}${event.placeId ? ` | ${state.places.find(p => p.id === event.placeId)?.name || "Unknown place"}` : ""}${event.description ? ` | ${event.description}` : ""}`;
  const events = state.events.filter(e => eventMatches(e, options)).sort((a, b) => compareDates(a.date, b.date));
  const sourceText = (ids: string[]) => ids.map(id => state.sources.find(s => s.id === id)?.citation || state.sources.find(s => s.id === id)?.title || `Missing source record: ${id}`).join("; ");
  const eventRow = (event: AppState["events"][number]): ListRow => {
    const owners = people.filter(p => p.eventIds.includes(event.id)), place = state.places.find(p => p.id === event.placeId)?.name || "";
    return { date: event.date, type: event.type, name: owners.map(fullName).join(", "), surname: owners.map(p => p.familyName).join(", "), place,
      text: eventLine(event), cells: { Date: event.date, Type: event.type, People: owners.map(fullName).join(", ") || "Family event", Place: place, Description: event.description, Sources: sourceText(event.sourceIds), Media: String(event.mediaIds.filter(id => state.media.some(m => m.id === id)).length) } };
  };
  const personTypes = ["Narrative Report", "Descendancy Report", "Descendancy List", "Register Report", "Person Events Report", "Timeline Report", "Timeline Chart", "Ahnentafel Report", "Ahnentafel Diagram", "Fan Chart", "Hourglass Chart", "Relationship Chart"];
  if (personTypes.includes(type) && !person) return { type: "doc", content: [...content, p("Choose a visible person, or explicitly include their private profile.")] };
  if (["Medical Files Report", "Diagnosis Files Report", "Prescription Files Report", "Treatment Files Report", "Work Contracts Report", "Company Files Report", "Character Work Files Report"].includes(type)) {
    const targetPeople = person ? [person] : people;
    const personIds = new Set(targetPeople.map(p => p.id));
    const medicalRecords = (state.medicalRecords || []).filter(record => personIds.has(record.personId));
    const medicalTags = type === "Diagnosis Files Report" ? ["Diagnosis", "Diagnosis File", "Diagnostic Criteria", "Psychological Assessment", "Psychiatric Assessment", "Specialist Report"]
      : type === "Prescription Files Report" ? ["Prescription File", "Medication Record"]
        : type === "Treatment Files Report" ? ["Treatment File", "Treatment Plan", "Therapy Record", "Hospital Visit", "Discharge Summary", "Surgery or Procedure Record", "Care Plan"]
          : ["medical-file"];
    const workTags = type === "Work Contracts Report" ? ["Work Contract", "Employment Contract", "Freelance Contract", "Agency Contract"]
      : type === "Company Files Report" ? ["Company File", "Employee File", "Company ID or Badge", "Pay or Payroll File", "Tax or Benefits File", "Workplace Incident File"]
        : ["work-file"];
    const files = state.media.filter(file => file.assignedTo.some(assignment => assignment.kind === "person" && personIds.has(assignment.id)) && (
      type.includes("Work") || type.includes("Company") || type.includes("Character")
        ? file.tags.includes("work-file") && (workTags.includes("work-file") || file.tags.some(tag => workTags.includes(tag)))
        : file.tags.includes("medical-file") && (medicalTags.includes("medical-file") || file.tags.some(tag => medicalTags.includes(tag)))
    ));
    if (!type.includes("Work") && !type.includes("Company") && !type.includes("Character")) {
      section("Diagnosis and medical records", medicalRecords.map(record => {
        const owner = name(record.personId);
        return `${owner} | ${record.type}: ${record.diagnosisName || "Diagnosis not named"} | ${record.conditionType || record.conditionCategory || "type not recorded"} | Diagnosed: ${record.diagnosisDate || "date not recorded"} | Standard: ${record.diagnosticStandard || "not recorded"} | Clinician: ${record.diagnosingDoctor || record.psychologist || record.psychiatrist || record.occupationalTherapist || "not recorded"} | Files: ${record.mediaIds.length}`;
      }));
    }
    section(type.includes("Work") || type.includes("Company") || type.includes("Character") ? "Work and company files" : "Linked files", files.map(file => {
      const owners = file.assignedTo.filter(assignment => assignment.kind === "person").map(assignment => name(assignment.id)).join(", ") || "No person linked";
      return `${owners} | ${file.title} | ${file.tags.filter(tag => tag !== "medical-file" && tag !== "work-file").join(", ") || file.type} | Visibility: ${file.visibility || "shared"}`;
    }));
    if (!medicalRecords.length && !files.length) section("Summary", ["No matching records or files are visible with the current privacy settings."]);
  } else if (["Family Group Report", "Family Report"].includes(type)) {
    if (personId && !person && !options.familyId) return { type: "doc", content: [...content, p("Choose a visible person, or explicitly include their private profile.")] };
    const families = state.families.filter(f => options.familyId ? f.id === options.familyId : person ? f.partnerIds.includes(person.id) || f.childIds.includes(person.id) : true);
    content.push(p("Households follow recorded family groups; this does not establish that everyone lived together."));
    for (const family of families) {
      section("Family groups", [family.name, `Family type: ${family.familyType || "Family type not recorded"}`, `Partners: ${family.partnerIds.map(name).join(", ") || "None recorded"}`, `Children: ${family.childIds.map(name).join(", ") || "None recorded"}`, family.notes || "No family notes recorded."]);
      section("Union details", rels.filter(r => ["spouse", "partner"].includes(r.type) && family.partnerIds.includes(r.fromId) && family.partnerIds.includes(r.toId)).map(r => `${name(r.fromId)} and ${name(r.toId)}: ${r.type}${r.subtype ? `; ${r.subtype}` : ""}; ${r.status || "status not recorded"}; ${r.startDate || "start unknown"} to ${r.endDate || "no end recorded"}`));
      section("Family events", events.filter(e => family.eventIds.includes(e.id)).map(eventLine));
      const members = people.filter(p => [...family.partnerIds, ...family.childIds].includes(p.id));
      const memberIds = new Set(members.map(member => member.id));
      const familyRelationships = rels.filter(r => memberIds.has(r.fromId) && memberIds.has(r.toId));
      section("Family member biographies and facts", members.flatMap(member => [
        `${fullName(member)} biography: ${member.biography || "No biography recorded."}`,
        ...(member.facts.length ? member.facts.map(fact => `${fullName(member)} | ${fact.type}: ${fact.value || "No value recorded"}${fact.date ? ` (${fact.date})` : ""}`) : [`${fullName(member)} | Facts: None recorded.`])
      ]));
      const familyFactMeanings = reportTermMeanings(members.flatMap(member => member.facts.flatMap(fact => [fact.type, fact.value])), state.customFactTerms);
      if (familyFactMeanings.length) content.push(h("Fact Meanings"), ...familyFactMeanings);
      const sourceIds = new Set([...family.sourceIds, ...members.flatMap(p => p.sourceIds), ...events.filter(e => family.eventIds.includes(e.id) || members.some(p => p.eventIds.includes(e.id))).flatMap(e => e.sourceIds), ...rels.filter(r => family.partnerIds.includes(r.fromId) && family.partnerIds.includes(r.toId)).flatMap(r => r.sourceIds)]);
      section("Family sources", state.sources.filter(s => sourceIds.has(s.id)).map(s => s.citation || s.title));
      const centre = family.partnerIds[0] || family.childIds[0];
      if (centre) content.push(h("Family hourglass"), ...(buildCatalogReport(state, treeId, "Hourglass Chart", centre, { ...options, sections: undefined })?.content || []).slice(3).map(node => node.type === "heading" ? { ...node, attrs: { ...node.attrs, level: 3 } } : node));
      const protection = protectionReportContent(state, treeId, { personIds: [...memberIds], familyIds: [family.id], relationshipIds: familyRelationships.map(r => r.id) }, options);
      if (protection.length) content.push(h("Protection and Care Records"), ...protection);
      const meanings = reportTermMeanings([family.familyType, ...familyRelationships.flatMap(r => [r.type, r.subtype, r.status, r.parentage])], state.customFactTerms);
      if (meanings.length) content.push(h("Term Meanings"), ...meanings);
    }
    if (!families.length) section("Family groups", ["No family group recorded for this selection."]);
  } else if (type === "Narrative Report") {
    for (const item of narrativeSections(state, person!, options)) section(item.title, item.paragraphs.length ? item.paragraphs : [narrativeNone(options.language)]);
  } else if (["Particularities Report", "Distinctive Persons List"].includes(type)) {
    section("Distinctive recorded patterns", distinctivePatterns(state, options.thresholds));
    content.push(p("Age checks use complete dates or bounded partial-date intervals. A pattern is reported only when the whole possible age interval meets the threshold. Missing dates are not guessed; an absent match does not mean the person has no unusual history."));
  } else if (type === "Person Analysis") {
    const values = new Map<string, { count: number; ids: Set<string> }>();
    const add = (value: string, ids: string | string[]) => { const entry = values.get(value) || { count: 0, ids: new Set<string>() }; entry.count++; (Array.isArray(ids) ? ids : [ids]).forEach(id => entry.ids.add(id)); values.set(value, entry); };
    const selected = options.analysisType || "all-facts";
    const numeric: number[] = [];
    const year = (value: string) => { const d = dateInterval(value); return d && Number.isFinite(d.earliest) && Number.isFinite(d.latest) && new Date(d.earliest).getUTCFullYear() === new Date(d.latest).getUTCFullYear() ? String(new Date(d.earliest).getUTCFullYear()) : "Year unknown or spans years"; };
    for (const person of people) {
      for (const fact of person.facts) if ((selected === "all-facts" || selected === `fact:${fact.type}`) && inDateRange(fact.date || "", options.dateFrom, options.dateTo)) add(`${fact.type}: ${fact.value || "No value recorded"}`, person.id);
      const ownedEvents = events.filter(e => person.eventIds.includes(e.id));
      if (selected === "gender") add(person.gender, person.id);
      if (selected === "surname") add(person.familyName || "No surname recorded", person.id);
      if (selected === "birth-year" && inDateRange(person.birthDate, options.dateFrom, options.dateTo)) add(year(person.birthDate), person.id);
      if (selected === "death-year" && !person.living && inDateRange(person.deathDate, options.dateFrom, options.dateTo)) add(year(person.deathDate), person.id);
      const age = ageInterval(person.birthDate, person.deathDate);
      if (selected === "lifespan" && !person.living && inDateRange(person.deathDate, options.dateFrom, options.dateTo)) {
        add(age ? age.min === age.max ? String(age.min) : `${age.min}-${age.max} years (date interval)` : "Age unknown", person.id);
        if (age && age.min === age.max) numeric.push(age.min);
      }
      const counts: Record<string, number> = { children: new Set(children(person.id)).size, marriages: rels.filter(r => r.type === "spouse" && [r.fromId, r.toId].includes(person.id) && inDateRange(r.startDate || "", options.dateFrom, options.dateTo)).length, sources: new Set([...person.sourceIds, ...ownedEvents.flatMap(e => e.sourceIds), ...person.facts.flatMap(f => f.sourceIds)]).size, events: ownedEvents.length, media: state.media.filter(m => person.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "person" && a.id === person.id)).length };
      if (selected in counts) { add(String(counts[selected]), person.id); numeric.push(counts[selected]); }
    }
    for (const event of events) {
      const owners = [...new Set([...people.filter(p => p.eventIds.includes(event.id)).map(p => p.id), ...state.families.filter(f => f.eventIds.includes(event.id)).flatMap(f => [...f.partnerIds, ...f.childIds])])];
      if (selected === "event-type") add(event.type, owners);
      if (selected === "event-year") add(year(event.date), owners);
      if (selected === "event-place" || selected === `event:${event.type}`) add(state.places.find(p => p.id === event.placeId)?.name || "No place recorded", owners);
    }
    content.push(p(`Analysis: ${selected === "all-facts" ? "all recorded fact types and values" : selected.startsWith("event:") ? `${selected.slice(6)} events grouped by recorded place` : selected.startsWith("fact:") ? selected.slice(5) : selected}`));
    section("Values and people", [...values].sort(([a], [b]) => a.localeCompare(b)).map(([value, entry]) => `${value} | ${entry.count} entries | ${entry.ids.size} people: ${[...entry.ids].map(name).join(", ")}`));
    const total = [...values.values()].reduce((sum, value) => sum + value.count, 0), distinct = new Set([...values.values()].flatMap(value => [...value.ids]));
    numeric.sort((a, b) => a - b);
    section("Analysis statistics", [`Entries: ${total}`, `Distinct people: ${distinct.size}`, `Distinct values: ${values.size}`, ...(numeric.length ? [`Exact numeric observations: ${numeric.length}`, `Minimum: ${numeric[0]}`, `Maximum: ${numeric[numeric.length - 1]}`, `Mean: ${(numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(2)}`, `Median: ${((numeric[Math.floor((numeric.length - 1) / 2)] + numeric[Math.floor(numeric.length / 2)]) / 2).toFixed(2)}`] : []), "Partial age intervals and unknown ages are excluded from numeric averages."]);
    content.push(h("Analysis chart"), chart({ kind: "bars", title: `Analysis: ${selected}`, width: 900, height: Math.max(160, values.size * 35 + 50), nodes: [], paths: [], bars: [...values].map(([label, value]) => ({ label, value: value.count })) }));
  } else if (type === "Status Report") {
    const attached = new Set([...people.flatMap(p => [...p.mediaIds, ...(p.profileMediaId ? [p.profileMediaId] : [])]), ...state.events.flatMap(e => e.mediaIds), ...state.sources.flatMap(s => s.mediaIds), ...state.places.flatMap(p => p.mediaIds)]);
    const assigned = state.media.filter(m => m.assignedTo.length || attached.has(m.id)), unassigned = state.media.filter(m => !m.assignedTo.length && !attached.has(m.id));
    const inventory = options.includeUnassignedMedia ? state.media : assigned;
    section("Database overview", [`People: ${people.length}`, `Families: ${state.families.length}`, `Places: ${state.places.length}`, `Sources: ${state.sources.length}`, `Media: ${inventory.length}`, `Relationships: ${rels.length}`, `Events: ${state.events.length}`, `Living people: ${people.filter(p => p.living).length}`]);
    section("People statistics", [...["female", "male", "nonbinary", "unknown"].map(g => `${g}: ${people.filter(p => p.gender === g).length}`), `Recorded as not living: ${people.filter(p => !p.living).length}`, `Birth dates recorded: ${people.filter(p => p.birthDate).length}`, `Death dates recorded: ${people.filter(p => p.deathDate).length}`, `Profiles with biographies: ${people.filter(p => p.biography).length}`]);
    section("Research statistics", [`Facts: ${people.reduce((sum, p) => sum + p.facts.length, 0)}`, `Historical records: ${state.records.length}`, `Profiles with person-level citations: ${people.filter(p => p.sourceIds.length).length}`, ...["open", "doing", "done"].map(status => `Tasks ${status}: ${state.todos.filter(t => t.status === status).length}`)]);
    section("Media inventory", [`Assigned media: ${assigned.length}`, ...["picture", "video", "audio", "pdf", "website", "document"].map(kind => `${kind}: ${inventory.filter(m => m.type === kind).length}`), ...assigned.map(m => `${m.title} | ${m.type}`)]);
    if (options.includeUnassignedMedia) section("Unassigned media", [`Unassigned media: ${unassigned.length}`, ...unassigned.map(m => `${m.title} | ${m.type}`)]);
    content.push(p("Counts respect the selected privacy scope. Unassigned media are included only when requested; hidden attachments are never reclassified as unassigned."));
  } else if (type === "Persons List") {
    list("People", people.filter(p => inDateRange(p.birthDate, options.dateFrom, options.dateTo)).map(person => { const details = { ...emptyDeathDetails(), ...(person.deathDetails || {}) }; const place = (type: string) => personEvents(person.id).filter(e => e.type.toLowerCase() === type).map(e => state.places.find(p => p.id === e.placeId)?.name).filter(Boolean).join("; ") || "Not recorded"; const deathPlace = [details.deathPlace, details.deathHospital, details.cemeteryName].filter(Boolean).join("; ") || place("death"); return { name: fullName(person), date: person.birthDate, surname: person.familyName, type: person.gender, place: place("birth"), status: person.living ? "Living" : "Not living", text: `${fullName(person)} | Born: ${person.birthDate || "Not recorded"} | Birth place: ${place("birth")} | Died: ${person.living ? "Living" : person.deathDate || "Not recorded"} | Death place: ${deathPlace}`, cells: { Name: fullName(person), Born: person.birthDate, "Birth place": place("birth"), Died: person.living ? "Living" : person.deathDate, "Death place": deathPlace, Gender: person.gender, Aliases: person.aliases.join(", "), Labels: person.labels.join(", "), Sources: sourceText(person.sourceIds), Events: String(personEvents(person.id).length), Media: String(state.media.filter(m => person.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "person" && a.id === person.id)).length), "Record ID": person.id } }; }));
  } else if (type === "Facts List" || type === "LDS Ordinances List") {
    const factRows = people.flatMap(person => person.facts.filter(f => (type === "Facts List" || /^LDS\s*:/i.test(f.type) || /^(?:LDS ordinance|Ordinance|Endowment|Sealing(?: to (?:Parents|Spouse))?)$/i.test(f.type)) && inDateRange(f.date || "", options.dateFrom, options.dateTo)).map(f => ({ name: fullName(person), surname: person.familyName, type: f.type, date: f.date, text: `${fullName(person)} | ${f.type}: ${f.value} | ${f.date || "Undated"}`, cells: { Person: fullName(person), Type: f.type, Value: f.value, Date: f.date || "", Sources: sourceText(f.sourceIds) } })));
    list(type === "Facts List" ? "Recorded facts" : "Locally recorded ordinances", factRows);
    const factMeanings = reportTermMeanings(factRows.flatMap(row => [row.type, row.cells.Value]), state.customFactTerms);
    if (factMeanings.length) content.push(h("Fact Meanings"), ...factMeanings);
    if (type === "LDS Ordinances List") content.push(p("These are user-entered local records, not confirmation from a religious registry."));
  } else if (type === "ToDo List") {
    list("Research tasks", state.todos.filter(t => (!options.todoStatus || options.todoStatus === "all" || options.todoStatus === t.status) && inDateRange(t.dueDate, options.dateFrom, options.dateTo)).map(t => ({ name: t.title, date: t.dueDate, status: t.status, type: t.priority, surname: people.find(p => p.id === t.personId)?.familyName, text: `${t.title} | ${t.status} | Priority: ${t.priority}${t.personId ? ` | ${name(t.personId)}` : ""}${t.dueDate ? ` | Due: ${t.dueDate}` : ""}`, cells: { Task: t.title, Status: t.status, Priority: t.priority, Person: t.personId ? name(t.personId) : "", "Due date": t.dueDate } })));
  } else if (type === "Changes List") {
    if (options.includePrivate) list("Change history", state.changes.filter(c => c.treeId === treeId && inDateRange(c.at.slice(0, 10), options.dateFrom, options.dateTo)).map(c => ({ name: c.label, date: c.at.slice(0, 10), text: `${c.at} | ${c.label}`, cells: { Date: c.at, Change: c.label } })));
    else section("Change history", ["Change descriptions can contain private names. Include private details to export this history."]);
  } else if (type === "Plausibility Report") {
    const issues = runPlausibilityChecks(state, treeId, options.thresholds);
    section("Publication review", issues.length ? issues.map(i => `${i.severity.toUpperCase()}: ${i.label}. ${i.detail}`) : ["No inconsistencies were found by the implemented date and ancestry checks. This is not proof that every record is correct."]);
    section("Possible duplicate records", findDuplicateCandidates(state, treeId).map(pair => `${fullName(pair.a)} / ${fullName(pair.b)}: ${pair.reason}`));
  } else if (type === "Sources List") {
    const uses = new Map<string, string[]>();
    const add = (ids: string[], detail: string) => ids.forEach(id => uses.set(id, [...(uses.get(id) || []), detail]));
    people.forEach(p => { add(p.sourceIds, `Person: ${fullName(p)}`); p.facts.forEach(f => add(f.sourceIds, `Fact: ${fullName(p)}, ${f.type}`)); });
    events.forEach(e => add(e.sourceIds, `Event: ${eventLine(e)}`));
    rels.forEach(r => add(r.sourceIds, `Relationship: ${name(r.fromId)} / ${name(r.toId)}, ${r.type}${r.subtype ? `; ${r.subtype}` : ""}${r.type === "parent-child" ? `; parentage: ${PARENTAGE_LABELS[r.parentage || "unspecified"]}` : ""}`));
    state.families.forEach(f => add(f.sourceIds, `Family: ${f.name}`));
    state.places.forEach(place => add(place.sourceIds, `Place: ${place.name}`));
    state.records.forEach(r => { if (r.sourceId) add([r.sourceId], `Record: ${r.title}`); });
    const sourceRow = (id: string, refs: string[]): ListRow => { const source = state.sources.find(s => s.id === id); const used = [...new Set(refs)].join("; "); return { name: source?.title || id, type: source?.templateId, status: refs.length ? "Cited" : "Unlinked", text: `${source ? `${source.title}: ${source.citation || "Citation text missing"}` : `Missing source record: ${id}`}${used ? ` | Used by: ${used}` : ""}`, cells: { Title: source?.title || `Missing source record: ${id}`, Citation: source?.citation || "Citation text missing", Uses: used, URL: source?.url || "", Notes: source?.notes || "", Media: String(source?.mediaIds.filter(id => state.media.some(m => m.id === id)).length || 0) } }; };
    list("Citations used", [...uses].map(([id, refs]) => sourceRow(id, refs)));
    list("Unlinked bibliography", state.sources.filter(s => !uses.has(s.id)).map(s => sourceRow(s.id, [])));
    section("Claims without attached citations", [...people.filter(p => !p.sourceIds.length).map(p => `Person: ${fullName(p)}`), ...people.flatMap(p => p.facts.filter(f => !f.sourceIds.length).map(f => `Fact: ${fullName(p)}, ${f.type}`)), ...events.filter(e => !e.sourceIds.length).map(eventLine)]);
    content.push(p("A citation records where information came from; it does not automatically prove it. Uncited claims need review and are not automatically labelled false or speculative."));
  } else if (["Descendancy Report", "Descendancy List", "Register Report"].includes(type)) {
    content.push(h(type === "Register Report" ? "Register narratives" : "Descendants"));
    if (type === "Register Report") {
      content.push(p("Arabic numbers identify continued family entries; lower-case Roman numerals identify children within each entry. Children are ordered by recorded birth date, then name. Shared descendants keep the same continuation number."));
      const entries = registerEntries(state, person!.id, Math.max(1, Math.min(10, options.descendantGenerations ?? generations)));
      let generation = -1;
      for (const entry of entries) {
        if (generation !== entry.depth) { generation = entry.depth; content.push(h(`Generation ${generation + 1}`, 3)); }
        const individual = people.find(p => p.id === entry.id)!;
        content.push(h(`${entry.number}. ${name(entry.id)}`, 3), ...narrativeSections(state, individual, options).flatMap(section => section.paragraphs.map(p)));
        for (const child of entry.children) {
          const individual = people.find(p => p.id === child.id)!;
          content.push(p(`${child.roman}. ${name(child.id)}${child.continued ? `; continued at ${child.continued}.` : "."}`));
          if (!child.continued) content.push(...narrativeSections(state, individual, options).flatMap(section => section.paragraphs.map(p)));
        }
      }
    } else {
    const walk = (id: string, depth: number, path: string[]) => {
      const partners = rels.filter(r => ["spouse", "partner"].includes(r.type) && [r.fromId, r.toId].includes(id)).map(r => `${name(r.fromId === id ? r.toId : r.fromId)} (${r.type}${r.status ? `, ${r.status}` : ""})`);
      const row = `${depth === 0 ? "Starting person" : `Generation ${depth}`}: ${[...path, id].map(name).join(" -> ")}${partners.length ? `. Partners: ${partners.join("; ")}` : ". No partners recorded."}`;
      content.push(p(row));
      if (type === "Descendancy Report") content.push(...narrativeSections(state, people.find(p => p.id === id)!, options).flatMap(section => section.paragraphs.map(p)));
      if (depth >= Math.max(1, Math.min(10, options.descendantGenerations ?? generations))) return;
      [...new Set(children(id))].forEach(child => path.includes(child) || child === id ? content.push(p(`Cycle detected at ${name(child)}; branch stopped.`)) : walk(child, depth + 1, [...path, id]));
    };
    walk(person!.id, 0, []);
    }
  } else if (["Marriage List", "Marriages List"].includes(type)) {
    list("Recorded unions", rels.filter(r => ["spouse", "partner"].includes(r.type) && inDateRange(r.startDate || "", options.dateFrom, options.dateTo)).map(r => ({ name: `${name(r.fromId)} / ${name(r.toId)}`, date: r.startDate, type: r.type, status: r.status, surname: people.find(p => p.id === r.fromId)?.familyName, text: `${name(r.fromId)} / ${name(r.toId)} | ${r.type} | ${r.startDate || "Start unknown"} | ${r.endDate || "No end recorded"} | ${r.status || "Status not recorded"}`, cells: { Partners: `${name(r.fromId)} / ${name(r.toId)}`, Type: r.type, Start: r.startDate || "", End: r.endDate || "", Status: r.status || "", Sources: sourceText(r.sourceIds) } })));
    list("Marriage events", events.filter(e => /marriage|union|divorce|separation|annulment/i.test(e.type)).map(eventRow));
  } else if (type === "Places List") {
    list("Places and events", state.places.map(place => { const atPlace = events.filter(e => e.placeId === place.id); return { name: place.name, place: place.name, date: atPlace[0]?.date, type: place.templateId, text: `${place.name} | ${place.address || "No address"} | ${place.latitude !== "" && place.longitude !== "" ? `${place.latitude}, ${place.longitude}` : "No coordinates"}${atPlace.length ? ` | ${atPlace.map(eventLine).join("; ")}` : ""}`, cells: { Place: place.name, Address: place.address, Latitude: place.latitude, Longitude: place.longitude, Events: atPlace.map(eventLine).join("; "), Sources: sourceText(place.sourceIds), Notes: place.notes } }; }).filter(row => !options.dateFrom && !options.dateTo || !!row.date));
  } else if (["Events List", "Person Events Report"].includes(type)) {
    list("Chronological events", (type === "Person Events Report" ? lifeEvents(state, person!, options.eventScope || "all-relatives", options) : events).map(event => {
      const row = eventRow(event);
      if (person && !person.eventIds.includes(event.id) && lifetimeOverlap(person.birthDate, person.living ? localToday() : person.deathDate, event.date) === "possible") { row.text += " | Date interval overlaps lifetime; exact inclusion is uncertain."; row.cells.Description += " (Date interval overlaps lifetime; exact inclusion is uncertain.)"; }
      return row;
    }));
    if (type === "Person Events Report") content.push(p("Includes the person's own events and selected recorded family events during their lifetime. Partial Gregorian dates are compared as intervals; overlaps at uncertain lifetime boundaries are labelled. Family events without usable lifetime bounds are omitted."));
  } else if (type === "Anniversary List" || type === "Today Report") {
    const dates = [...people.flatMap(p => [{ date: p.birthDate, label: `${fullName(p)}: birthday`, type: "Birth" }, { date: p.deathDate, label: `${fullName(p)}: death anniversary`, type: "Death" }]), ...rels.filter(r => r.type === "spouse").map(r => ({ date: r.startDate || "", label: `${name(r.fromId)} / ${name(r.toId)}: marriage anniversary`, type: "Marriage" })), ...events.filter(e => !/birth|death/i.test(e.type)).map(e => ({ date: e.date, label: eventLine(e), type: e.type }))];
    const today = new Date(), monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const calendar = dates.flatMap(d => { const parts = dateParts(d.date); const md = parts ? `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` : ""; return parts && (type !== "Today Report" || md === monthDay) && inDateRange(d.date, options.dateFrom, options.dateTo) && (options.eventTypes === undefined || options.eventTypes.some(t => t.toLowerCase() === d.type.toLowerCase())) ? [{ name: d.label, date: d.date, type: d.type, md, text: `${md} | ${d.label} | Original date: ${d.date}`, cells: { "Month-day": md, Event: d.label, "Original date": d.date } }] : []; }).sort((a, b) => a.md.localeCompare(b.md));
    list(type === "Today Report" ? "On this day" : "Annual calendar (month-day)", calendar);
    content.push(p("Calendar entries use Gregorian month/day anniversaries. Explicit alternative-calendar dates are converted to their original Gregorian date; this does not calculate current-year lunar or religious observances. Entries without a recorded month and day are omitted. February 29 is retained as recorded; no alternate observance date is assumed."));
  } else if (["Ahnentafel Report", "Ahnentafel Diagram", "Fan Chart"].includes(type)) {
    const ancestorGenerations = Math.max(1, Math.min(10, options.ancestorGenerations ?? generations));
    const depth = type === "Fan Chart" ? Math.min(ancestorGenerations, 5) : ancestorGenerations;
    const result = ahnentafel(state, person!.id, depth);
    content.push(p("Number 1 is the selected person. For any number n, 2n is the recorded father and 2n+1 the recorded mother. Unknown or ambiguous roles are listed separately, never guessed."));
    if (type === "Fan Chart") content.push(h("Ancestor diagram"), chart({ kind: "fan", title: type, width: 1000, height: 620, nodes: [], paths: [], slots: result.slots.map(s => ({ number: s.number, label: name(s.id) })) }));
    if (type === "Ahnentafel Diagram") {
      const graph = new dagre.graphlib.Graph().setGraph({ rankdir: "LR", nodesep: 24, ranksep: 45 }).setDefaultEdgeLabel(() => ({}));
      result.slots.forEach(s => graph.setNode(String(s.number), { width: NODE_WIDTH, height: NODE_HEIGHT }));
      result.slots.filter(s => s.number > 1).forEach(s => graph.setEdge(String(Math.floor(s.number / 2)), String(s.number)));
      dagre.layout(graph);
      content.push(h("Ancestor diagram"), chart({ kind: "network", title: type, width: graph.graph().width || 400, height: graph.graph().height || 200, nodes: result.slots.map(s => ({ id: String(s.number), label: `${s.number}. ${name(s.id)}`, x: graph.node(String(s.number)).x - NODE_WIDTH / 2, y: graph.node(String(s.number)).y - NODE_HEIGHT / 2 })), paths: graph.edges().map(e => ({ d: graph.edge(e).points.map((p: { x: number; y: number }, i: number) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "), color: "#396e75" })) }));
    }
    section("Numbered ancestors", result.slots.map(s => `${s.number}. ${name(s.id)} | Generation ${s.depth}${s.number > 1 ? ` | Parentage: ${PARENTAGE_LABELS[rels.find(r => r.type === "parent-child" && r.fromId === s.id && r.toId === result.slots.find(slot => slot.number === Math.floor(s.number / 2))?.id)?.parentage || "unspecified"]}` : ""}`));
    if (type === "Ahnentafel Report") {
      content.push(h("Ancestor narratives"));
      for (const slot of result.slots) content.push(h(`${slot.number}. ${name(slot.id)}`, 3), ...narrativeSections(state, people.find(p => p.id === slot.id)!, options).flatMap(section => section.paragraphs.map(p)));
      content.push(h("Unnumbered ancestor narratives"));
      if (!result.unnumbered.length) content.push(p("None recorded."));
      for (const entry of result.unnumbered) content.push(h(`${name(entry.id)} | Generation ${entry.depth}`, 3), ...narrativeSections(state, people.find(p => p.id === entry.id)!, options).flatMap(section => section.paragraphs.map(p)));
    }
    section("Unassigned parent roles", result.unresolved);
    if (type === "Fan Chart" && generations > 5) content.push(p("This fan shows five ancestor generations for readable labels."));
  } else if (["Name Distribution Report", "Name Distribution Chart"].includes(type)) {
    const counts = new Map<string, number>(); people.forEach(p => counts.set(p.familyName || "[No surname]", (counts.get(p.familyName || "[No surname]") || 0) + 1));
    const bars = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    content.push(h("Surname chart"), chart({ kind: "bars", title: "Surname frequency", width: 900, height: Math.max(160, bars.length * 35 + 50), nodes: [], paths: [], bars }));
    section("Surname distribution", bars.map(b => `${b.label}: ${b.value} people (${people.length ? (b.value / people.length * 100).toFixed(1) : 0}%)`));
    section("Surname and recorded event places", bars.flatMap(b => { const ids = new Set(people.filter(p => (p.familyName || "[No surname]") === b.label).flatMap(p => p.eventIds)); const places = [...new Set(events.filter(e => ids.has(e.id) && e.placeId).map(e => state.places.find(p => p.id === e.placeId)?.name).filter(Boolean))]; return [`${b.label}: ${places.join(", ") || "No event places recorded"}`]; }));
  } else if (["Timeline Report", "Timeline Chart"].includes(type)) {
    const timeline = lifeEvents(state, person!, options.eventScope || "person", options);
    const life = [{ date: person!.birthDate, type: "Birth", label: `${fullName(person!)}: birth` }, ...(!person!.living ? [{ date: person!.deathDate, type: "Death", label: `${fullName(person!)}: death` }] : []), ...timeline.map(e => ({ date: e.date, type: e.type, label: eventLine(e) }))].filter(e => inDateRange(e.date, options.dateFrom, options.dateTo) && (options.eventTypes === undefined || options.eventTypes.some(type => type.toLowerCase() === e.type.toLowerCase())));
    const entries = life.flatMap(e => { const interval = dateInterval(e.date); return interval && Number.isFinite(interval.earliest) && Number.isFinite(interval.latest) && new Date(interval.earliest).getUTCFullYear() === new Date(interval.latest).getUTCFullYear() ? [{ year: new Date(interval.earliest).getUTCFullYear(), label: e.label }] : []; });
    if (type === "Timeline Chart") content.push(h("Timeline diagram"), chart({ kind: "timeline", title: "Recorded event chronology", width: 1100, height: Math.max(200, entries.length * 55 + 70), nodes: [], paths: [], entries }));
    const chronological = life.sort((a, b) => options.sortBy === "name" ? a.label.localeCompare(b.label) : options.sortBy === "type" ? a.type.localeCompare(b.type) : compareDates(a.date, b.date));
    if (options.sortDirection === "desc") chronological.reverse();
    section("Life chronology", chronological.map(e => `${e.date || "Undated"} | ${e.label}`));
    content.push(p("The chart positions dated events by recorded year. Undated and non-standard dates remain in the chronology list."));
  } else if (type === "Influential People Report") {
    const graph = new dagre.graphlib.Graph({ directed: false }); people.forEach(p => graph.setNode(p.id)); rels.forEach(r => graph.setEdge(r.fromId, r.toId));
    const scores = people.map(person => ({ person, count: graph.neighbors(person.id)?.length || 0 })).sort((a, b) => b.count - a.count || fullName(a.person).localeCompare(fullName(b.person)));
    content.push(p("Recorded connection analysis: degree centrality counts each directly connected person once, across recorded parent, spouse, partner, sibling and guardian links. This is not a judgement of real-world influence or importance; missing records affect the ranking."));
    section("Connection ranking", scores.map((s, i) => `${i + 1}. ${fullName(s.person)}: ${s.count} direct connections; ${people.length > 1 ? (s.count / (people.length - 1) * 100).toFixed(1) : 0}% of other people.`));
  } else {
    let selected = people;
    if (type === "Hourglass Chart") {
      const ids = new Set([...visiblePeople(state, treeId, person!.id, "ancestors", Math.max(1, Math.min(10, options.ancestorGenerations ?? generations))), ...visiblePeople(state, treeId, person!.id, "descendants", Math.max(1, Math.min(10, options.descendantGenerations ?? generations)))].map(p => p.id)); selected = people.filter(p => ids.has(p.id));
    }
    if (type === "Relationship Chart") {
      const target = people.find(p => p.id === options.comparisonId);
      if (!target) return { type: "doc", content: [...content, p("Choose a comparison person to draw a relationship line.")] };
      const result = createKinshipIndex(state, treeId)(person!.id, target.id);
      const ids = new Set(result.paths.length ? result.paths.flatMap(p => [...p.referencePath, ...p.relativePath]) : result.connection);
      selected = people.filter(p => ids.has(p.id));
      section("Relationship", generateKinshipReport(state, treeId, person!.id, { comparisonId: target.id, includePrivate: true }).split("\n").filter(Boolean));
    }
    const layout = layoutFamily(selected, rels);
    const lines = familyLines(layout, rels);
    const minX = Math.min(0, ...layout.map(n => n.position.x)), minY = Math.min(0, ...layout.map(n => n.position.y)) - 50;
    const nodes = layout.map(n => ({ id: n.person.id, label: fullName(n.person), x: n.position.x, y: n.position.y, shape: type === "Genogram" ? n.person.gender : undefined, detail: n.person.birthDate || "Birth not recorded", symbols: personSymbols(state, n.person, options.includePrivate) }));
    const paths = lines.flatMap(line => [...line.paths.map(path => ({ d: path.d, color: LINE_STYLES[path.kind].color, dash: LINE_STYLES[path.kind].dash })), ...(line.status && line.junction ? [{ d: statusMark(line.status, line.junction), color: "#865275" }] : [])]);
    content.push(h("Diagram"), chart({ kind: "network", title: type, width: Math.max(300, ...nodes.map(n => n.x + NODE_WIDTH)) - minX + 50, height: Math.max(200, ...nodes.map(n => n.y + NODE_HEIGHT)) - minY + 30, nodes, paths }));
    content.push(h("Line legend"));
    if (lines.length) content.push(lineLegendDocument(lines)); else content.push(p("No relationship lines recorded for this diagram."));
    content.push(p("A filled dot is the family junction: the point where a recorded parent or couple line branches toward children. Lines are connections, not extra people."));
    section("Union status marks", ["One slash across a union line: recorded separation.", "Two slashes across a union line: recorded divorce.", "A cross on a union line: recorded annulment. These marks are not interchangeable."]);
    if (type === "Genogram") content.push(p("Symbols follow recorded gender: square male, circle female, diamond nonbinary, question mark unknown. They do not assert sex assigned at birth. Union marks: one slash separated, two divorced, cross annulled. Medical and disability details are not inferred."));
    if (type === "Sociogram") content.push(p("This social map includes the relationship categories recorded in this tree. Unrecorded friendships and other social ties are not inferred."));
    section("People in diagram", selected.map(p => `${fullName(p)} | ${p.birthDate || "Birth not recorded"}`));
    for (const person of selected) content.push(...personSymbolDocument(state, person, options.includePrivate));
    section("Recorded connections", rels.filter(r => selected.some(p => p.id === r.fromId) && selected.some(p => p.id === r.toId)).map(r => `${name(r.fromId)} -> ${r.type}${r.status ? ` (${r.status})` : ""} -> ${name(r.toId)}`));
  }
  return { type: "doc", content: filterReportSections(content, type, options.sections) };
}

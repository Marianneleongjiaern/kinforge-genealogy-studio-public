import type { JSONContent } from "@tiptap/core";
import { AppState, Person, fullName } from "./domain";
import type { ReportLanguage, ReportOptions } from "./reportOptions";
import { reportScope } from "./reportCatalog";
import { ageOn, compareDates, dateInterval, inDateRange, lifetimeOverlap } from "./reportDates";
import { ContextRecord, HISTORY_CATALOG } from "./data/reportHistoryCatalog";

const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string, level = 2): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
export const reportLanguage = (options: ReportOptions, en: string, de: string, fr: string, es: string) => ({ en, de, fr, es } as Partial<Record<ReportLanguage, string>>)[options.language || "en"] || en;

export type LifetimeContext = ContextRecord & { origin: "catalog" | "local"; overlap: "within" | "possible"; age?: number };
export function lifetimeHistory(original: AppState, treeId: string, personId: string, options: ReportOptions = {}, today = new Date().toISOString().slice(0, 10)) {
  const state = reportScope(original, treeId, options.includePrivate, options.parentage), person = state.people.find(p => p.id === personId);
  const empty = (reason: string) => ({ person, rows: [] as LifetimeContext[], reason, omittedLocal: 0 });
  if (!person) return empty("Choose a visible person. Private profile details are hidden.");
  const endDate = person.living ? today : person.deathDate;
  const birth = dateInterval(person.birthDate), death = dateInterval(endDate);
  if (!birth || !death || !Number.isFinite(birth.earliest) || !Number.isFinite(death.latest) || birth.earliest > death.latest) return empty("A valid recorded birth date and death date (or living status) are needed to establish the lifetime. No lifetime has been guessed.");
  const linkedEvents = new Set([...person.eventIds, ...state.families.filter(f => [...f.partnerIds, ...f.childIds].includes(person.id)).flatMap(f => f.eventIds)]);
  const placeIds = new Set(state.events.filter(e => linkedEvents.has(e.id)).map(e => e.placeId));
  const places = state.places.filter(p => placeIds.has(p.id));
  const regionValues = new Set(places.flatMap(p => [p.name, ...Object.values(p.levels)]).map(s => s.trim().toLowerCase()));
  const relevant = (region: string) => region === "World" || regionValues.has(region.toLowerCase()) || region === "United States" && ["usa", "us", "united states of america"].some(s => regionValues.has(s));
  const datedContext = (row: ContextRecord, origin: LifetimeContext["origin"]): LifetimeContext | undefined => {
    const overlap = lifetimeOverlap(person.birthDate, endDate, row.date);
    if (!["within", "possible"].includes(overlap) || !inDateRange(row.date, options.dateFrom, options.dateTo)) return;
    return { ...row, origin, overlap: overlap as "within" | "possible", age: ageOn(person.birthDate, row.date) };
  };
  const rows = HISTORY_CATALOG.records.filter(r => relevant(r.region)).map(r => datedContext(r, "catalog")).filter((r): r is LifetimeContext => !!r);
  let omittedLocal = 0;
  for (const record of state.records.filter(r => (!r.personId || r.personId === person.id) && /^(world history|historical context|history)$/i.test(r.collection.trim()))) {
    const source = state.sources.find(s => s.id === record.sourceId);
    const citation = record.citation.trim() || source?.citation.trim() || source?.title.trim();
    const date = dateInterval(record.date);
    if (!citation || !date || !Number.isFinite(date.earliest) || !Number.isFinite(date.latest)) { omittedLocal++; continue; }
    const row = datedContext({ id: `local:${record.id}`, date: record.date, title: record.title, summary: record.transcription, region: record.placeId ? state.places.find(p => p.id === record.placeId)?.name || "Local record" : "Local record", citation, url: source?.url || "" }, "local");
    if (row) rows.push(row);
  }
  rows.sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id));
  return { person, rows, reason: "", omittedLocal };
}

export function historyReportDocument(state: AppState, treeId: string, personId?: string, options: ReportOptions = {}): JSONContent {
  const result = lifetimeHistory(state, treeId, personId || "", options);
  const content: JSONContent[] = [h("World History Report", 1)];
  if (result.reason) return { type: "doc", content: [...content, p(result.reason)] };
  const person = result.person as Person;
  content.push(h("Coverage"), p(reportLanguage(options,
    `Lifetime context for ${fullName(person)}: ${person.birthDate} to ${person.living ? "present (recorded as living)" : person.deathDate}.`,
    `Zeitgeschichtlicher Kontext fuer ${fullName(person)}: ${person.birthDate} bis ${person.living ? "heute (als lebend erfasst)" : person.deathDate}.`,
    `Contexte historique de ${fullName(person)} : ${person.birthDate} a ${person.living ? "aujourd'hui (en vie dans le dossier)" : person.deathDate}.`,
    `Contexto historico de ${fullName(person)}: ${person.birthDate} a ${person.living ? "hoy (registrado con vida)" : person.deathDate}.`)),
    p(`Local catalog ${HISTORY_CATALOG.version}: ${HISTORY_CATALOG.records.length} selected English-language entries, 1776-1993. Coverage is finite and uneven: selected international milestones, Singapore and the United States. National entries require a matching recorded place name or country field. This is not a complete world-history database.`),
    p("Date overlap provides historical context, not evidence that the person experienced or participated in the event. Partial dates are marked as possible when the overlap is uncertain. Source and user-authored wording is preserved."));
  let citation = 0;
  const references: JSONContent[] = [];
  for (const [title, origin] of [["Historical Context", "catalog"], ["Local Historical Context", "local"]] as const) {
    content.push(h(title));
    const rows = result.rows.filter(r => r.origin === origin);
    if (!rows.length) content.push(p("No matching dated, cited records within this lifetime and the selected date range."));
    for (const row of rows) {
      citation++;
      content.push(h(`${row.date} | ${row.title}`, 3), p(`${row.region}${row.age !== undefined ? ` | Age: ${row.age}` : ""}${row.overlap === "possible" ? " | Possible lifetime overlap (partial dates)" : ""} | [H${citation}]`));
      if (row.summary) content.push(p(row.summary));
      references.push(p(`[H${citation}] ${row.citation}${row.url ? ` ${row.url}` : ""}`));
    }
  }
  content.push(p("Custom context uses local historical records in the World History, Historical Context or History collection, with a date and citation. Person-linked records apply only to that person; records without a person apply to the tree."));
  if (result.omittedLocal) content.push(p(`${result.omittedLocal} local context records omitted because their date or citation is missing or invalid.`));
  content.push(h("Historical Citations"), ...(references.length ? references : [p("No context citations for this selection.")]));
  return { type: "doc", content };
}

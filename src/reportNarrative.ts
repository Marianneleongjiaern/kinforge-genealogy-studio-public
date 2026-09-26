import { AppState, Person, fullName } from "./domain";
import type { ReportOptions } from "./reportOptions";
import { compareDates, dateInterval, inDateRange } from "./reportDates";
import { lifeEvents } from "./reportFacts";
import { EXTRA_NARRATIVE_LOCALES } from "./reportNarrativeLocales";

export const NARRATIVE_LANGUAGES = ["en", "de", "da", "fr", "fi", "it", "nl", "pt-BR", "ru", "es", "sv", "hu", "pl", "nb", "cs"] as const;
export type NarrativeLocale = {
  terms: Record<string, string>;
  birthOn: string; birthIn: string; birthMissing: string; parents: string; parentsMissing: string;
  living: string; deathOn: string; deathIn: string; deathMissing: string;
  eventDated: string; eventUndated: string; place: string; marriage: string; partnership: string;
  unionStart: string; unionEnd: string; children: string; notesMissing: string; none: string;
};
type Language = "en" | "de" | "fr" | "es";
const vocabulary: Record<Language, Record<string, string>> = {
  en: { birth: "birth", death: "death", marriage: "marriage", divorce: "divorce", burial: "burial", cremation: "cremation", residence: "residence", baptism: "baptism", occupation: "occupation", biological: "biological", adoptive: "adoptive", foster: "foster", step: "step-parent", unspecified: "parentage not recorded", married: "married", divorced: "divorced", separated: "separated", annulled: "annulled", widowed: "widowed" },
  de: { birth: "Geburt", death: "Tod", marriage: "Eheschlie\u00dfung", divorce: "Scheidung", burial: "Bestattung", cremation: "Ein\u00e4scherung", residence: "Wohnsitz", baptism: "Taufe", occupation: "Beruf", biological: "biologisch", adoptive: "Adoption", foster: "Pflegeelternschaft", step: "Stiefelternschaft", unspecified: "Art der Elternschaft nicht verzeichnet", married: "verheiratet", divorced: "geschieden", separated: "getrennt", annulled: "annulliert", widowed: "verwitwet" },
  fr: { birth: "naissance", death: "d\u00e9c\u00e8s", marriage: "mariage", divorce: "divorce", burial: "inhumation", cremation: "cr\u00e9mation", residence: "r\u00e9sidence", baptism: "bapt\u00eame", occupation: "profession", biological: "biologique", adoptive: "adoption", foster: "accueil", step: "beau-parent", unspecified: "type de filiation non renseign\u00e9", married: "mariage", divorced: "divorce", separated: "s\u00e9paration", annulled: "annulation", widowed: "veuvage" },
  es: { birth: "nacimiento", death: "fallecimiento", marriage: "matrimonio", divorce: "divorcio", burial: "entierro", cremation: "cremaci\u00f3n", residence: "residencia", baptism: "bautismo", occupation: "ocupaci\u00f3n", biological: "biol\u00f3gico", adoptive: "adopci\u00f3n", foster: "acogimiento", step: "padrastro o madrastra", unspecified: "tipo de filiaci\u00f3n no registrado", married: "matrimonio", divorced: "divorcio", separated: "separaci\u00f3n", annulled: "anulaci\u00f3n", widowed: "viudez" }
};
export const narrativeTerm = (term: string, language: ReportOptions["language"] = "en") =>
  (EXTRA_NARRATIVE_LOCALES[language]?.terms || vocabulary[language as Language] || vocabulary.en)[term.toLowerCase()] || term;
export const narrativeNone = (language: ReportOptions["language"] = "en") => EXTRA_NARRATIVE_LOCALES[language]?.none || ({ en: "None recorded.", de: "Keine Angaben verzeichnet.", fr: "Aucune information enregistr\u00e9e.", es: "No hay datos registrados." }[language as Language] || "None recorded.");
export type NarrativeSection = { title: string; paragraphs: string[] };
const fill = (template: string, values: Record<string, string>) => template.replace(/\{([a-z]+)\}/g, (token, key: string) => values[key] ?? token);

export function narrativeEvent(state: AppState, event: AppState["events"][number], options: ReportOptions = {}) {
  if (event.private && !options.includePrivate) return "";
  const requested = options.language || "en", language: Language = requested in vocabulary ? requested as Language : "en", extra = EXTRA_NARRATIVE_LOCALES[requested];
  const word = (term: string) => narrativeTerm(term, requested);
  const place = state.places.find(p => p.id === event.placeId)?.name;
  if (extra) return `${fill(event.date ? extra.eventDated : extra.eventUndated, { date: event.date, type: word(event.type) })}${place ? fill(extra.place, { place }) : ""}.${event.description ? ` ${event.description}` : ""}`;
  const sentences = {
    en: `${event.date ? `On ${event.date}` : "At an unrecorded date"}, a ${word(event.type)} event is recorded${place ? ` in ${place}` : ""}.`,
    de: `${event.date ? `Zum Datum ${event.date}` : "Ohne Datumsangabe"} ist folgendes Ereignis verzeichnet: ${word(event.type)}${place ? ` in ${place}` : ""}.`,
    fr: `${event.date ? `Date enregistr\u00e9e : ${event.date}` : "Date non renseign\u00e9e"}. \u00c9v\u00e9nement : ${word(event.type)}${place ? ` ; lieu : ${place}` : ""}.`,
    es: `${event.date ? `Fecha registrada: ${event.date}` : "Fecha no registrada"}. Evento: ${word(event.type)}${place ? `; lugar: ${place}` : ""}.`
  };
  return `${sentences[language]}${event.description ? ` ${event.description}` : ""}`;
}

export function narrativeSections(state: AppState, person: Person, options: ReportOptions = {}): NarrativeSection[] {
  if (person.private && !options.includePrivate) return [];
  const visible = new Set(state.people.filter(p => p.treeId === person.treeId && (!p.private || options.includePrivate)).map(p => p.id));
  state = { ...state, people: state.people.filter(p => visible.has(p.id)), relationships: state.relationships.filter(r => r.treeId === person.treeId && visible.has(r.fromId) && visible.has(r.toId)), families: state.families.filter(f => f.treeId === person.treeId).map(f => ({ ...f, partnerIds: f.partnerIds.filter(id => visible.has(id)), childIds: f.childIds.filter(id => visible.has(id)) })) };
  const requested = options.language || "en", language: Language = requested in vocabulary ? requested as Language : "en", extra = EXTRA_NARRATIVE_LOCALES[requested], who = fullName(person);
  const word = (term: string) => narrativeTerm(term, requested);
  const named = (id: string) => fullName(state.people.find(p => p.id === id));
  const parentLinks = state.relationships.filter(r => r.type === "parent-child" && r.toId === person.id && state.people.some(p => p.id === r.fromId));
  const parents = parentLinks.map(r => `${named(r.fromId)} (${word(r.parentage || "unspecified")})`).join(", ");
  const children = [...new Set(state.relationships.filter(r => r.type === "parent-child" && r.fromId === person.id && state.people.some(p => p.id === r.toId)).map(r => r.toId))].map(named).join(", ");
  const birth = person.birthDate, death = person.deathDate;
  const englishBirth = birth ? `${who} was born ${dateInterval(birth)?.precision === "day" ? "on" : "in"} ${birth}.` : `${who} has no recorded birth date.`;
  let life = {
    en: `${englishBirth} ${parents ? `Their recorded parents are ${parents}.` : "Their parents have not been recorded."} ${person.living ? "They are recorded as living." : death ? `They died ${dateInterval(death)?.precision === "day" ? "on" : "in"} ${death}.` : "No death date has been recorded."}`,
    de: `${birth ? `${who} wurde ${dateInterval(birth)?.precision === "day" ? "am" : "im Zeitraum"} ${birth} geboren.` : `F\u00fcr ${who} ist kein Geburtsdatum verzeichnet.`} ${parents ? `Als Eltern sind ${parents} verzeichnet.` : "Die Eltern sind nicht verzeichnet."} ${person.living ? "Die Person ist als lebend verzeichnet." : death ? `Als Sterbedatum ist ${death} verzeichnet.` : "Ein Sterbedatum ist nicht verzeichnet."}`,
    fr: `${birth ? `La naissance de ${who} est enregistr\u00e9e \u00e0 la date suivante : ${birth}.` : `Aucune date de naissance n'est enregistr\u00e9e pour ${who}.`} ${parents ? `Les parents enregistr\u00e9s sont ${parents}.` : "Les parents ne sont pas renseign\u00e9s."} ${person.living ? "Cette personne est indiqu\u00e9e comme vivante." : death ? `Le d\u00e9c\u00e8s est enregistr\u00e9 \u00e0 la date suivante : ${death}.` : "Aucune date de d\u00e9c\u00e8s n'est enregistr\u00e9e."}`,
    es: `${birth ? `El nacimiento de ${who} est\u00e1 registrado con la fecha ${birth}.` : `No hay fecha de nacimiento registrada para ${who}.`} ${parents ? `Los progenitores registrados son ${parents}.` : "Los progenitores no est\u00e1n registrados."} ${person.living ? "La persona figura como viva." : death ? `El fallecimiento est\u00e1 registrado con la fecha ${death}.` : "No hay fecha de fallecimiento registrada."}`
  }[language];
  if (extra) life = [fill(birth ? dateInterval(birth)?.precision === "day" ? extra.birthOn : extra.birthIn : extra.birthMissing, { person: who, date: birth }), parents ? fill(extra.parents, { parents }) : extra.parentsMissing, person.living ? extra.living : death ? fill(dateInterval(death)?.precision === "day" ? extra.deathOn : extra.deathIn, { date: death }) : extra.deathMissing].join(" ");
  const orderedEvents = lifeEvents(state, person, options.eventScope || "person", options);
  if (options.sortBy === "type") orderedEvents.sort((a, b) => a.type.localeCompare(b.type));
  if (options.sortBy === "name") orderedEvents.sort((a, b) => a.description.localeCompare(b.description));
  if (options.sortDirection === "desc") orderedEvents.reverse();
  const events = orderedEvents.map(event => narrativeEvent(state, event, options));
  const unions = state.relationships.filter(r => ["spouse", "partner"].includes(r.type) && [r.fromId, r.toId].includes(person.id) && inDateRange(r.startDate || "", options.dateFrom, options.dateTo));
  const relationships = unions.map(r => {
    const other = named(r.fromId === person.id ? r.toId : r.fromId);
    if (extra) return `${fill(r.type === "spouse" ? extra.marriage : extra.partnership, { person: who, other })}${r.startDate ? fill(extra.unionStart, { date: r.startDate }) : ""}${r.status ? ` (${word(r.status)})` : ""}${r.endDate ? fill(extra.unionEnd, { date: r.endDate }) : ""}.`;
    return {
      en: `${who} has a recorded ${r.type === "spouse" ? "marriage" : "partnership"} with ${other}${r.startDate ? ` beginning ${r.startDate}` : ""}${r.status ? ` (${word(r.status)})` : ""}${r.endDate ? ` ending ${r.endDate}` : ""}.`,
      de: `F\u00fcr ${who} und ${other} ist eine ${r.type === "spouse" ? "Ehe" : "Partnerschaft"} verzeichnet${r.startDate ? `, Beginn: ${r.startDate}` : ""}${r.status ? ` (${word(r.status)})` : ""}${r.endDate ? `, Ende: ${r.endDate}` : ""}.`,
      fr: `${who} et ${other} ont ${r.type === "spouse" ? "un mariage enregistr\u00e9" : "une union enregistr\u00e9e"}${r.startDate ? ` ; d\u00e9but : ${r.startDate}` : ""}${r.status ? ` (${word(r.status)})` : ""}${r.endDate ? ` ; fin : ${r.endDate}` : ""}.`,
      es: `${who} y ${other} tienen ${r.type === "spouse" ? "un matrimonio registrado" : "una uni\u00f3n registrada"}${r.startDate ? `; inicio: ${r.startDate}` : ""}${r.status ? ` (${word(r.status)})` : ""}${r.endDate ? `; fin: ${r.endDate}` : ""}.`
    }[language];
  });
  if (children) relationships.push(extra ? fill(extra.children, { children }) : { en: `Their recorded children are ${children}.`, de: `Als Kinder sind ${children} verzeichnet.`, fr: `Les enfants enregistr\u00e9s sont ${children}.`, es: `Los hijos registrados son ${children}.` }[language]);
  const facts = person.facts.filter(f => (!f.private || options.includePrivate) && inDateRange(f.date || "", options.dateFrom, options.dateTo)).map(f => `${word(f.type)}: ${f.value}${f.date ? ` (${f.date})` : ""}.`);
  return [
    { title: "Life narrative", paragraphs: [life] }, { title: "Life events", paragraphs: events },
    { title: "Relationships", paragraphs: relationships }, { title: "Recorded facts", paragraphs: facts },
    { title: "Biography", paragraphs: person.biography ? [person.biography] : [] },
    { title: "Research notes", paragraphs: [person.notes || extra?.notesMissing || { en: "No research notes recorded.", de: "Keine Forschungsnotizen verzeichnet.", fr: "Aucune note de recherche enregistr\u00e9e.", es: "No hay notas de investigaci\u00f3n registradas." }[language]] }
  ];
}

export function romanNumber(value: number): string {
  let result = "";
  for (const [amount, numeral] of [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]] as const) while (value >= amount) { result += numeral; value -= amount; }
  return result;
}

/** Register numbers identify continued family entries; children have local Roman numerals. */
export function registerEntries(state: AppState, rootId: string, generations: number) {
  const people = new Map(state.people.map(person => [person.id, person]));
  const children = (id: string) => [...new Set(state.relationships.filter(r => r.type === "parent-child" && r.fromId === id).map(r => r.toId))].filter(id => people.has(id)).sort((a, b) => compareDates(people.get(a)!.birthDate, people.get(b)!.birthDate) || fullName(people.get(a)).localeCompare(fullName(people.get(b))));
  const numbers = new Map([[rootId, 1]]), queue = [{ id: rootId, depth: 0 }];
  const result: { id: string; number: number; depth: number; children: { id: string; roman: string; continued?: number }[] }[] = [];
  for (let index = 0; index < queue.length; index++) {
    const entry = queue[index];
    const offspring = entry.depth < generations ? children(entry.id).filter(id => id !== rootId) : [];
    for (const id of offspring) if (entry.depth + 1 < generations && children(id).length && !numbers.has(id)) { numbers.set(id, numbers.size + 1); queue.push({ id, depth: entry.depth + 1 }); }
    result.push({ ...entry, number: numbers.get(entry.id)!, children: offspring.map((id, child) => ({ id, roman: romanNumber(child + 1), continued: numbers.get(id) })) });
  }
  return result;
}

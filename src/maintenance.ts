import { AppState, fullName, Person } from "./domain";

export const MAINTENANCE_ACTIONS = ["Search and replace", "Normalize dates", "Reformat names", "Remove empty entries", "Repair family links", "Clean media tags"] as const;
export type MaintenanceAction = typeof MAINTENANCE_ACTIONS[number];
export type MaintenanceChange = { record: string; field: string; before: string; after: string };
export type MaintenancePlan = { next: AppState; changes: MaintenanceChange[]; notices: string[] };

function normalizeDate(value: string): string {
  const match = value.trim().match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/);
  if (!match) return value;
  const [, year, month, day] = match;
  if (month && (+month < 1 || +month > 12)) return value;
  if (day) {
    const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (+day < 1 || +day > days[+month - 1]) return value;
  }
  return [year, month?.padStart(2, "0"), day?.padStart(2, "0")].filter(Boolean).join("-");
}

function hasPersonData(person: Person): boolean {
  return [person.givenName, person.familyName, person.birthDate, person.deathDate, person.biography, person.notes].some(Boolean)
    || person.gender !== "unknown" || person.private || !person.living
    || [person.aliases, person.labels, person.eventIds, person.facts, person.sourceIds, person.mediaIds, person.accessNeeds ?? []].some(items => items.length > 0)
    || Object.values(person.government).some(Boolean);
}

export function planMaintenance(state: AppState, treeId: string, action: MaintenanceAction, search = { find: "", replace: "" }): MaintenancePlan {
  if (!state.trees.some(tree => tree.id === treeId)) throw new Error("Select an existing tree first.");
  if (!MAINTENANCE_ACTIONS.includes(action)) throw new Error("Choose a maintenance operation.");
  if (action === "Search and replace" && !search.find) throw new Error("Enter the text to find.");
  const next = structuredClone(state);
  const changes: MaintenanceChange[] = [];
  const notices: string[] = [];
  const people = next.people.filter(person => person.treeId === treeId);
  const families = next.families.filter(family => family.treeId === treeId);
  const eventIds = new Set([...people, ...families].flatMap(record => record.eventIds));
  const otherEventIds = new Set([...next.people, ...next.families].filter(record => record.treeId !== treeId).flatMap(record => record.eventIds));
  const events = next.events.filter(event => eventIds.has(event.id) && !otherEventIds.has(event.id));
  const setText = <T, K extends keyof T>(record: T, key: K, value: T[K], label: string) => {
    if (record[key] === value) return;
    changes.push({ record: label, field: String(key), before: String(record[key]), after: String(value) });
    record[key] = value;
  };
  if (action === "Normalize dates") {
    people.forEach(person => {
      setText(person, "birthDate", normalizeDate(person.birthDate), fullName(person));
      setText(person, "deathDate", normalizeDate(person.deathDate), fullName(person));
      person.facts.forEach(fact => { if (fact.date) setText(fact, "date", normalizeDate(fact.date), `${fullName(person)}: ${fact.type}`); });
    });
    events.forEach(event => setText(event, "date", normalizeDate(event.date), event.type));
    next.relationships.filter(rel => rel.treeId === treeId).forEach(rel => {
      if (rel.startDate) setText(rel, "startDate", normalizeDate(rel.startDate), rel.type);
      if (rel.endDate) setText(rel, "endDate", normalizeDate(rel.endDate), rel.type);
    });
    notices.push("Only valid year-first numeric dates are normalized. Ambiguous, qualified and invalid dates are preserved.");
    if ([...eventIds].some(id => otherEventIds.has(id))) notices.push("Events shared with another tree were left unchanged.");
  }
  if (action === "Reformat names") {
    const format = (value: string) => value.trim().replace(/\s+/gu, " ");
    people.forEach(person => {
      setText(person, "givenName", format(person.givenName), fullName(person));
      setText(person, "familyName", format(person.familyName), fullName(person));
    });
    notices.push("Extra spacing is removed. Capitalization and cultural name forms are preserved.");
  }
  if (action === "Remove empty entries") {
    const referenced = new Set([
      ...next.relationships.flatMap(rel => [rel.fromId, rel.toId]),
      ...next.families.flatMap(family => [...family.partnerIds, ...family.childIds]),
      ...next.media.flatMap(media => media.assignedTo.filter(link => link.kind === "person").map(link => link.id)),
      ...[...next.todos, ...next.records, ...next.dnaMatches, ...next.reportDrafts].flatMap(record => record.personId ? [record.personId] : [])
    ]);
    const removable = new Set(people.filter(person => !hasPersonData(person) && !referenced.has(person.id)).map(person => person.id));
    next.people = next.people.filter(person => {
      if (!removable.has(person.id)) return true;
      changes.push({ record: person.id, field: "person", before: "Empty, unreferenced person", after: "Removed" });
      return false;
    });
    notices.push("Only completely empty, unreferenced people are removed. Linked people and events are preserved.");
  }
  if (action === "Repair family links") {
    const ids = new Set(people.map(person => person.id));
    families.forEach(family => {
      for (const field of ["partnerIds", "childIds"] as const) {
        const cleaned = [...new Set(family[field].filter(id => ids.has(id)))];
        if (JSON.stringify(cleaned) !== JSON.stringify(family[field])) {
          changes.push({ record: family.name, field, before: family[field].join(", "), after: cleaned.join(", ") });
          family[field] = cleaned;
        }
      }
    });
    notices.push("Missing, repeated and cross-tree member references are removed. Parentage and partner roles are not inferred.");
  }
  if (action === "Clean media tags") {
    next.media.filter(media => media.treeId === treeId).forEach(media => {
      const cleaned = [...new Set(media.tags.map(tag => tag.trim()).filter(Boolean))];
      if (JSON.stringify(cleaned) !== JSON.stringify(media.tags)) {
        changes.push({ record: media.title, field: "tags", before: JSON.stringify(media.tags), after: JSON.stringify(cleaned) });
        media.tags = cleaned;
      }
    });
  }
  if (action === "Search and replace") {
    const pattern = new RegExp(search.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
    const replace = <T, K extends keyof T>(record: T, key: K, label: string) => {
      if (typeof record[key] === "string") setText(record, key, (record[key] as string).replace(pattern, () => search.replace) as T[K], label);
    };
    people.forEach(person => { replace(person, "biography", fullName(person)); replace(person, "notes", fullName(person)); });
    next.sources.filter(source => source.treeId === treeId).forEach(source => { replace(source, "title", source.title); replace(source, "notes", source.title); });
    next.places.filter(place => place.treeId === treeId).forEach(place => { replace(place, "name", place.name); replace(place, "notes", place.name); });
    notices.push("Literal, case-insensitive search in person biographies and notes, source titles and notes, and place names and notes.");
  }
  return { next, changes, notices };
}

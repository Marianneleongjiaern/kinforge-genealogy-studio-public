import { AppState, Person, fullName } from "./domain";
import type { ReportOptions } from "./reportOptions";
import { ageInterval, compareDates, inDateRange, lifetimeOverlap } from "./reportDates";
export { dateParts, ageOn } from "./reportDates";

export function reportThreshold(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function distinctivePatterns(state: AppState, thresholds: ReportOptions["thresholds"] = {}) {
  const rows: string[] = [];
  const many = reportThreshold(thresholds.manyChildren, 4), old = reportThreshold(thresholds.maxLifespan, 80), early = reportThreshold(thresholds.earlyDeath, 10);
  const marriageMin = reportThreshold(thresholds.minMarriageAge, 18), marriageMax = reportThreshold(thresholds.maxMarriageAge, 40);
  const parentMin = reportThreshold(thresholds.minParentAge, 18), parentMax = reportThreshold(thresholds.maxParentAge, 40);
  const ageText = (age: { min: number; max: number }) => age.min === age.max ? String(age.min) : `${age.min}-${age.max} (date interval)`;
  for (const person of state.people) {
    const name = fullName(person);
    const children = state.people.filter(p => state.relationships.some(r => r.type === "parent-child" && r.fromId === person.id && r.toId === p.id));
    if (person.gender === "female" && children.length > many) rows.push(`${name}: ${children.length} recorded children (more than ${many}).`);
    const age = ageInterval(person.birthDate, person.deathDate);
    if (age && age.min > old) rows.push(`${name}: died aged ${ageText(age)} (over ${old}).`);
    if (age && age.max < early) rows.push(`${name}: died aged ${ageText(age)} (${early === 10 ? "before their 10th birthday" : `before age ${early}`}).`);
    const dates = new Set(state.relationships.filter(r => r.type === "spouse" && [r.fromId, r.toId].includes(person.id)).map(r => r.startDate || ""));
    state.events.filter(e => /marriage/i.test(e.type) && (person.eventIds.includes(e.id) || state.families.some(f => f.partnerIds.includes(person.id) && f.eventIds.includes(e.id)))).forEach(e => dates.add(e.date));
    for (const date of dates) {
      const age = ageInterval(person.birthDate, date);
      if (age && (age.max < marriageMin || age.min > marriageMax)) rows.push(`${name}: marriage on ${date}, aged ${ageText(age)} (${age.max < marriageMin ? `before ${marriageMin}` : `over ${marriageMax}`}).`);
    }
    for (const child of children) {
      const age = ageInterval(person.birthDate, child.birthDate);
      if (age && (age.max < parentMin || age.min > parentMax)) rows.push(`${name}: ${fullName(child)} was born when they were ${ageText(age)} (${age.max < parentMin ? `before ${parentMin}` : `over ${parentMax}`}). This describes a recorded parent link, not an assertion of biological parentage.`);
    }
  }
  return rows;
}

export function lifeEvents(state: AppState, person: Person, scope: boolean | NonNullable<ReportOptions["eventScope"]>, options: ReportOptions = {}) {
  const selected = typeof scope === "boolean" ? scope ? "all-relatives" : "person" : scope;
  const includeFamily = selected !== "person";
  const ids = new Set([person.id]);
  if (includeFamily) {
    const pending = [person.id];
    while (pending.length) {
      const current = pending.shift()!;
      for (const rel of state.relationships.filter(r => r.fromId === current || r.toId === current)) {
        const id = rel.fromId === current ? rel.toId : rel.fromId;
        if (!state.people.some(p => p.id === id)) continue;
        if (!ids.has(id)) { ids.add(id); if (selected === "all-relatives") pending.push(id); }
      }
      for (const family of state.families.filter(f => [...f.partnerIds, ...f.childIds].includes(current))) for (const id of [...family.partnerIds, ...family.childIds]) {
        if (!ids.has(id) && state.people.some(p => p.id === id)) { ids.add(id); if (selected === "all-relatives") pending.push(id); }
      }
    }
  }
  const eventIds = new Set([...state.people.filter(p => ids.has(p.id)).flatMap(p => p.eventIds), ...state.families.filter(f => [...f.partnerIds, ...f.childIds].some(id => ids.has(id))).flatMap(f => f.eventIds)]);
  const own = new Set([...person.eventIds, ...state.families.filter(f => f.partnerIds.includes(person.id)).flatMap(f => f.eventIds)]);
  const end = person.living ? localToday() : person.deathDate;
  return state.events.filter(e => (!e.private || options.includePrivate) && (own.has(e.id) || includeFamily && eventIds.has(e.id) && ["within", "possible"].includes(lifetimeOverlap(person.birthDate, end, e.date))) && eventMatches(e, options)).sort((a, b) => compareDates(a.date, b.date));
}

export const eventMatches = (event: AppState["events"][number], options: ReportOptions) =>
  (options.eventTypes === undefined || options.eventTypes.some(type => type.toLowerCase() === event.type.toLowerCase())) && inDateRange(event.date, options.dateFrom, options.dateTo);

export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

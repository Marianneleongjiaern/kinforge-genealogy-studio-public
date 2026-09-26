import { calendarDateInterval } from "./reportCalendarDates";

/** Inclusive Gregorian date bounds. Unknown precision is never replaced by a birthday. */
export type DateInterval = { earliest: number; latest: number; precision: "day" | "month" | "year" | "range" };
const DAY = 86400000;
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const utc = (year: number, month: number, day: number) => {
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0); return date.getTime();
};

export function dateInterval(raw: string): DateInterval | undefined {
  const value = raw.trim().toUpperCase();
  const range = /^(?:BET (.+) AND (.+)|FROM (.+) TO (.+))$/.exec(value);
  if (range) {
    const from = dateInterval(range[1] || range[3]), to = dateInterval(range[2] || range[4]);
    return from && to && from.earliest <= to.latest ? { earliest: from.earliest, latest: to.latest, precision: "range" } : undefined;
  }
  const bound = /^(BEF|AFT) (.+)$/.exec(value);
  if (bound) {
    const date = dateInterval(bound[2]);
    return date ? { earliest: bound[1] === "BEF" ? -Infinity : date.latest + DAY, latest: bound[1] === "BEF" ? date.earliest - DAY : Infinity, precision: "range" } : undefined;
  }
  if (value.startsWith("@#DGREGORIAN@")) return dateInterval(value.slice("@#DGREGORIAN@".length).trim());
  if (value.startsWith("@#D")) return calendarDateInterval(value);
  const gedcom = /^(?:(\d{1,2}) )?([A-Z]{3}) (\d{4})$/.exec(value);
  const normalized = gedcom && months.includes(gedcom[2]) ? `${gedcom[3]}-${String(months.indexOf(gedcom[2]) + 1).padStart(2, "0")}${gedcom[1] ? `-${gedcom[1].padStart(2, "0")}` : ""}` : value;
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(normalized)) return;
  const parts = normalized.split("-").map(Number), [year, month = 1, day = 1] = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return;
  const earliest = utc(year, month, day), check = new Date(earliest);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return;
  const latest = parts.length === 1 ? utc(year + 1, 1, 1) - DAY : parts.length === 2 ? utc(year, month + 1, 1) - DAY : earliest;
  return { earliest, latest, precision: parts.length === 1 ? "year" : parts.length === 2 ? "month" : "day" };
}

export function dateParts(value: string) {
  const date = dateInterval(value);
  if (!date || date.precision !== "day") return;
  const d = new Date(date.earliest);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const completedYears = (birth: number, at: number) => {
  const b = new Date(birth), d = new Date(at);
  return d.getUTCFullYear() - b.getUTCFullYear() - (d.getUTCMonth() < b.getUTCMonth() || d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate() ? 1 : 0);
};

export function ageInterval(birth: string, at: string) {
  const b = dateInterval(birth), d = dateInterval(at);
  if (!b || !d || ![b.earliest, b.latest, d.earliest, d.latest].every(Number.isFinite) || d.latest < b.earliest) return;
  return { min: Math.max(0, completedYears(b.latest, d.earliest)), max: completedYears(b.earliest, d.latest) };
}

export function ageOn(birth: string, at: string) {
  return dateParts(birth) && dateParts(at) ? ageInterval(birth, at)?.min : undefined;
}

export function inDateRange(value: string, from?: string, to?: string) {
  if (!from && !to) return true;
  const date = dateInterval(value), lower = from ? dateInterval(from) : undefined, upper = to ? dateInterval(to) : undefined;
  if (!date || from && !lower || to && !upper) return false;
  return (lower?.earliest ?? -Infinity) <= (upper?.latest ?? Infinity) && date.latest >= (lower?.earliest ?? -Infinity) && date.earliest <= (upper?.latest ?? Infinity);
}

export function compareDates(a: string, b: string) {
  const left = dateInterval(a), right = dateInterval(b);
  if (!left || !right) return left ? -1 : right ? 1 : a.localeCompare(b);
  return left.earliest === right.earliest ? (left.latest === right.latest ? 0 : left.latest < right.latest ? -1 : 1) : left.earliest < right.earliest ? -1 : 1;
}

export function lifetimeOverlap(birth: string, death: string, date: string): "within" | "possible" | "outside" | "unknown" {
  const b = dateInterval(birth), d = dateInterval(death), e = dateInterval(date);
  if (!b || !d || !e || ![b.earliest, d.latest, e.earliest, e.latest].every(Number.isFinite) || b.earliest > d.latest) return "unknown";
  if (e.latest < b.earliest || e.earliest > d.latest) return "outside";
  return e.earliest >= b.latest && e.latest <= d.earliest ? "within" : "possible";
}

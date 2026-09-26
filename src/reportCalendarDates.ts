import { JulianCalendar } from "calendariale/dist/calendar/JulianCalendar.js";
import { HebrewCalendar } from "calendariale/dist/calendar/HebrewCalendar.js";
import { FrenchRevolutionaryCalendar } from "calendariale/dist/calendar/FrenchRevolutionaryCalendar.js";
import { IslamicCalendar } from "calendariale/dist/calendar/IslamicCalendar.js";

const DAY = 86400000;
const romanMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const frenchMonths = ["VEND", "BRUM", "FRIM", "NIVO", "PLUV", "VENT", "GERM", "FLOR", "PRAI", "MESS", "THER", "FRUC", "COMP"];
const hebrewMonths: Record<string, number> = { NSN: 1, IYR: 2, SVN: 3, TMZ: 4, AAV: 5, ELL: 6, TSH: 7, CSH: 8, KSL: 9, TVT: 10, SHV: 11, ADR: 12, ADS: 13 };
const islamicMonths = ["MUH", "SAF", "RA1", "RA2", "JU1", "JU2", "RAJ", "SHA", "RAM", "SHW", "DQD", "DHJ"];

/** Explicit calendar escapes only. Conversion never replaces the user's original date text. */
export function calendarDateInterval(raw: string): { earliest: number; latest: number; precision: "day" | "month" | "year" } | undefined {
  const escaped = /^@#D(JULIAN|HEBREW|FRENCH R|ISLAMIC)@\s+(.+)$/i.exec(raw.trim());
  if (!escaped) return;
  const [, calendar, dateText] = escaped.map(s => s.toUpperCase());
  const iso = /^(\d{1,4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(dateText);
  const named = /^(?:(\d{1,2})\s+)?([A-Z0-9]{3,4})\s+(\d{1,4})$/.exec(dateText);
  if (!iso && !named) return;
  const year = Number(iso?.[1] || named?.[3]);
  if (year < 1 || year > 9999) return;
  // The astronomical French calendar is restricted to its original historical years.
  if (calendar === "FRENCH R" && year > 14) return;
  const monthName = named?.[2];
  const month = iso?.[2] ? Number(iso[2]) : monthName ? calendar === "HEBREW" ? hebrewMonths[monthName] : (calendar === "FRENCH R" ? frenchMonths : calendar === "ISLAMIC" ? islamicMonths : romanMonths).indexOf(monthName) + 1 : undefined;
  const day = iso?.[3] ? Number(iso[3]) : named?.[1] ? Number(named[1]) : undefined;
  if (month !== undefined && (!month || month < 1 || month > 13) || day !== undefined && (day < 1 || day > 31)) return;
  const toJdn = (y: number, m: number, d: number) => calendar === "JULIAN" ? JulianCalendar.toJdn(y, m, d)
    : calendar === "HEBREW" ? HebrewCalendar.toJdn(y, m, d)
    : calendar === "ISLAMIC" ? IslamicCalendar.toJdn(y, m, d)
    : FrenchRevolutionaryCalendar.toJdn(y, m, Math.floor((d - 1) / 10) + 1, (d - 1) % 10 + 1);
  const timestamp = (y: number, m: number, d: number) => {
    try { const value = Math.round((toJdn(y, m, d) - 2440587.5) * DAY); return Number.isFinite(value) ? value : undefined; }
    catch { return undefined; }
  };
  const firstMonth = calendar === "HEBREW" ? 7 : 1;
  const earliest = timestamp(year, month ?? firstMonth, day ?? 1);
  if (earliest === undefined) return;
  if (day !== undefined) return { earliest, latest: earliest, precision: "day" };
  if (month === undefined) {
    const next = timestamp(year + 1, firstMonth, 1);
    return next !== undefined ? { earliest, latest: next - DAY, precision: "year" } : undefined;
  }
  for (let lastDay = 31; lastDay >= 1; lastDay--) {
    const latest = timestamp(year, month, lastDay);
    if (latest !== undefined) return { earliest, latest, precision: "month" };
  }
}

import { describe, expect, it } from "vitest";
import { calendarDateInterval } from "./reportCalendarDates";

const iso = (value: number | undefined) => value === undefined ? undefined : new Date(value).toISOString().slice(0, 10);
describe("Explicit alternate-calendar report dates", () => {
  it.each([
    ["@#DJULIAN@ 4 OCT 1582", "1582-10-14"],
    ["@#DJULIAN@ 1900-02-29", "1900-03-13"],
    ["@#DHEBREW@ 1 TSH 5784", "2023-09-16"],
    ["@#DFRENCH R@ 1 VEND 1", "1792-09-22"],
    ["@#DISLAMIC@ 1 MUH 1445", "2023-07-19"]
  ])("converts %s without a service call", (input, expected) => {
    const interval = calendarDateInterval(input);
    expect(interval?.precision).toBe("day");
    expect(iso(interval?.earliest)).toBe(expected);
    expect(interval?.latest).toBe(interval?.earliest);
  });
  it("preserves month and year uncertainty, including the Hebrew civil-year boundary", () => {
    const month = calendarDateInterval("@#DJULIAN@ FEB 1900");
    expect(month?.precision).toBe("month");
    expect(iso(month?.earliest)).toBe("1900-02-13");
    expect(iso(month?.latest)).toBe("1900-03-13");
    const year = calendarDateInterval("@#DHEBREW@ 5784");
    expect(year?.precision).toBe("year");
    expect(iso(year?.earliest)).toBe("2023-09-16");
    expect(iso(year?.latest)).toBe("2024-10-02");
  });
  it.each(["@#DUNKNOWN@ 1900", "@#DJULIAN@ 1900-02-30", "@#DHEBREW@ 5783-13-01", "@#DFRENCH R@ 200", "@#DISLAMIC@ 1445-14-01", "@#DJULIAN@ 0", "1582-10-14"])("does not guess invalid or untagged input %s", input => {
    expect(calendarDateInterval(input)).toBeUndefined();
  });
});

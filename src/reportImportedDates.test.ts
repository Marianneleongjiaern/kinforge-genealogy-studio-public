import { describe, expect, it } from "vitest";
import { normalizeGedcomDate } from "./gedcom";

describe("Report dates preserved during import", () => {
  it.each(["1988-06-12", "1988-06", "ABT 1900", "BEF 1900", "BET 1900 AND 1905", "@#DJULIAN@ 4 OCT 1582", "@#DHEBREW@ 1 TSH 5784", "invalid JAN 1900 text", "1 XYZ 1900"])("retains %s without losing uncertainty or calendar", date => {
    expect(normalizeGedcomDate(date)).toBe(date);
  });
  it("still normalizes ordinary month names", () => {
    expect(normalizeGedcomDate("12 JUN 1988")).toBe("1988-06-12");
    expect(normalizeGedcomDate("JUN 1988")).toBe("1988-06");
  });
});

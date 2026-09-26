import { describe, expect, it } from "vitest";
import catalog from "./requirements.generated.json";

describe("Independent feature scope", () => {
  it("retains the original specification and every generated document family", () => {
    const paths = catalog.sources.map(s => s.path);
    for (const required of ["Ideas.md (original attachment)", "MacFamilyTree-Feature-Walkthrough.md", "MacFamilyTree-Feature-Coverage.md", "MacFamilyTree-Symbol-Reference.md", "KinForge-Glyph-System.md", "KinForge-Disability-Glyphs.md", "KinForge-Independent-Feature-Contract.md", "MacFamilyTree-Complex-Test-Tree/Exploration-Guide.md", "kinforge-sites/INTERFACE_UPDATES.md", "kinforge-sites/RESEARCH.md", "kinforge-sites/COMPETITOR_SWOT.md"]) expect(paths).toContain(required);
    expect(new Set(catalog.entries.map(e => e.id)).size).toBe(catalog.entries.length);
  });
  it("preserves difficult requirements rather than excluding their underlying capabilities", () => {
    const content = catalog.entries.map(e => e.text).join("\n");
    for (const term of ["FamilySearch", "Ordinance", "Colorize", "handwritten", "Chromosome", "protective services", "cerebral palsy", "backup", "DMG", "annulment"]) expect(content.toLowerCase()).toContain(term.toLowerCase());
    expect(catalog.entries.every(e => e.delivery === "built-in" && e.status === "unverified")).toBe(true);
  });
  it("indexes references as evidence, not automatic completion claims", () => {
    expect(catalog.entries.some(e => e.kind === "original-scope")).toBe(true);
    expect(catalog.entries.some(e => e.kind === "supplemental-reference")).toBe(true);
    expect(catalog.sources.every(s => /^[0-9a-f]{64}$/.test(s.sha256))).toBe(true);
  });
});

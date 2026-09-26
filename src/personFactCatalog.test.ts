import { describe, expect, it } from "vitest";
import { BELIEF_OPTIONS, catalogForFactType, isSensitiveFactType, MENTAL_HEALTH_OPTIONS, MENTAL_HEALTH_SUPPORT_OPTIONS, RELIGION_OPTIONS, RELIGIOUS_PRACTICE_OPTIONS } from "./personFactCatalog";

describe("person fact catalogs", () => {
  it("offers explained religion, belief, condition, and support choices", () => {
    for (const entry of [...RELIGION_OPTIONS, ...RELIGIOUS_PRACTICE_OPTIONS, ...BELIEF_OPTIONS, ...MENTAL_HEALTH_OPTIONS, ...MENTAL_HEALTH_SUPPORT_OPTIONS]) {
      expect(entry.label.trim()).not.toBe("");
      expect(entry.meaning.length, entry.label).toBeGreaterThan(30);
    }
  });

  it("includes Latter-day Saint and keeps sensitive fact types owner-private by policy", () => {
    expect(RELIGION_OPTIONS.some(entry => entry.label === "Latter-day Saint")).toBe(true);
    expect(catalogForFactType("Religion")).toBe(RELIGION_OPTIONS);
    expect(catalogForFactType("Religious practice")).toBe(RELIGIOUS_PRACTICE_OPTIONS);
    expect(catalogForFactType("Mental health condition")).toBe(MENTAL_HEALTH_OPTIONS);
    expect(isSensitiveFactType("Religion")).toBe(true);
    expect(isSensitiveFactType("Belief")).toBe(true);
    expect(isSensitiveFactType("Mental health condition")).toBe(true);
    expect(isSensitiveFactType("Occupation")).toBe(false);
  });

  it("does not use the catalog to imply a diagnosis", () => {
    expect(MENTAL_HEALTH_OPTIONS.find(entry => entry.label === "Autism spectrum disorder (ASD)")?.meaning).toMatch(/recorded|support needs/i);
    expect(MENTAL_HEALTH_OPTIONS.find(entry => entry.label === "Schizophrenia")?.meaning).toMatch(/source|self-description/i);
  });
});

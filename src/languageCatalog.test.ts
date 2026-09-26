import { describe, expect, it } from "vitest";
import { LANGUAGES, languageLabel } from "./languageCatalog";
import { WORKSPACE_VIEWS } from "./workspace";

describe("world language catalog and translator workspace", () => {
  it("offers a 7,000+ language catalog with requested Asian and custom language entries", () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(7000);
    expect(languageLabel("ms")).toContain("Bahasa Melayu");
    expect(languageLabel("id")).toContain("Bahasa Indonesia");
    expect(languageLabel("ja")).toContain("Japanese");
    expect(languageLabel("ko")).toContain("Korean");
    expect(languageLabel("zh-Hans")).toContain("Chinese, Simplified");
    expect(languageLabel("art")).toMatch(/Artificial|Constructed/);
  });

  it("keeps Translator AI as a first-class workspace page", () => {
    expect(WORKSPACE_VIEWS).toContain("translator-ai");
  });
});

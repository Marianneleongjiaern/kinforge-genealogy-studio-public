import { describe, expect, it } from "vitest";
import { createEmptyPerson, createSeedState, fullName } from "./domain";
import { NARRATIVE_LANGUAGES, narrativeSections, narrativeTerm } from "./reportNarrative";
import type { NarrativeLocale, NarrativeSection } from "./reportNarrative";
import { EXTRA_NARRATIVE_LOCALES } from "./reportNarrativeLocales";

const languages = ["da", "fi", "it", "nl", "pt-BR", "ru", "sv", "hu", "pl", "nb", "cs"] as const;
const terms = [
  "birth", "death", "marriage", "divorce", "burial", "cremation", "residence", "baptism", "occupation",
  "biological", "adoptive", "foster", "step", "unspecified", "married", "divorced", "separated", "annulled", "widowed"
];
type Token = "person" | "date" | "parents" | "type" | "place" | "other" | "children";
type Phrase = Exclude<keyof NarrativeLocale, "terms">;
const tokens: Record<Phrase, Token[]> = {
  birthOn: ["person", "date"], birthIn: ["person", "date"], birthMissing: ["person"],
  parents: ["parents"], parentsMissing: [], living: [], deathOn: ["date"], deathIn: ["date"], deathMissing: [],
  eventDated: ["date", "type"], eventUndated: ["type"], place: ["place"],
  marriage: ["person", "other"], partnership: ["person", "other"],
  unionStart: ["date"], unionEnd: ["date"], children: ["children"], notesMissing: [], none: []
};
const fragments: Phrase[] = ["eventDated", "eventUndated", "place", "marriage", "partnership", "unionStart", "unionEnd"];
const values: Record<Token, string> = {
  person: "Éden 李", date: "BET 1901 AND 1904", parents: "Renée Nguyễn, Саша Иванова",
  type: "Custom Event", place: "Łódź / 東京", other: "Noor O’Neill", children: "Zoë 李, Mika 李"
};

function fill(template: string, replacements: Partial<Record<Token, string>>) {
  return template.replace(/\{(\w+)\}/g, (_, token: Token) => {
    const value = replacements[token];
    if (value === undefined) throw new Error(`Missing test value for ${token}`);
    return value;
  });
}

function fixture() {
  const state = createSeedState();
  const person = {
    ...createEmptyPerson("tree_demo"), id: "subject", givenName: "Éden", familyName: "李",
    gender: "unknown" as const, living: false, private: false
  };
  state.people = [person];
  state.relationships = [];
  state.families = [];
  state.events = [];
  state.places = [];
  return { state, person };
}

function paragraphs(sections: NarrativeSection[], title: string) {
  const section = sections.find(item => item.title === title);
  expect(section, title).toBeDefined();
  return section!.paragraphs;
}

describe("Additional generated narrative locales", () => {
  it("provides exactly the eleven assigned dictionaries", () => {
    expect(Object.keys(EXTRA_NARRATIVE_LOCALES).sort()).toEqual([...languages].sort());
  });

  describe.each(languages)("%s", language => {
    const locale = EXTRA_NARRATIVE_LOCALES[language];

    it("contains every term, phrase and exact placeholder without extra tokens", () => {
      expect(Object.keys(locale).sort()).toEqual(["terms", ...Object.keys(tokens)].sort());
      expect(Object.keys(locale.terms).sort()).toEqual([...terms].sort());
      for (const term of Object.values(locale.terms)) {
        expect(term.trim()).toBe(term);
        expect(term.length).toBeGreaterThan(0);
        expect(term).not.toMatch(/[{}\d]/);
      }
      for (const key of Object.keys(tokens) as Phrase[]) {
        const template = locale[key];
        expect(template.trim(), key).toBe(template);
        expect(template.length, key).toBeGreaterThan(0);
        const placeholders = [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
        expect(placeholders.sort(), key).toEqual([...tokens[key]].sort());
        expect(template.replace(/\{\w+\}/g, ""), key).not.toMatch(/[{}\d]/);
        if (fragments.includes(key)) expect(template, key).not.toMatch(/[.!?]$/);
        else expect(template, key).toMatch(/\.$/);
        const rendered = fill(template, values);
        for (const token of tokens[key]) expect(rendered, `${key}: ${token}`).toContain(values[token]);
        expect(rendered, key).not.toMatch(/\{\w+\}/);
      }
    });

    it("is available to the real narrative assembler and translates all supported terms", () => {
      expect(NARRATIVE_LANGUAGES).toContain(language);
      for (const term of terms) expect(narrativeTerm(term.toUpperCase(), language)).toBe(locale.terms[term]);
      expect(narrativeTerm("Custom Événement", language)).toBe("Custom Événement");
    });

    it("reports absent records without inventing life events, relatives or a living status", () => {
      const { state, person } = fixture();
      const before = JSON.stringify(state);
      const sections = narrativeSections(state, person, { language });
      expect(paragraphs(sections, "Life narrative")).toEqual([
        `${fill(locale.birthMissing, { person: fullName(person) })} ${locale.parentsMissing} ${locale.deathMissing}`
      ]);
      for (const title of ["Life events", "Relationships", "Recorded facts", "Biography"])
        expect(paragraphs(sections, title)).toEqual([]);
      expect(paragraphs(sections, "Research notes")).toEqual([locale.notesMissing]);
      expect(JSON.stringify(sections)).not.toMatch(/\d|\{\w+\}|undefined/);
      expect(JSON.stringify(state)).toBe(before);
    });

    it("preserves precise, partial and uncertain birth and death dates without adding precision", () => {
      const cases: { birth: string; death: string; birthKey: Phrase; deathKey: Phrase }[] = [
        { birth: "1901-02-03", death: "1975-08-09", birthKey: "birthOn", deathKey: "deathOn" },
        { birth: "1901", death: "1975", birthKey: "birthIn", deathKey: "deathIn" },
        { birth: "1901-02", death: "1975-08", birthKey: "birthIn", deathKey: "deathIn" },
        { birth: "ABT 1901", death: "BET 1975 AND 1979", birthKey: "birthIn", deathKey: "deathIn" }
      ];
      for (const sample of cases) {
        const { state, person } = fixture();
        person.birthDate = sample.birth;
        person.deathDate = sample.death;
        const sections = narrativeSections(state, person, { language });
        expect(paragraphs(sections, "Life narrative")).toEqual([
          `${fill(locale[sample.birthKey], { person: fullName(person), date: sample.birth })} ${locale.parentsMissing} ${fill(locale[sample.deathKey], { date: sample.death })}`
        ]);
        expect(paragraphs(sections, "Life events")).toEqual([]);
      }
    });

    it("uses the recorded living flag with the same neutral phrases for every gender", () => {
      const { state, person } = fixture();
      person.living = true;
      const expected = [
        `${fill(locale.birthMissing, { person: fullName(person) })} ${locale.parentsMissing} ${locale.living}`
      ];
      for (const gender of ["unknown", "nonbinary", "female", "male"] as const) {
        const sections = narrativeSections(state, { ...person, gender }, { language });
        expect(paragraphs(sections, "Life narrative")).toEqual(expected);
      }
    });

    it("preserves recorded names, places, dates, notes, custom events and relationship meanings", () => {
      const { state, person } = fixture();
      const relative = (id: string, givenName: string) => ({
        ...createEmptyPerson(person.treeId), id, givenName, familyName: "", private: false
      });
      const parent = relative("parent", "Renée Nguyễn"), other = relative("spouse", "Noor O’Neill");
      const partner = relative("partner", "Саша Иванова"), child = relative("child", "Zoë 李");
      state.people.push(parent, other, partner, child);
      state.relationships = [
        { id: "parent-link", treeId: person.treeId, type: "parent-child", fromId: parent.id, toId: person.id, sourceIds: [] },
        { id: "child-link", treeId: person.treeId, type: "parent-child", fromId: person.id, toId: child.id, parentage: "adoptive", sourceIds: [] },
        { id: "marriage", treeId: person.treeId, type: "spouse", fromId: person.id, toId: other.id, startDate: "1925-04-05", endDate: "1930", status: "divorced", sourceIds: [] },
        { id: "partnership", treeId: person.treeId, type: "partner", fromId: partner.id, toId: person.id, sourceIds: [] }
      ];
      state.places = [{
        id: "place", treeId: person.treeId, name: "Łódź / 東京", templateId: "", address: "", levels: {},
        latitude: "", longitude: "", pointsOfInterest: "", wikipediaTitle: "", mediaIds: [], sourceIds: [], notes: ""
      }];
      person.eventIds = ["dated", "undated"];
      state.events = [
        { id: "dated", type: "Residence", date: "1912-03", placeId: "place", description: "Texte original conservé.", sourceIds: [], mediaIds: [] },
        { id: "undated", type: "Custom Événement", date: "", description: "", sourceIds: [], mediaIds: [] }
      ];
      person.biography = "Original biography: Жизнь / 人生.";
      person.notes = "Original notes: date unconfirmed; {date} is literal text.";
      person.facts = [{ id: "fact", type: "Occupation", value: "Luthier / 弦楽器職人", sourceIds: [] }];
      const before = JSON.stringify(state);
      const sections = narrativeSections(state, person, { language });
      const life = paragraphs(sections, "Life narrative").join(" ");
      expect(life).toContain(fill(locale.parents, { parents: `${fullName(parent)} (${locale.terms.unspecified})` }));
      expect(life).not.toContain(locale.terms.biological);
      expect(paragraphs(sections, "Life events")).toEqual(expect.arrayContaining([
        `${fill(locale.eventDated, { date: "1912-03", type: locale.terms.residence })}${fill(locale.place, { place: "Łódź / 東京" })}. Texte original conservé.`,
        `${fill(locale.eventUndated, { type: "Custom Événement" })}.`
      ]));
      expect(paragraphs(sections, "Life events")).toHaveLength(2);
      expect(paragraphs(sections, "Relationships")).toEqual([
        `${fill(locale.marriage, { person: fullName(person), other: fullName(other) })}${fill(locale.unionStart, { date: "1925-04-05" })} (${locale.terms.divorced})${fill(locale.unionEnd, { date: "1930" })}.`,
        `${fill(locale.partnership, { person: fullName(person), other: fullName(partner) })}.`,
        fill(locale.children, { children: fullName(child) })
      ]);
      expect(paragraphs(sections, "Recorded facts")).toEqual([`${locale.terms.occupation}: Luthier / 弦楽器職人.`]);
      expect(paragraphs(sections, "Biography")).toEqual([person.biography]);
      expect(paragraphs(sections, "Research notes")).toEqual([person.notes]);
      const generated = sections.filter(section => !["Biography", "Research notes"].includes(section.title)).flatMap(section => section.paragraphs).join(" ");
      expect(generated).not.toMatch(/\{\w+\}|undefined|\.\./);
      expect(JSON.stringify(state)).toBe(before);
    });
  });
});

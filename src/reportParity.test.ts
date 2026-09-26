import { describe, expect, it, vi } from "vitest";
import { createEmptyPerson, createSeedState } from "./domain";
import { buildCatalogReport } from "./reportCatalog";
import { buildReportDocument } from "./reportDocument";
import { ageOn, dateParts, distinctivePatterns, lifeEvents } from "./reportFacts";
import { runPlausibilityChecks } from "./analysis";
import { personSymbols } from "./personSymbols";
import { createPersonNeed } from "./glyphs";

const report = (type: string, state = createSeedState(), options = {}) => JSON.stringify(buildCatalogReport(state, "tree_demo", type, "person_june", options));
describe("MacFamilyTree report content comparison", () => {
  it("includes narrative, hourglass, all connected relatives and named explanations in a person report", () => {
    const doc = JSON.stringify(buildReportDocument(createSeedState(), "tree_demo", "Person Report", "person_june"));
    expect(doc).toContain("June Chang was born on 1988-06-12");
    expect(doc).toContain("Hourglass Chart"); expect(doc).toContain('"type":"reportChart"');
    expect(doc).toContain("Relationship to June Chang"); expect(doc).toContain("Symbols for Alex Chang");
  });
  it("includes a family diagram and citations, and narrates numbered ancestors", () => {
    const state = createSeedState();
    state.relationships.filter(r => r.toId === "person_june").forEach(r => { r.parentRole = r.fromId === "person_alex" ? "father" : "mother"; });
    expect(report("Family Report", state)).toContain("Family hourglass");
    expect(report("Family Report", state)).toContain("Family sources");
    expect(report("Family Report", state)).toContain("Family member biographies and facts");
    expect(report("Family Report", state)).toContain("June Chang biography");
    expect(report("Family Report", state)).toContain("DNA Kit");
    expect(report("Ahnentafel Report", state)).toContain("Alex Chang was born on 1958-04-18");
    expect(report("Descendancy Report", state)).toContain("No partners recorded");
    expect(report("Register Report", state, { includePrivate: true })).toContain("Generation 1");
  });
  it("shows place events and birth places, not only place counts", () => {
    expect(report("Places List")).toContain("Birth record created from a sample certificate");
    expect(report("Persons List")).toContain("Birth place: Singapore");
  });
  it("includes extended family events inside a life, excludes out-of-life and unrelated events", () => {
    const state = createSeedState(), june = state.people.find(p => p.id === "person_june")!;
    const alex = state.people.find(p => p.id === "person_alex")!;
    const outside = { ...createEmptyPerson("tree_demo"), id: "outsider", givenName: "Outside", private: false, eventIds: ["outside"] }; state.people.push(outside);
    for (const [id, date] of [["before", "1980-01-01"], ["during", "2000-01-01"], ["after", "2040-01-01"], ["outside", "2001-01-01"]]) state.events.push({ id, date, type: "Residence", description: id, sourceIds: [], mediaIds: [] });
    alex.eventIds.push("before", "during", "after");
    june.living = false; june.deathDate = "2020-01-01";
    const ids = lifeEvents(state, june, true).map(e => e.id);
    expect(ids).toContain("during"); expect(ids).not.toContain("before"); expect(ids).not.toContain("after"); expect(ids).not.toContain("outside");
    expect(lifeEvents(state, june, false).map(e => e.id)).not.toContain("during");
  });
  it("uses today month/day, not every annual event", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 12, 12));
    try { const doc = report("Today Report"); expect(doc).toContain("06-12"); expect(doc).toContain("June Chang: birthday"); expect(doc).not.toContain("Alex Chang: birthday"); } finally { vi.useRealTimers(); }
  });
  it("groups analysis by recorded value, with entry and distinct-person counts", () => {
    const state = createSeedState();
    state.people[0].facts.push({ id: "occupation1", type: "Occupation", value: "Baker", sourceIds: [] }, { id: "occupation2", type: "Occupation", value: "Baker", sourceIds: [] });
    state.people[1].facts.push({ id: "occupation3", type: "Occupation", value: "Baker", sourceIds: [] });
    expect(report("Person Analysis", state, { analysisType: "fact:Occupation" })).toContain("Occupation: Baker | 3 entries | 2 people");
    expect(report("Person Analysis", state, { analysisType: "event:Birth" })).toContain("Birth events grouped by recorded place");
  });
  it("validates exact dates and does not guess ages from partial or invalid dates", () => {
    expect(dateParts("2001-02-29")).toBeUndefined(); expect(dateParts("2000-02-29")).toBeDefined();
    expect(ageOn("2000", "2010-01-01")).toBeUndefined(); expect(ageOn("2000-06-12", "2018-06-11")).toBe(17); expect(ageOn("2000-06-12", "2018-06-12")).toBe(18);
  });
  it("uses the recorded distinctiveness rules without diagnosing people", () => {
    const state = createSeedState(); state.people[0].birthDate = "1900-01-01"; state.people[0].deathDate = "1982-01-01";
    expect(distinctivePatterns(state).join(" ")).toContain("died aged 82");
    state.people[0].deathDate = "1909-12-31";
    expect(distinctivePatterns(state).join(" ")).toContain("before their 10th birthday");
  });
  it("flags burial before death and delayed burial without claiming delayed burial is impossible", () => {
    const state = createSeedState(), person = state.people[0]; person.deathDate = "2000-01-02";
    person.eventIds.push("burial"); state.events.push({ id: "burial", type: "Burial", date: "2000-01-01", description: "", sourceIds: [], mediaIds: [] });
    expect(runPlausibilityChecks(state, "tree_demo").some(i => i.label === "Burial before death")).toBe(true);
    state.events.find(e => e.id === "burial")!.date = "2002-01-01";
    expect(runPlausibilityChecks(state, "tree_demo").some(i => i.label === "Burial long after death" && i.detail.includes("may be valid"))).toBe(true);
  });
});

describe("Symbols carry meanings and privacy through reports", () => {
  it("uses the same definitions and captions, never inferring a disability", () => {
    const state = createSeedState(), person = state.people[0];
    person.accessNeeds = [createPersonNeed("cerebral-palsy", "User-recorded detail", undefined, "Preferred wording"), createPersonNeed("captions", "Written transcript")];
    state.relationships.find(r => r.type === "spouse")!.status = "annulled";
    const publicSymbols = personSymbols(state, person);
    expect(publicSymbols.map(s => s.label)).toContain("Annulment"); expect(publicSymbols.map(s => s.glyphId)).not.toContain("cerebral-palsy");
    const privateSymbols = personSymbols(state, person, true);
    expect(privateSymbols.find(s => s.glyphId === "cerebral-palsy")).toMatchObject({ label: "Preferred wording", meaning: expect.stringContaining("Cerebral palsy (CP)") });
    expect(privateSymbols.find(s => s.glyphId === "captions")?.meaning).not.toContain("deafness");
  });
  it.each(["Person Report", "Kinship Report", "Genogram", "Hourglass Chart", "Sociogram", "Relationship Chart"])("labels symbols and respects private annotation scope in %s", type => {
    const state = createSeedState(); state.people[0].accessNeeds = [createPersonNeed("paralysis", "Sensitive detail")];
    const options = { comparisonId: "person_alex" };
    const hidden = JSON.stringify(buildReportDocument(state, "tree_demo", type, "person_june", options));
    const shown = JSON.stringify(buildReportDocument(state, "tree_demo", type, "person_june", { ...options, includePrivate: true }));
    expect(hidden).not.toContain("Sensitive detail"); expect(shown).toContain("Sensitive detail");
    expect(shown).toContain("A recorded paralysis entry"); expect(shown).toContain('"type":"reportGlyph"');
  });
  it("does not expose a private person's union partner through a symbol caption", () => {
    const state = createSeedState(); state.people[1].private = true; state.relationships.find(r => r.type === "spouse")!.status = "divorced";
    expect(JSON.stringify(personSymbols(state, state.people[0]))).not.toContain("Mei Tan");
  });
  it("labels explicit parentage and single-parent symbols on person cards without guessing roles", () => {
    const state = createSeedState();
    const child = state.people.find(p => p.id === "person_kai")!;
    const parent = state.people.find(p => p.id === "person_june")!;
    state.relationships.filter(r => r.type === "parent-child" && r.toId === child.id).forEach(r => r.parentage = r.fromId === parent.id ? "adoptive" : "unspecified");
    const parentSymbols = personSymbols(state, parent, true);
    const childSymbols = personSymbols(state, child, true);
    expect(parentSymbols.find(symbol => symbol.glyphId === "relationship-adopted")).toMatchObject({ detail: expect.stringContaining("Kai Chang") });
    expect(parentSymbols.find(symbol => symbol.glyphId === "single-mom")).toMatchObject({ detail: expect.stringContaining("Only one parent") });
    expect(childSymbols.find(symbol => symbol.glyphId === "relationship-adopted")).toMatchObject({ detail: expect.stringContaining("June Chang") });
  });
});

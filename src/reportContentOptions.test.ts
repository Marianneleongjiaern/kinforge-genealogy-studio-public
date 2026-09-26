import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { AppState, createEmptyPerson, createSeedState, MediaItem, Person, PersonEvent } from "./domain";
import { ahnentafel, buildCatalogReport, CATALOG_TYPES, reportScope } from "./reportCatalog";
import { ageInterval, compareDates, dateInterval, inDateRange, lifetimeOverlap } from "./reportDates";
import { distinctivePatterns, lifeEvents } from "./reportFacts";
import { narrativeSections, NARRATIVE_LANGUAGES, registerEntries } from "./reportNarrative";
import { reportColumns, reportSections } from "./reportSections";
import { runPlausibilityChecks } from "./analysis";
import type { ReportOptions } from "./reportOptions";

const tree = "tree_demo";
function fixture() {
  const state = createSeedState();
  state.people = []; state.relationships = []; state.families = []; state.events = [];
  state.todos = []; state.sources = []; state.media = []; state.records = []; state.changes = [];
  return state;
}
function person(state: AppState, id: string, birthDate = "1900-01-01", overrides: Partial<Person> = {}) {
  const value = { ...createEmptyPerson(tree), id, givenName: id, familyName: "Family", private: false, living: false, birthDate, deathDate: "1982-01-01", ...overrides };
  state.people.push(value); return value;
}
function parent(state: AppState, from: Person, to: Person, parentage?: "biological" | "adoptive") {
  state.relationships.push({ id: `${from.id}-${to.id}`, treeId: tree, type: "parent-child", fromId: from.id, toId: to.id, parentage, sourceIds: [] });
}
function event(state: AppState, owner: Person, id: string, date: string, type = "Residence", overrides: Partial<PersonEvent> = {}) {
  const value = { id, date, type, description: `${id} description`, sourceIds: [], mediaIds: [], ...overrides };
  state.events.push(value); owner.eventIds.push(id); return value;
}
function media(state: AppState, id: string, assignedTo: MediaItem["assignedTo"] = []) {
  state.media.push({ id, treeId: tree, title: id, type: "picture", dataUrl: "", externalUrl: "", assignedTo, tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "" });
}
const text = (node: JSONContent | undefined): string => node?.text || node?.content?.map(text).join("\n") || "";
const doc = (state: AppState, type: string, options: ReportOptions = {}, id = state.people[0]?.id) => buildCatalogReport(state, tree, type, id, options)!;
const headings = (document: JSONContent, level = 2) => document.content?.filter(n => n.type === "heading" && n.attrs?.level === level).map(text) || [];

describe("Report interval dates", () => {
  it("uses valid whole-year/month intervals without guessing exact ages", () => {
    expect(dateInterval("1900")).toMatchObject({ earliest: Date.UTC(1900, 0, 1), latest: Date.UTC(1900, 11, 31), precision: "year" });
    expect(dateInterval("2000-02")?.latest).toBe(Date.UTC(2000, 1, 29));
    expect(dateInterval("2001-02-29")).toBeUndefined();
    expect(dateInterval("0001-01-01")?.precision).toBe("day");
    expect(ageInterval("1900", "1910")).toEqual({ min: 9, max: 10 });
    expect(ageInterval("ABT 1900", "1910")).toBeUndefined();
    expect(compareDates("FEB 1900", "1900-03")).toBeLessThan(0);
  });
  it("handles explicit ranges, bounds, calendar tags and rejects unsupported calendars", () => {
    expect(dateInterval("BET 1900 AND 1902")).toMatchObject({ earliest: Date.UTC(1900, 0, 1), latest: Date.UTC(1902, 11, 31) });
    expect(dateInterval("FROM 1902 TO 1900")).toBeUndefined();
    expect(dateInterval("BEF 1900")?.latest).toBe(Date.UTC(1899, 11, 31));
    expect(dateInterval("AFT 1900")?.earliest).toBe(Date.UTC(1901, 0, 1));
    expect(dateInterval("@#DGREGORIAN@ 4 OCT 1582")?.earliest).toBe(Date.UTC(1582, 9, 4));
    expect(dateInterval("@#DJULIAN@ 4 OCT 1582")?.earliest).toBe(Date.UTC(1582, 9, 14));
    expect(dateInterval("@#DUNKNOWN@ 1900")).toBeUndefined();
  });
  it("includes filter overlaps and distinguishes uncertain lifetime boundaries", () => {
    expect(inDateRange("1900", "1900-06", "1900-07")).toBe(true);
    expect(inDateRange("", "1900")).toBe(false);
    expect(inDateRange("1900", "invalid")).toBe(false);
    expect(inDateRange("1900", "1901", "1899")).toBe(false);
    expect(lifetimeOverlap("1900", "1980", "1900-03")).toBe("possible");
    expect(lifetimeOverlap("1900", "1980", "1950")).toBe("within");
    expect(lifetimeOverlap("1900", "1980", "1899")).toBe("outside");
    expect(lifetimeOverlap("", "1980", "1950")).toBe("unknown");
  });
});

describe("Event and list options change report contents", () => {
  it("distinguishes person, immediate family and all relatives with interval lifetime limits", () => {
    const state = fixture(), root = person(state, "Root", "1900", { deathDate: "1980" }), direct = person(state, "Parent"), distant = person(state, "Grandparent");
    parent(state, direct, root); parent(state, distant, direct);
    event(state, root, "own", "1950"); event(state, direct, "near", "1951"); event(state, distant, "far", "1952");
    event(state, direct, "boundary", "1900-03"); event(state, direct, "outside", "1899");
    expect(lifeEvents(state, root, "person").map(e => e.id)).toEqual(["own"]);
    expect(lifeEvents(state, root, "immediate-family").map(e => e.id)).toEqual(["boundary", "own", "near"]);
    expect(lifeEvents(state, root, "all-relatives").map(e => e.id)).toContain("far");
    expect(text(doc(state, "Person Events Report"))).toContain("exact inclusion is uncertain");
    root.birthDate = "";
    expect(lifeEvents(state, root, true).map(e => e.id)).toEqual(["own"]);
  });
  it.each(["Events List", "Person Events Report", "Narrative Report", "Timeline Report", "Timeline Chart"])("applies event types and both date bounds to %s", type => {
    const state = fixture(), root = person(state, "Root");
    event(state, root, "keep", "1950", "Residence"); event(state, root, "type-excluded", "1950", "Occupation");
    event(state, root, "too-early", "1949", "Residence"); event(state, root, "too-late", "1951", "Residence");
    const result = text(doc(state, type, { eventTypes: ["Residence"], dateFrom: "1950-06", dateTo: "1950-07" }));
    expect(result).toContain("keep description"); expect(result).not.toContain("type-excluded description"); expect(result).not.toContain("too-early description"); expect(result).not.toContain("too-late description");
    expect(text(doc(state, type, { eventTypes: [] }))).not.toContain("keep description");
  });
  it("sorts by name, type and date in both directions and groups by actual axes", () => {
    const state = fixture(), z = person(state, "Zulu", "1930", { familyName: "Zed" }), a = person(state, "Alpha", "1910", { familyName: "Aye" });
    event(state, z, "late", "1950", "Occupation", { placeId: state.places[0].id });
    event(state, a, "early", "1940", "Birth", { placeId: state.places[0].id });
    for (const sortBy of ["name", "date", "type"] as const) {
      const asc = text(doc(state, "Events List", { sortBy })), desc = text(doc(state, "Events List", { sortBy, sortDirection: "desc" }));
      expect(asc.indexOf("early description")).toBeLessThan(asc.indexOf("late description"));
      expect(desc.indexOf("early description")).toBeGreaterThan(desc.indexOf("late description"));
    }
    expect(headings(doc(state, "Events List", { groupBy: "type" }), 3)).toEqual(["Birth", "Occupation"]);
    expect(headings(doc(state, "Events List", { groupBy: "place" }), 3)).toEqual([state.places[0].name]);
    expect(headings(doc(state, "Persons List", { groupBy: "surname" }), 3)).toEqual(["Aye", "Zed"]);
    expect(headings(doc(state, "Persons List", { groupBy: "none" }), 3)).toEqual([]);
    expect(headings(doc(state, "Persons List", { groupBy: "status" }), 3)).toEqual(["Not living"]);
  });
  it("projects chosen columns in order without leaking excluded fields", () => {
    const state = fixture(), root = person(state, "Root", "1900", { biography: "not a list column" });
    event(state, root, "secret-description", "1950");
    const rendered = text(doc(state, "Events List", { columns: ["Type", "Date"] }));
    expect(rendered).toContain("Type: Residence | Date: 1950"); expect(rendered).not.toContain("secret-description");
    expect(text(doc(state, "Events List", { columns: [] }))).toContain("No columns selected.");
    expect(text(doc(state, "Persons List", { columns: ["Name"] }))).not.toContain("Born:");
    expect(text(doc(state, "Persons List", { columns: ["Name"] }))).not.toContain("not a list column");
  });
  it("filters tasks by status and due date, retains priority and omits private assignees", () => {
    const state = fixture(), root = person(state, "Root"), hidden = person(state, "Hidden", "1900", { private: true });
    for (const status of ["open", "doing", "done"] as const) state.todos.push({ id: status, treeId: tree, title: `${status} task`, status, priority: "high", dueDate: "1950", personId: root.id });
    state.todos.push({ id: "hidden", treeId: tree, title: "Hidden task", status: "open", priority: "low", dueDate: "1950", personId: hidden.id });
    for (const status of ["open", "doing", "done"] as const) {
      const result = text(doc(state, "ToDo List", { todoStatus: status, dateFrom: "1950", dateTo: "1950", columns: ["Task", "Priority", "Due date"] }));
      expect(result).toContain(`${status} task`); expect(result).toContain("Priority: high"); expect(result).not.toContain("Hidden task");
      for (const other of ["open", "doing", "done"].filter(s => s !== status)) expect(result).not.toContain(`${other} task`);
    }
    expect(text(doc(state, "ToDo List", { todoStatus: "all" }))).toContain("done task");
    expect(text(doc(state, "ToDo List", { dateFrom: "1951" }))).not.toContain("open task");
  });
  it("keeps explicit LDS baptism/confirmation and source values without classifying ordinary baptism", () => {
    const state = fixture(), root = person(state, "Root");
    root.facts.push(...["LDS: Baptism", "LDS: Confirmation", "Baptism"].map(type => ({ id: type, type, value: `Completed; temple: recorded place; ${type}`, date: "1950", sourceIds: [] })));
    const result = text(doc(state, "LDS Ordinances List", { columns: ["Type", "Date", "Value"] }));
    expect(result).toContain("Type: LDS: Baptism | Date: 1950"); expect(result).toContain("Type: LDS: Confirmation");
    expect(result).toContain("temple: recorded place"); expect(result).not.toContain("Type: Baptism"); expect(result).toContain("not confirmation");
  });
  it("filters dated facts, unions, places, changes and birth-date person lists", () => {
    const state = fixture(), root = person(state, "Root", "1900"), other = person(state, "Other", "1950");
    root.facts.push({ id: "old", type: "Occupation", value: "Old occupation", date: "1900", sourceIds: [] }, { id: "new", type: "Occupation", value: "New occupation", date: "1950", sourceIds: [] });
    state.relationships.push({ id: "old-union", treeId: tree, type: "spouse", fromId: root.id, toId: other.id, startDate: "1900", sourceIds: [] });
    state.changes.push({ id: "old", treeId: tree, at: "1900-01-01T00:00:00Z", label: "Old change" }, { id: "new", treeId: tree, at: "1950-01-01T00:00:00Z", label: "New change" });
    event(state, root, "place-old", "1900", "Residence", { placeId: state.places[0].id });
    const options = { dateFrom: "1950", dateTo: "1950", includePrivate: true };
    expect(text(doc(state, "Facts List", options))).toContain("New occupation"); expect(text(doc(state, "Facts List", options))).not.toContain("Old occupation");
    expect(text(doc(state, "Marriage List", options))).not.toContain("Root Family / Other Family");
    expect(text(doc(state, "Places List", options))).not.toContain("place-old description");
    expect(text(doc(state, "Changes List", options))).toContain("New change"); expect(text(doc(state, "Changes List", options))).not.toContain("Old change");
    expect(text(doc(state, "Persons List", options))).toContain("Other Family"); expect(text(doc(state, "Persons List", options))).not.toContain("Root Family");
  });
  it("labels alternate-calendar anniversaries as Gregorian dates, not ongoing religious observances", () => {
    const state = fixture(); person(state, "Root", "@#DJULIAN@ 4 OCT 1582");
    const result = text(doc(state, "Anniversary List", { eventTypes: ["Birth"] }));
    expect(result).toContain("10-14 | Root Family: birthday");
    expect(result).toContain("Original date: @#DJULIAN@ 4 OCT 1582");
    expect(result).toContain("does not calculate current-year lunar or religious observances");
  });
});

describe("Privacy, ancestry and narrative contents", () => {
  it("counts assigned media across visible entity types and includes only genuinely unassigned media on request", () => {
    const state = fixture(), root = person(state, "Root"), hidden = person(state, "Hidden", "1900", { private: true });
    const e = event(state, root, "event", "1950");
    const source = { id: "hidden-source", treeId: tree, title: "Private citation", citation: "Private text", templateId: "", fields: {}, url: "", mediaIds: ["source-private"], notes: "" }; state.sources.push(source); hidden.sourceIds.push(source.id);
    hidden.mediaIds.push("private"); e.mediaIds.push("event-photo"); root.mediaIds.push("person-photo");
    media(state, "private", [{ kind: "person", id: hidden.id }]); media(state, "source-private", [{ kind: "source", id: source.id }]);
    media(state, "event-photo", [{ kind: "event", id: e.id }]); media(state, "person-photo"); media(state, "loose");
    const defaultText = text(doc(state, "Status Report")), shown = text(doc(state, "Status Report", { includeUnassignedMedia: true }));
    expect(defaultText).toContain("Media: 2"); expect(defaultText).not.toContain("loose");
    expect(shown).toContain("Media: 3"); expect(shown).toContain("Unassigned media: 1"); expect(shown).toContain("loose");
    expect(shown).not.toContain("source-private"); expect(shown).not.toContain("private | picture");
    expect(text(doc(state, "Sources List"))).not.toContain("Private citation");
    expect(text(doc(state, "Status Report", { includePrivate: true }))).toContain("Media: 4");
    expect(text(doc(state, "Sources List", { includePrivate: true }))).toContain("Private citation");
  });
  it("narrates unknown-role ancestors through the generation limit and preserves explicit parentage", () => {
    const state = fixture(), root = person(state, "Root"), a = person(state, "Adopter"), b = person(state, "Grandparent");
    parent(state, a, root, "adoptive"); parent(state, b, a);
    expect(ahnentafel(state, root.id, 2).unnumbered.map(p => p.id)).toEqual([a.id, b.id]);
    expect(text(doc(state, "Ahnentafel Report", { ancestorGenerations: 2 }))).toContain("Grandparent Family was born");
    expect(text(doc(state, "Ahnentafel Report", { ancestorGenerations: 1 }))).not.toContain("Grandparent Family was born");
    expect(text(doc(state, "Narrative Report"))).toContain("Adopter Family (adoptive)");
    expect(reportScope(state, tree, false, "biological").relationships).toEqual([]);
    expect(text(doc(state, "Ahnentafel Report", { parentage: "biological" }))).not.toContain("Adopter Family");
    expect(text(doc(state, "Narrative Report", {}, a.id))).toContain("parentage not recorded");
  });
  it("uses Register continuation numbers and Roman child order, narrates leaf descendants and partners", () => {
    const state = fixture(), root = person(state, "Root", "1800"), later = person(state, "Later", "1840"), early = person(state, "Earlier", "1820"), grandchild = person(state, "Grandchild", "1860"), partnerPerson = person(state, "Partner", "1840");
    parent(state, root, later); parent(state, root, early); parent(state, later, grandchild);
    state.relationships.push({ id: "union", treeId: tree, type: "partner", fromId: later.id, toId: partnerPerson.id, sourceIds: [] });
    const entries = registerEntries(state, root.id, 3);
    expect(entries.map(e => [e.number, e.id])).toEqual([[1, root.id], [2, later.id]]);
    expect(entries[0].children).toEqual([{ id: early.id, roman: "i", continued: undefined }, { id: later.id, roman: "ii", continued: 2 }]);
    const result = text(doc(state, "Register Report"));
    expect(result).toContain("ii. Later Family; continued at 2."); expect(result).toContain("Earlier Family was born"); expect(result).toContain("partnership with Partner Family"); expect(result).toContain("Generation 2");
    expect(text(doc(state, "Register Report", { descendantGenerations: 1 }))).not.toContain("Grandchild Family was born");
  });
  it("applies independent ancestor and descendant depth to hourglasses and family selection", () => {
    const state = fixture(), root = person(state, "Root"), a = person(state, "Parent"), g = person(state, "Grandparent"), c = person(state, "Child"), d = person(state, "Grandchild");
    parent(state, a, root); parent(state, g, a); parent(state, root, c); parent(state, c, d);
    const graph = (ancestorGenerations: number, descendantGenerations: number) => doc(state, "Hourglass Chart", { ancestorGenerations, descendantGenerations }).content!.find(n => n.type === "reportChart")!.attrs!.diagram.nodes.map((n: { id: string }) => n.id);
    expect(graph(1, 2)).not.toContain(g.id); expect(graph(1, 2)).toContain(d.id);
    expect(graph(2, 1)).toContain(g.id); expect(graph(2, 1)).not.toContain(d.id);
    state.families.push({ id: "family1", treeId: tree, name: "Selected family", partnerIds: [root.id], childIds: [c.id], sourceIds: [], eventIds: [], notes: "" }, { id: "family2", treeId: tree, name: "Other family", partnerIds: [a.id], childIds: [root.id], sourceIds: [], eventIds: [], notes: "" });
    const family = text(doc(state, "Family Report", { familyId: "family1" }));
    expect(family).toContain("Selected family"); expect(family).not.toContain("Other family");
  });
  it.each(NARRATIVE_LANGUAGES)("generates %s prose without changing recorded names, biography or notes", language => {
    const state = fixture(), root = person(state, "UniqueName", "1900", { biography: "Original biography", notes: "Original notes" });
    event(state, root, "source-record", "1950");
    const sections = narrativeSections(state, root, { language });
    const result = sections.flatMap(s => s.paragraphs).join(" ");
    expect(result).toContain("UniqueName Family"); expect(result).toContain("1900"); expect(result).toContain("Original biography"); expect(result).toContain("Original notes"); expect(result).toContain("source-record description"); expect(result).not.toMatch(/\{(?:person|date|parents|type|place|other|children)\}/);
    if (language !== "en") { expect(result).not.toContain("has no recorded"); expect(result).not.toContain("Their parents"); expect(result).not.toContain("was born in"); }
  });
});

describe("Configurable age checks", () => {
  it.each([
    ["minParentAge", 16, 12, "Unlikely parent age", "1915-01-01"],
    ["maxParentAge", 40, 80, "Unlikely parent age", "1945-01-01"],
    ["maxLifespan", 80, 120, "Unusually long lifespan", "1920-01-01"],
    ["minMarriageAge", 18, 16, "Unlikely marriage age", "1917-01-01"],
    ["maxMarriageAge", 40, 100, "Unlikely marriage age", "1945-01-01"],
    ["burialDelayDays", 30, 366, "Burial long after death", "1920-01-01"]
  ] as const)("applies plausibility %s", (key, strict, relaxed, label, date) => {
    const state = fixture(), root = person(state, "Root"), child = person(state, "Child", date); parent(state, root, child);
    state.relationships.push({ id: "marriage", treeId: tree, type: "spouse", fromId: root.id, toId: child.id, startDate: date, sourceIds: [] });
    event(state, root, "burial", "1982-03-01", "Burial");
    expect(runPlausibilityChecks(state, tree, { [key]: strict }).some(i => i.label === label && (i.personId === root.id || key.includes("Parent") && i.personId === child.id))).toBe(true);
    expect(runPlausibilityChecks(state, tree, { [key]: relaxed }).some(i => i.label === label && (i.personId === root.id || key.includes("Parent") && i.personId === child.id))).toBe(false);
  });
  it.each([
    ["manyChildren", 1, 4, "recorded children", "1920-01-01", "1982-01-01"],
    ["earlyDeath", 10, 5, "before", "1920-01-01", "1909-01-01"],
    ["maxLifespan", 80, 90, "died aged", "1920-01-01", "1982-01-01"],
    ["minMarriageAge", 18, 16, "marriage on", "1917-01-01", "1982-01-01"],
    ["maxMarriageAge", 40, 50, "marriage on", "1945-01-01", "1982-01-01"],
    ["minParentAge", 18, 16, "was born when", "1917-01-01", "1982-01-01"],
    ["maxParentAge", 40, 50, "was born when", "1945-01-01", "1982-01-01"]
  ] as const)("applies distinctive %s", (key, strict, relaxed, phrase, date, deathDate) => {
    const state = fixture(), root = person(state, "Root", "1900-01-01", { gender: "female", deathDate }), child = person(state, "Child", date), second = person(state, "Second", date);
    parent(state, root, child); parent(state, root, second);
    state.relationships.push({ id: "marriage", treeId: tree, type: "spouse", fromId: root.id, toId: child.id, startDate: date, sourceIds: [] });
    const rootRows = (value: number) => distinctivePatterns(state, { [key]: value }).filter(row => row.startsWith("Root Family:")).join(" ");
    expect(rootRows(strict)).toContain(phrase); expect(rootRows(relaxed)).not.toContain(phrase);
  });
  it("does not treat an interval crossing a threshold as certain", () => {
    const state = fixture(); person(state, "Root", "1900", { deathDate: "1910" });
    expect(distinctivePatterns(state).join(" ")).not.toContain("before their 10th birthday");
    state.people[0].deathDate = "1909";
    expect(distinctivePatterns(state).join(" ")).toContain("date interval");
  });
});

describe("Editor section and column contracts", () => {
  it.each(CATALOG_TYPES)("filters every selectable heading in %s", type => {
    const state = createSeedState();
    const options = { includePrivate: true, includeUnassignedMedia: true, comparisonId: "person_alex" };
    const complete = doc(state, type, options, "person_june");
    const available = reportSections(type);
    for (const heading of headings(complete)) expect(available).toContain(heading);
    for (const heading of available) {
      const result = doc(state, type, { ...options, sections: [heading] }, "person_june");
      expect(headings(result).every(h => h === heading)).toBe(true);
      if (headings(complete).includes(heading)) expect(headings(result)).toContain(heading);
    }
    expect(headings(doc(state, type, { ...options, sections: [] }, "person_june"))).toEqual([]);
  });
  it.each(["Persons List", "Events List", "Person Events Report", "Facts List", "LDS Ordinances List", "Marriage List", "Marriages List", "Places List", "Sources List", "ToDo List", "Changes List", "Anniversary List"])("projects each selectable column in %s", type => {
    const state = createSeedState(); state.people[0].facts.push({ id: "lds", type: "LDS: Confirmation", date: "2000-01-01", value: "Recorded", sourceIds: [] });
    for (const column of reportColumns(type)) expect(text(doc(state, type, { includePrivate: true, columns: [column] }, "person_june"))).toContain(`${column}:`);
  });
  it("produces statistics and real chart series for every additional analysis axis", () => {
    const state = fixture(), root = person(state, "Root"); event(state, root, "birth", "1900", "Birth", { placeId: state.places[0].id });
    for (const analysisType of ["gender", "surname", "birth-year", "death-year", "lifespan", "children", "marriages", "sources", "events", "media", "event-type", "event-place", "event-year"]) {
      const result = doc(state, "Person Analysis", { analysisType });
      expect(text(result)).toContain("Distinct people: 1");
      expect(result.content?.find(n => n.type === "reportChart")?.attrs?.diagram.bars).toHaveLength(1);
    }
    expect(text(doc(state, "Person Analysis", { analysisType: "lifespan" }))).toContain("Mean: 82.00");
    root.birthDate = "1900";
    expect(text(doc(state, "Person Analysis", { analysisType: "lifespan" }))).not.toContain("Mean:");
  });
  it("counts a shared event once while retaining every associated person", () => {
    const state = fixture(), root = person(state, "Root"), other = person(state, "Other");
    event(state, root, "shared", "1950", "Marriage"); other.eventIds.push("shared");
    const result = text(doc(state, "Person Analysis", { analysisType: "event-type" }));
    expect(result).toContain("Marriage | 1 entries | 2 people"); expect(result).toContain("Entries: 1"); expect(result).toContain("Distinct people: 2");
  });
});

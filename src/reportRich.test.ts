import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { createEmptyPerson, createSeedState, MediaItem, PersonEvent } from "./domain";
import { buildReportDocument } from "./reportDocument";
import { buildReportMap, recordedCoordinates } from "./reportMap";
import { lifetimeHistory } from "./reportHistory";
import { HISTORY_CATALOG } from "./data/reportHistoryCatalog";
import land from "./data/reportLand110m.json";

const treeId = "tree_demo", personId = "person_june";
const flatten = (node: JSONContent): JSONContent[] => [node, ...(node.content || []).flatMap(flatten)];
const asText = (node: JSONContent) => flatten(node).map(n => n.text || "").filter(Boolean).join(" ");
const section = (doc: JSONContent, title: string) => {
  const nodes = doc.content || [], start = nodes.findIndex(n => n.type === "heading" && n.attrs?.level === 2 && n.content?.[0]?.text === title);
  const next = nodes.findIndex((n, i) => i > start && n.type === "heading" && n.attrs?.level === 2);
  return { type: "doc", content: start < 0 ? [] : nodes.slice(start + 1, next < 0 ? undefined : next) };
};
function fixture() {
  const state = createSeedState(), person = state.people.find(p => p.id === personId)!;
  state.events = []; state.families = []; state.media = []; state.records = [];
  state.people.forEach(p => { p.eventIds = []; p.mediaIds = []; });
  state.places = [
    { ...state.places[0], id: "singapore", name: "Singapore", latitude: "1.3521", longitude: "103.8198" },
    { ...state.places[0], id: "london", name: "London", latitude: "51.5074", longitude: "-0.1278", levels: { country: "United Kingdom" } },
    { ...state.places[0], id: "unknown", name: "Unknown coordinates", latitude: "", longitude: "" }
  ];
  const add = (id: string, date: string, placeId?: string, extra: Partial<PersonEvent> = {}) => {
    const event = { id, date, placeId, type: "Residence", description: `Recorded ${id}`, sourceIds: [], mediaIds: [], ...extra };
    state.events.push(event); person.eventIds.push(id); return event;
  };
  return { state, person, add };
}
function photo(id: string, eventId?: string): MediaItem {
  return { id, treeId, title: `Photo ${id}`, type: "picture", dataUrl: "data:image/png;base64,AAAA", externalUrl: "", assignedTo: [{ kind: eventId ? "event" : "person", id: eventId || personId }], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: `Original caption ${id}`, transcript: "", createdAt: "" };
}

describe("Offline geographic reports", () => {
  it("maps actual coordinates with chronological numbering, per-place events and same-person sequences", () => {
    const { state, add } = fixture();
    add("last", "2002-01-01", "singapore"); add("first", "1990-01-01", "singapore"); add("middle", "1999-01-01", "london");
    const map = buildReportMap(state, treeId, personId);
    expect(map.locations.map(p => [p.number, p.name, p.longitude, p.latitude])).toEqual([[1, "Singapore", 103.8198, 1.3521], [2, "London", -0.1278, 51.5074]]);
    expect(map.locations[0].events.map(e => e.id)).toEqual(["first", "last"]);
    expect(map.routes.map(r => [r.from, r.to, r.fromDate, r.toDate])).toEqual([[1, 2, "1990-01-01", "1999-01-01"], [2, 1, "1999-01-01", "2002-01-01"]]);
    expect(land.features).toHaveLength(127);
    const doc = buildReportDocument(state, treeId, "Map Report", personId);
    expect(asText(section(doc, "Map Legend"))).toContain("1990-01-01 | Residence | June Chang | Recorded first");
    expect(asText(doc)).toContain("not a recorded journey");
    expect(flatten(doc).some(n => n.type === "reportMap" && n.attrs?.map.locations.length === 2)).toBe(true);
  });
  it("rejects absent, out-of-range and malformed coordinates without turning blanks into zero", () => {
    for (const [lat, lon] of [["", ""], [" ", "10"], ["91", "5"], ["10", "181"], ["NaN", "0"], ["0x10", "10"], ["1,3521", "103"]]) expect(recordedCoordinates(lat, lon)).toBeUndefined();
    expect(recordedCoordinates("0", "0")).toEqual([0, 0]);
    expect(recordedCoordinates("-90", "180")).toEqual([180, -90]);
    const { state, add } = fixture(); add("missing", "1999", "unknown"); add("no-place", "", undefined);
    const map = buildReportMap(state, treeId, personId);
    expect(map.locations).toHaveLength(0); expect(map.unmapped.map(r => r.reason)).toEqual(["Coordinates not recorded", "No recorded place"]);
    expect(asText(buildReportDocument(state, treeId, "Map Report", personId))).toContain("Recorded missing");
  });
  it("includes selected family events but not another tree, private events or private owners in captions", () => {
    const { state, add } = fixture(); add("visible", "2000-01-01", "singapore"); add("private-event", "2001-01-01", "london", { private: true, description: "SECRET EVENT" });
    state.families.push({ id: "family", treeId, name: "Private Kai household", partnerIds: [personId, "person_kai"], childIds: [], eventIds: ["family-event"], sourceIds: [], notes: "" });
    state.events.push({ id: "family-event", type: "Marriage", date: "2005-01-01", placeId: "london", description: "Family celebration", mediaIds: [], sourceIds: [] });
    const map = buildReportMap(state, treeId, undefined, { familyId: "family" });
    const serialized = JSON.stringify(map);
    expect(serialized).toContain("Family celebration"); expect(serialized).not.toContain("Kai"); expect(serialized).not.toContain("SECRET EVENT");
    expect(buildReportMap(state, treeId, personId, { familyId: "missing-family" }).locations).toHaveLength(0);
    expect(buildReportMap(state, "other-tree", personId).locations).toHaveLength(0);
    expect(buildReportMap(state, treeId, "person_kai").locations).toHaveLength(0);
  });
  it("does not draw invented sequences through unknown locations, ambiguous days or partial dates", () => {
    const { state, add } = fixture(); add("a", "1990-01-01", "singapore"); add("b", "1991-01-01", "unknown"); add("c", "1992-01-01", "london");
    expect(buildReportMap(state, treeId, personId).routes).toHaveLength(0);
    state.events[1].date = "1991";
    expect(buildReportMap(state, treeId, personId).routes).toHaveLength(0);
    state.events[1].date = "1 JAN 1990"; state.events[1].placeId = "london";
    expect(buildReportMap(state, treeId, personId).routes).toHaveLength(0);
  });
  it("applies date and event filters, including partial and GEDCOM dates, without mutating records", () => {
    const { state, add } = fixture(); add("partial", "1993", "singapore"); add("gedcom", "2 JAN 1994", "london");
    const before = JSON.stringify(state);
    expect(buildReportMap(state, treeId, personId, { dateFrom: "1993-06-01", dateTo: "1993-12-31" }).locations[0].events[0].id).toBe("partial");
    expect(buildReportMap(state, treeId, personId, { eventTypes: [] }).locations).toHaveLength(0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("Cited lifetime context", () => {
  it("selects lifetime events and explicit regional associations, with real source URLs", () => {
    const { state, person, add } = fixture(); person.birthDate = "1940-01-01"; person.deathDate = "1980-05-07"; person.living = false;
    add("home", "1960-01-01", "singapore");
    const history = lifetimeHistory(state, treeId, personId);
    expect(history.rows.map(r => r.id)).toEqual(["un-founded", "udhr", "singapore-independence", "apollo-11"]);
    expect(history.rows.find(r => r.id === "apollo-11")?.age).toBe(29);
    expect(HISTORY_CATALOG.records.every(r => r.citation && /^https:\/\//.test(r.url))).toBe(true);
    expect(asText(buildReportDocument(state, treeId, "World History Report", personId))).toContain("8 selected English-language entries, 1776-1993");
  });
  it("does not invent a lifetime; marks boundary uncertainty and respects exact birthdays and deaths", () => {
    const { state, person } = fixture(); person.birthDate = "1969"; person.deathDate = "1969"; person.living = false;
    const row = lifetimeHistory(state, treeId, personId).rows[0];
    expect(row.id).toBe("apollo-11"); expect(row.overlap).toBe("possible"); expect(row.age).toBeUndefined();
    person.birthDate = "1969-07-21"; person.deathDate = "1970-01-01";
    expect(lifetimeHistory(state, treeId, personId).rows).toHaveLength(0);
    person.birthDate = "";
    expect(lifetimeHistory(state, treeId, personId).reason).toContain("No lifetime has been guessed");
  });
  it("uses shared Gregorian and GEDCOM bounds for early dates and custom context", () => {
    const { state, person } = fixture(); person.birthDate = "0900"; person.deathDate = "0950"; person.living = false;
    state.records.push({ id: "early", treeId, collection: "World History", title: "Recorded early context", date: "10 JAN 0920", citation: "Local archival citation", transcription: "User transcription" });
    const history = lifetimeHistory(state, treeId, personId);
    expect(history.rows[0]).toMatchObject({ id: "local:early", date: "10 JAN 0920", overlap: "within", origin: "local" });
  });
  it("requires custom citations, isolates person and tree scopes, and carries transcription verbatim", () => {
    const { state, person } = fixture(); person.birthDate = "1900"; person.deathDate = "2000"; person.living = false;
    for (const [id, who, tree, citation] of [["mine", personId, treeId, "Archive A p.12"], ["tree", undefined, treeId, "Archive B"], ["other", "person_alex", treeId, "Other"], ["foreign", personId, "other-tree", "Foreign"], ["uncited", personId, treeId, ""]]) state.records.push({ id: id!, treeId: tree!, personId: who, collection: "Historical Context", title: id!, date: "1950-01-01", citation: citation!, transcription: `Original text ${id}` });
    const history = lifetimeHistory(state, treeId, personId);
    expect(history.rows.filter(r => r.origin === "local").map(r => r.id)).toEqual(["local:mine", "local:tree"]);
    expect(history.omittedLocal).toBe(1);
    const doc = buildReportDocument(state, treeId, "World History Report", personId);
    expect(asText(doc)).toContain("Original text mine"); expect(asText(doc)).toContain("Archive A p.12"); expect(asText(doc)).not.toContain("Original text other");
  });
});

describe("Illustrated stories and person section integration", () => {
  it("assembles a privacy-scoped illustrated family book with numbered chapters, contents and chapter citations", () => {
    const { state, person, add } = fixture(); add("book-event", "2000-01-01", "singapore", { sourceIds: [state.sources[0].id], mediaIds: ["book-photo"] });
    state.media.push(photo("book-photo", "book-event"));
    const doc = buildReportDocument(state, treeId, "Family Tree Book", person.id, { includeHistory: true });
    const chapters = doc.content?.filter(n => n.type === "reportSection") || [];
    expect(chapters).toHaveLength(3); expect(asText(chapters[0])).toContain("Chapter 1: June Chang");
    expect(asText(chapters[0])).toContain("June Chang was born on"); expect(asText(chapters[0])).toContain("World History");
    expect(flatten(chapters[0]).some(n => n.type === "image" && n.attrs?.alt === "Photo book-photo")).toBe(true);
    expect(flatten(doc).filter(n => n.type === "reportPageBreak")).toHaveLength(2);
    expect(asText(section(doc, "Citations"))).toContain(state.sources[0].citation);
    expect(asText(doc)).not.toContain("Kai Chang"); expect(asText(doc)).not.toContain("Once removed");
    const contents = buildReportDocument(state, treeId, "Family Tree Book", person.id, { sections: ["Contents"] });
    expect(contents.content?.some(n => n.type === "reportSection")).toBe(false);
    expect(asText(contents)).toContain("1. June Chang"); expect(asText(contents)).not.toContain("was born on");
    const all = buildReportDocument(state, treeId, "Family Tree Book", person.id, { includePrivate: true });
    expect(all.content?.filter(n => n.type === "reportSection")).toHaveLength(4);
  });
  it("produces distinct documentary, album and chronological layouts with local photos, captions and citations", () => {
    const { state, person, add } = fixture(); const source = state.sources[0]; person.sourceIds = [source.id];
    add("birth", "1988-06-12", "singapore", { type: "Birth", sourceIds: [source.id], mediaIds: ["one"] }); add("move", "2000-01-01", "london", { mediaIds: ["two"] });
    state.media.push(photo("one", "birth"), photo("two", "move"));
    const docs = ["documentary", "album", "chronicle"].map(storyStyle => buildReportDocument(state, treeId, "Story Report", personId, { storyStyle: storyStyle as "album" }));
    for (const doc of docs) { expect(flatten(doc).filter(n => n.type === "image")).toHaveLength(2); expect(asText(doc)).toContain("Original caption one"); expect(asText(doc)).toContain(`[1] ${source.citation || source.title}`); expect(asText(doc)).toContain("June Chang was born on 1988-06-12"); }
    expect(flatten(docs[0]).filter(n => n.type === "reportPageBreak")).toHaveLength(0);
    expect(flatten(docs[1]).filter(n => n.type === "reportPageBreak")).toHaveLength(1);
    expect(flatten(docs[2]).filter(n => n.type === "reportPageBreak")).toHaveLength(1);
    expect(flatten(section(docs[0], "Life events")).filter(n => n.type === "image")).toHaveLength(2);
    expect(flatten(section(docs[1], "Life events")).filter(n => n.type === "image")).toHaveLength(0);
    expect(flatten(section(docs[1], "Photo Album")).filter(n => n.type === "image")).toHaveLength(2);
  });
  it("never embeds remote images or media linked to hidden people or events", () => {
    const { state, person, add } = fixture();
    const shared = photo("secret"); shared.assignedTo.push({ kind: "person", id: "person_kai" });
    const external = photo("remote"); external.dataUrl = "https://example.invalid/tracker.png";
    const hiddenEvent = photo("private-event-photo"); add("hidden", "2000-01-01", "singapore", { private: true, mediaIds: [hiddenEvent.id] });
    state.media.push(shared, external, hiddenEvent); person.mediaIds.push(shared.id, external.id, hiddenEvent.id);
    const hidden = JSON.stringify(buildReportDocument(state, treeId, "Story Report", personId));
    expect(hidden).not.toContain("Photo secret"); expect(hidden).not.toContain("tracker.png"); expect(hidden).not.toContain("Photo private-event-photo");
    const included = JSON.stringify(buildReportDocument(state, treeId, "Story Report", personId, { includePrivate: true }));
    expect(included).toContain("Photo secret"); expect(included).not.toContain("tracker.png");
  });
  it("uses localized generated prose while preserving recorded names and text", () => {
    const { state, person } = fixture(); person.biography = "Original words: bonjour";
    const doc = buildReportDocument(state, treeId, "Story Report", personId, { language: "de" });
    expect(asText(doc)).toContain("June Chang wurde"); expect(asText(doc)).toContain("Original words: bonjour");
  });
  it("uses shared additional-language event prose and identifies relatives' events by owner", () => {
    const { state, add } = fixture(); add("birth", "1988-06-12", "singapore", { type: "Birth" });
    for (const [language, phrase] of [["pt-BR", "evento registrado do tipo nascimento"], ["pl", "Odnotowano wydarzenie: urodzenie"]] as const) {
      expect(asText(buildReportDocument(state, treeId, "Story Report", personId, { language }))).toContain(phrase);
    }
    const parent = state.people.find(p => p.id === "person_alex")!;
    parent.eventIds.push("parent-move"); state.events.push({ id: "parent-move", date: "2000-01-01", type: "Residence", placeId: "london", description: "Parent's residence", sourceIds: [], mediaIds: [] });
    const own = asText(buildReportDocument(state, treeId, "Story Report", personId));
    expect(own).not.toContain("Parent's residence");
    const extended = asText(buildReportDocument(state, treeId, "Story Report", personId, { eventScope: "all-relatives" }));
    expect(extended).toContain("Alex Chang: On 2000-01-01");
  });
  it("does not expose private partnership details or their exclusive citations in Person reports", () => {
    const { state } = fixture();
    state.sources.push({ ...state.sources[0], id: "secret-source", title: "Private union source", citation: "CONFIDENTIAL CITATION" });
    state.relationships.push({ id: "private-union", treeId, fromId: personId, toId: "person_kai", type: "partner", status: "PRIVATE UNION STATUS", sourceIds: ["secret-source"] });
    const hidden = asText(buildReportDocument(state, treeId, "Person Report", personId, { sections: ["Partners", "Sources", "Citations"] }));
    expect(hidden).not.toContain("PRIVATE UNION STATUS"); expect(hidden).not.toContain("CONFIDENTIAL CITATION");
    const shown = asText(buildReportDocument(state, treeId, "Person Report", personId, { includePrivate: true, sections: ["Partners", "Sources", "Citations"] }));
    expect(shown).toContain("PRIVATE UNION STATUS"); expect(shown).toContain("CONFIDENTIAL CITATION");
  });
  it("filters nested Person sections without losing inner content or leaking unselected sections", () => {
    const state = createSeedState();
    const narrative = buildReportDocument(state, treeId, "Person Report", personId, { sections: ["Narrative Report"] });
    expect(asText(narrative)).toContain("June Chang was born on"); expect(asText(narrative)).not.toContain("World History"); expect(asText(narrative)).not.toContain("Once removed");
    const chart = buildReportDocument(state, treeId, "Person Report", personId, { sections: ["Hourglass Chart"] });
    expect(flatten(chart).some(n => n.type === "reportChart")).toBe(true);
    const noSections = buildReportDocument(state, treeId, "Person Report", personId, { sections: [] });
    expect(flatten(noSections).some(n => n.type === "reportChart")).toBe(false); expect(asText(noSections)).not.toContain("Name Details");
    expect(asText(buildReportDocument(state, treeId, "Person Report", personId))).toContain("World History");
    expect(asText(buildReportDocument(state, treeId, "Person Report", personId, { includeHistory: false }))).not.toContain("World History");
  });
  it("applies parentage and independent generation counts across Person output", () => {
    const state = createSeedState();
    for (const id of ["grandparent", "greatgrandparent", "child", "grandchild"]) state.people.push({ ...createEmptyPerson(treeId), id, givenName: id, private: false });
    for (const [fromId, toId] of [["greatgrandparent", "grandparent"], ["grandparent", "person_alex"], [personId, "child"], ["child", "grandchild"]]) state.relationships.push({ id: fromId + toId, treeId, fromId, toId, type: "parent-child", parentage: "adoptive", sourceIds: [] });
    state.relationships.filter(r => r.type === "parent-child").forEach(r => r.parentage = "adoptive");
    const doc = buildReportDocument(state, treeId, "Person Report", personId, { ancestorGenerations: 1, descendantGenerations: 2, sections: ["Parents", "Ancestors", "Descendants"] });
    expect(asText(section(doc, "Ancestors"))).not.toContain("grandparent");
    expect(asText(section(doc, "Descendants"))).toContain("grandchild");
    expect(JSON.stringify(section(doc, "Parents"))).toContain("Adoptive");
    const biological = buildReportDocument(state, treeId, "Person Report", personId, { parentage: "biological", sections: ["Ancestors", "Descendants"] });
    expect(asText(biological)).not.toContain("Alex Chang"); expect(asText(biological)).not.toContain("grandchild");
  });
});

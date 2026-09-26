import { describe, expect, it } from "vitest";
import { createEmptyPerson, createSeedState, type AppState, type MediaItem, type ProtectionRecord } from "./domain";
import { buildReportDocument } from "./reportDocument";
import { buildCatalogReport, reportProtectionRecords, reportScope } from "./reportCatalog";
import { reportSections } from "./reportSections";
import { meaningFor } from "./terms";
import { PROTECTION_RECORD_TYPES } from "./protection";
import { reportMediaVisible, reportPortrait } from "./reportStory";

const treeId = "tree_demo";
const reportTypes = ["Person Report", "Family Report", "Family Group Report", "Kinship Report"];
const recordSection = "Protection and Care Records";
const asText = (value: unknown) => JSON.stringify(value);

function fixture() {
  const state = createSeedState();
  state.people = ["focus", "partner", "child", "unrelated", "hidden"].map(id => ({
    ...createEmptyPerson(treeId), id, givenName: id, familyName: "Example", private: id === "hidden"
  }));
  state.people.push({ ...createEmptyPerson("another-tree"), id: "foreign", givenName: "Foreign person", private: false });
  state.relationships = [
    { id: "couple", treeId, type: "spouse", fromId: "focus", toId: "partner", subtype: "Civil Union", sourceIds: [] },
    { id: "parent", treeId, type: "parent-child", fromId: "focus", toId: "child", parentage: "biological", sourceIds: [] },
    { id: "hidden-link", treeId, type: "parent-child", fromId: "focus", toId: "hidden", parentage: "adoptive", sourceIds: [] },
    { id: "unrelated-link", treeId, type: "guardian", fromId: "partner", toId: "unrelated", sourceIds: [] },
    { id: "foreign-link", treeId, type: "partner", fromId: "focus", toId: "foreign", sourceIds: [] },
    { id: "wrong-tree-link", treeId: "another-tree", type: "sibling", fromId: "focus", toId: "partner", sourceIds: [] }
  ];
  state.families = [
    { id: "family", treeId, name: "Selected family", familyType: "Blended family", partnerIds: ["focus", "partner"], childIds: ["child"], eventIds: [], sourceIds: [], notes: "" },
    { id: "other-family", treeId, name: "Unrelated family", partnerIds: ["unrelated"], childIds: [], eventIds: [], sourceIds: [], notes: "" },
    { id: "mixed-family", treeId, name: "Mixed privacy family", partnerIds: ["focus"], childIds: ["hidden"], eventIds: [], sourceIds: [], notes: "" },
    { id: "cross-tree-family", treeId, name: "Invalid family", partnerIds: ["focus", "foreign"], childIds: [], eventIds: [], sourceIds: [], notes: "" }
  ];
  state.events = []; state.sources = []; state.media = []; state.records = [];
  state.places = []; state.todos = []; state.protectionRecords = [];
  return state;
}

function addRecord(state: AppState, id: string, changes: Partial<ProtectionRecord> = {}) {
  const record: ProtectionRecord = {
    id, treeId, entityKind: "person", entityId: "focus", type: "Custody Change", status: "Recorded",
    startDate: "2021", endDate: "2022", agency: "Recorded agency", contact: "Recorded contact", jurisdiction: "Recorded jurisdiction",
    caseReference: `case-${id}`, notes: `DETAIL-${id}`, sourceIds: [], mediaIds: [], visibility: "private", ...changes
  };
  state.protectionRecords!.push(record);
  return record;
}

describe("protection report privacy and scope", () => {
  it.each(reportTypes)("includes only shared records by default in %s; private inclusion is explicit", type => {
    const state = fixture();
    addRecord(state, "private");
    addRecord(state, "shared", { visibility: "shared" });
    addRecord(state, "legacy", { visibility: undefined as unknown as ProtectionRecord["visibility"] });
    const options = { familyId: "family", comparisonId: "partner", includeHistory: false };
    const hidden = asText(buildReportDocument(state, treeId, type, "focus", options));
    expect(hidden).toContain("DETAIL-shared");
    expect(hidden).not.toContain("DETAIL-private");
    expect(hidden).not.toContain("DETAIL-legacy");
    const included = asText(buildReportDocument(state, treeId, type, "focus", { ...options, includePrivate: true }));
    expect(included).toContain("DETAIL-private");
    expect(included).toContain("DETAIL-legacy");
    expect(included).toContain("Private record (explicitly included)");
  });

  it("keeps person reports to the person and their linked families and relationships", () => {
    const state = fixture();
    addRecord(state, "person", { visibility: "shared" });
    addRecord(state, "family", { entityKind: "family", entityId: "family", visibility: "shared" });
    addRecord(state, "relationship", { entityKind: "relationship", entityId: "couple", visibility: "shared" });
    addRecord(state, "partner-own", { entityId: "partner", visibility: "shared" });
    addRecord(state, "unrelated", { entityId: "unrelated", visibility: "shared" });
    addRecord(state, "other-family", { entityKind: "family", entityId: "other-family", visibility: "shared" });
    addRecord(state, "unrelated-link", { entityKind: "relationship", entityId: "unrelated-link", visibility: "shared" });
    const result = asText(buildReportDocument(state, treeId, "Person Report", "focus", { includePrivate: true }));
    for (const id of ["person", "family", "relationship"]) expect(result).toContain(`DETAIL-${id}`);
    for (const id of ["partner-own", "unrelated", "other-family", "unrelated-link"]) expect(result).not.toContain(`DETAIL-${id}`);
  });

  it.each(["Family Report", "Family Group Report"])("includes only the selected family, its members and internal relationships in %s", type => {
    const state = fixture();
    addRecord(state, "family", { entityKind: "family", entityId: "family", visibility: "shared" });
    addRecord(state, "member", { entityId: "child", visibility: "shared" });
    addRecord(state, "couple", { entityKind: "relationship", entityId: "couple", visibility: "shared" });
    addRecord(state, "unrelated", { entityId: "unrelated", visibility: "shared" });
    addRecord(state, "outside-link", { entityKind: "relationship", entityId: "unrelated-link", visibility: "shared" });
    addRecord(state, "other-family", { entityKind: "family", entityId: "other-family", visibility: "shared" });
    const result = asText(buildCatalogReport(state, treeId, type, "focus", { familyId: "family", includePrivate: true }));
    for (const id of ["family", "member", "couple"]) expect(result).toContain(`DETAIL-${id}`);
    for (const id of ["unrelated", "outside-link", "other-family"]) expect(result).not.toContain(`DETAIL-${id}`);
  });

  it("does not turn a hidden or missing family-report reference into an all-families report", () => {
    const state = fixture();
    addRecord(state, "other-family", { entityKind: "family", entityId: "other-family", visibility: "shared" });
    for (const id of ["hidden", "missing", "foreign"]) {
      const result = asText(buildCatalogReport(state, treeId, "Family Report", id));
      expect(result).toContain("Choose a visible person");
      expect(result).not.toContain("DETAIL-other-family");
    }
  });

  it("limits kinship records to the reference, displayed comparison and their direct relationship", () => {
    const state = fixture();
    addRecord(state, "reference", { visibility: "shared" });
    addRecord(state, "comparison", { entityId: "partner", visibility: "shared" });
    addRecord(state, "relationship", { entityKind: "relationship", entityId: "couple", visibility: "shared" });
    addRecord(state, "child", { entityId: "child", visibility: "shared" });
    addRecord(state, "outside-link", { entityKind: "relationship", entityId: "unrelated-link", visibility: "shared" });
    const result = asText(buildReportDocument(state, treeId, "Kinship Report", "focus", { comparisonId: "partner", includePrivate: true }));
    for (const id of ["reference", "comparison", "relationship"]) expect(result).toContain(`DETAIL-${id}`);
    for (const id of ["child", "outside-link"]) expect(result).not.toContain(`DETAIL-${id}`);
    const filtered = asText(buildReportDocument(state, treeId, "Kinship Report", "focus", { comparisonId: "partner", onlyCousins: true }));
    expect(filtered).not.toContain("DETAIL-comparison");
    expect(filtered).not.toContain("DETAIL-relationship");
    const none = asText(buildReportDocument(state, treeId, "Kinship Report", "focus", { kinshipCategories: [] }));
    expect(none).not.toContain("DETAIL-comparison");
    expect(none).not.toContain("DETAIL-child");
  });

  it("requires explicit private inclusion for records on hidden people, relationships and mixed families", () => {
    const state = fixture();
    addRecord(state, "hidden-person", { entityId: "hidden", visibility: "shared" });
    addRecord(state, "hidden-link", { entityKind: "relationship", entityId: "hidden-link", visibility: "shared" });
    addRecord(state, "mixed-family", { entityKind: "family", entityId: "mixed-family", visibility: "shared" });
    expect(reportScope(state, treeId).protectionRecords).toEqual([]);
    expect(reportScope(state, treeId, false, "biological").protectionRecords).toEqual([]);
    expect(reportScope(state, treeId, true).protectionRecords).toHaveLength(3);
    for (const type of reportTypes) {
      const result = asText(buildReportDocument(state, treeId, type, "focus", { comparisonId: "hidden", familyId: "mixed-family" }));
      expect(result).not.toContain("DETAIL-hidden-person");
      expect(result).not.toContain("DETAIL-hidden-link");
      expect(result).not.toContain("DETAIL-mixed-family");
    }
    const shown = asText(buildReportDocument(state, treeId, "Family Report", "focus", { familyId: "mixed-family", includePrivate: true }));
    expect(shown).toContain("DETAIL-hidden-person");
    expect(shown).toContain("DETAIL-hidden-link");
    expect(shown).toContain("DETAIL-mixed-family");
    const parentage = asText(buildReportDocument(state, treeId, "Person Report", "focus", { parentage: "biological" }));
    expect(parentage).not.toContain("DETAIL-mixed-family");
  });

  it("does not expose any protection details for a hidden or invalid kinship reference", () => {
    const state = fixture();
    addRecord(state, "comparison", { entityId: "partner", visibility: "shared" });
    for (const id of ["hidden", "missing", "foreign"]) {
      expect(asText(buildReportDocument(state, treeId, "Kinship Report", id, { comparisonId: "partner" }))).not.toContain("DETAIL-comparison");
    }
  });

  it.each([false, true])("rejects cross-tree and dangling owners even with includePrivate=%s", includePrivate => {
    const state = fixture();
    addRecord(state, "foreign-record", { treeId: "another-tree", visibility: "shared" });
    addRecord(state, "foreign-person", { entityId: "foreign", visibility: "shared" });
    addRecord(state, "foreign-link", { entityKind: "relationship", entityId: "foreign-link", visibility: "shared" });
    addRecord(state, "wrong-tree-link", { entityKind: "relationship", entityId: "wrong-tree-link", visibility: "shared" });
    addRecord(state, "cross-tree-family", { entityKind: "family", entityId: "cross-tree-family", visibility: "shared" });
    for (const entityKind of ["person", "family", "relationship"] as const) addRecord(state, `missing-${entityKind}`, { entityKind, entityId: "missing", visibility: "shared" });
    expect(reportScope(state, treeId, includePrivate).protectionRecords).toEqual([]);
    for (const type of reportTypes) expect(asText(buildReportDocument(state, treeId, type, "focus", { includePrivate }))).not.toContain("DETAIL-");
  });

  it("applies selected parentage to relationship records", () => {
    const state = fixture();
    addRecord(state, "adoptive", { entityKind: "relationship", entityId: "hidden-link", visibility: "shared" });
    const scope = { relationshipIds: ["hidden-link"] };
    expect(reportProtectionRecords(state, treeId, scope, { includePrivate: true, parentage: "biological" })).toEqual([]);
    expect(reportProtectionRecords(state, treeId, scope, { includePrivate: true, parentage: "adoptive" })).toHaveLength(1);
  });

  it("does not change records or opt into private export when rendering", () => {
    const state = fixture();
    addRecord(state, "private");
    const original = structuredClone(state);
    for (const type of reportTypes) buildReportDocument(state, treeId, type, "focus", { includePrivate: true });
    expect(state).toEqual(original);
    expect(asText(buildReportDocument(state, treeId, "Person Report", "focus"))).not.toContain("DETAIL-private");
  });
});

describe("protection report content", () => {
  it("prints dated record details, useful meanings and only eligible citations and attachment titles", () => {
    const state = fixture();
    state.sources = [
      { id: "source", treeId, title: "Visible source", citation: "Selected citation", templateId: "", fields: {}, url: "", notes: "", mediaIds: [] },
      { id: "foreign-source", treeId: "another-tree", title: "Foreign source secret", citation: "Foreign citation secret", templateId: "", fields: {}, url: "", notes: "", mediaIds: [] }
    ];
    const media = { treeId, type: "pdf" as const, dataUrl: "", externalUrl: "", assignedTo: [], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "2021" };
    state.media = [
      { ...media, id: "attachment", title: "Visible attachment", visibility: "shared" },
      { ...media, id: "private-file", title: "Private attachment secret", visibility: "private" },
      { ...media, id: "foreign-file", treeId: "another-tree", title: "Foreign attachment secret", visibility: "shared" }
    ];
    addRecord(state, "record", { visibility: "shared", sourceIds: ["source", "foreign-source"], mediaIds: ["attachment", "private-file", "foreign-file"] });
    const result = asText(buildReportDocument(state, treeId, "Person Report", "focus", { sections: [recordSection] }));
    for (const value of ["From: 2021", "Until: 2022", "Agency: Recorded agency", "Contact: Recorded contact", "Jurisdiction: Recorded jurisdiction", "Case reference: case-record", "Source: Selected citation", "Attachment: Visible attachment", meaningFor("Custody Change")!]) expect(result).toContain(value);
    for (const value of ["Foreign citation secret", "Foreign attachment secret", "Private attachment secret"]) expect(result).not.toContain(value);
    const included = asText(buildReportDocument(state, treeId, "Person Report", "focus", { sections: [recordSection], includePrivate: true }));
    expect(included).toContain("Private attachment secret");
    expect(included).not.toContain("Foreign attachment secret");
  });

  it("keeps sources and unattached media used only by hidden protection records out of public report inventories", () => {
    const state = fixture();
    state.sources = [{ id: "secret-source", treeId, title: "Hidden protection source", citation: "Secret protection citation", templateId: "", fields: {}, url: "", notes: "", mediaIds: [] }];
    state.media = [{ id: "secret-file", treeId, title: "Hidden protection file", type: "pdf", dataUrl: "", externalUrl: "", assignedTo: [], tags: [], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "", transcript: "", createdAt: "2021" }];
    addRecord(state, "hidden", { sourceIds: ["secret-source"], mediaIds: ["secret-file"] });
    const scoped = reportScope(state, treeId);
    expect(scoped.sources).toEqual([]);
    expect(scoped.media).toEqual([]);
    expect(asText(buildCatalogReport(state, treeId, "Sources List"))).not.toContain("Secret protection citation");
    expect(asText(buildReportDocument(state, treeId, "Sources List"))).not.toContain("Secret protection citation");
    expect(asText(buildCatalogReport(state, treeId, "Status Report", undefined, { includeUnassignedMedia: true }))).not.toContain("Hidden protection file");
  });

  it.each(reportTypes)("makes protection and term meanings selectable in %s", type => {
    const state = fixture();
    addRecord(state, "selected", { visibility: "shared" });
    const options = { familyId: "family", comparisonId: "partner", includeHistory: false };
    expect(reportSections(type)).toEqual(expect.arrayContaining([recordSection, "Term Meanings"]));
    const selected = asText(buildReportDocument(state, treeId, type, "focus", { ...options, sections: [recordSection] }));
    expect(selected).toContain("DETAIL-selected");
    const none = asText(buildReportDocument(state, treeId, type, "focus", { ...options, sections: [] }));
    expect(none).not.toContain("DETAIL-selected");
    expect(none).not.toContain("Term Meanings");
    const terms = asText(buildReportDocument(state, treeId, type, "focus", { ...options, sections: ["Term Meanings"] }));
    expect(terms).toContain(meaningFor("Civil Union"));
    expect(terms).not.toContain("DETAIL-selected");
  });

  it("defines every protection type and preserves unknown custom wording without guessing", () => {
    for (const term of PROTECTION_RECORD_TYPES) expect(meaningFor(term), term).toBeDefined();
    const state = fixture();
    addRecord(state, "custom", { type: "Custom recorded arrangement", visibility: "shared" });
    const result = asText(buildReportDocument(state, treeId, "Person Report", "focus", { sections: [recordSection] }));
    expect(result).toContain("Custom recorded arrangement");
    expect(result).not.toContain("Meaning:");
    expect(result).toContain("vary by jurisdiction");
    expect(result).toContain("does not establish guilt");
  });
});

describe("explicit report image privacy", () => {
  function photo(id: string, changes: Partial<MediaItem> = {}): MediaItem {
    return {
      id, treeId, title: `Photo ${id}`, type: "picture", dataUrl: `data:image/png;base64,${btoa(id)}`,
      externalUrl: "", assignedTo: [{ kind: "person", id: "focus" }], tags: [], rotation: 0, crop: "",
      colorized: false, enhanced: false, repaired: false, story: `Caption ${id}`, transcript: "", createdAt: "2021", ...changes
    };
  }

  it.each(["Person Report", "Story Report", "Family Tree Book"])("omits private portraits and photos from %s until explicitly included", type => {
    const state = fixture(), person = state.people.find(person => person.id === "focus")!;
    const portrait = photo("private-portrait", { visibility: "private" });
    const eventPhoto = photo("private-event-image", { visibility: "private", assignedTo: [{ kind: "event", id: "public-event" }] });
    const ordinary = photo("ordinary-photo");
    state.media = [portrait, eventPhoto, ordinary];
    person.profileMediaId = portrait.id;
    person.mediaIds = state.media.map(media => media.id);
    person.eventIds = ["public-event"];
    state.events = [{ id: "public-event", type: "Residence", date: "2021", description: "A public event", sourceIds: [], mediaIds: [eventPhoto.id] }];
    const hidden = asText(buildReportDocument(state, treeId, type, person.id));
    for (const media of [portrait, eventPhoto]) {
      expect(hidden).not.toContain(media.dataUrl);
      expect(hidden).not.toContain(media.title);
      expect(hidden).not.toContain(media.story);
    }
    expect(hidden).toContain(ordinary.dataUrl);
    expect(reportPortrait(state, person)?.id).toBe(ordinary.id);
    const shown = asText(buildReportDocument(state, treeId, type, person.id, { includePrivate: true }));
    expect(shown).toContain(portrait.dataUrl);
    expect(shown).toContain(eventPhoto.dataUrl);
    expect(shown).toContain(eventPhoto.story);
    expect(reportPortrait(state, person, true)?.id).toBe(portrait.id);
  });

  it.each(["Person Report", "Story Report"])("keeps government images private by default and allows explicitly shared files in %s", type => {
    const state = fixture(), person = state.people.find(person => person.id === "focus")!;
    const legacy = photo("government-legacy", { tags: ["government-file"] });
    const privateFile = photo("government-private", { tags: ["government-file"], visibility: "private" });
    const shared = photo("government-shared", { tags: ["government-file"], visibility: "shared" });
    state.media = [legacy, privateFile, shared];
    person.profileMediaId = legacy.id;
    person.mediaIds = state.media.map(media => media.id);
    const hidden = asText(buildReportDocument(state, treeId, type, person.id));
    for (const media of [legacy, privateFile]) {
      expect(hidden).not.toContain(media.dataUrl);
      expect(hidden).not.toContain(media.title);
      expect(hidden).not.toContain(media.story);
    }
    expect(hidden).toContain(shared.dataUrl);
    const shown = asText(buildReportDocument(state, treeId, type, person.id, { includePrivate: true }));
    for (const media of state.media) expect(shown).toContain(media.dataUrl);
  });

  it("uses canonical file privacy even when given a stale shared copy", () => {
    const state = fixture(), media = photo("canonical-private", { visibility: "private" });
    state.media = [media];
    expect(reportMediaVisible(state, { ...media, visibility: "shared" })).toBe(false);
    expect(reportMediaVisible(state, media, true)).toBe(true);
  });

  it("keeps private-person and private-event filtering for explicitly shared government files", () => {
    const state = fixture();
    const personFile = photo("hidden-person-file", { tags: ["government-file"], visibility: "shared", assignedTo: [{ kind: "person", id: "hidden" }] });
    const eventFile = photo("hidden-event-file", { tags: ["government-file"], visibility: "shared" });
    state.media = [personFile, eventFile];
    state.events = [{ id: "hidden-event", type: "Residence", date: "2021", private: true, description: "", sourceIds: [], mediaIds: [eventFile.id] }];
    for (const media of state.media) {
      expect(reportMediaVisible(state, media)).toBe(false);
      expect(reportMediaVisible(state, media, true)).toBe(true);
    }
  });
});

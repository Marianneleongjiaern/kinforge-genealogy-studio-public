import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EVENT_TYPES, LIST_TYPES, PROTECTION_EVENT_TYPES, REPORT_TYPES, createSeedState } from "./domain";
import { ACCESS_GLYPHS, DISABILITY_GLYPHS, EVENT_GLYPHS, createPersonNeed, eventGlyph, glyphById, glyphMatchesQuery, groupPersonNeeds, GLYPHS, NEED_GLYPHS, relationshipGlyph } from "./glyphs";
import { Glyph } from "./Glyph";
import { PersonNeedsSummary } from "./PersonNeeds";
import { buildBackup, buildWebsiteExport, personCsvRows } from "./exporters";
import { exportGedcom } from "./gedcom";
import { generateListBody, generateReportBody } from "./analysis";
import { resolveWorkspaceRoute, workspacePath } from "./workspace";
import { meaningFor } from "./terms";

describe("labelled glyph system", () => {
  it("has unique IDs, explicit meanings and a renderable icon for each definition", () => {
    expect(new Set(GLYPHS.map(glyph => glyph.id)).size).toBe(GLYPHS.length);
    for (const glyph of GLYPHS) {
      expect(glyph.label).not.toBe("");
      expect(glyph.meaning).not.toBe("");
      const html = renderToStaticMarkup(createElement(Glyph, { id: glyph.id }));
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('stroke-width="1.65"');
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-labelledby=');
      expect(html).toContain(glyph.label.replace(/&/g, "&amp;"));
    }
  });
  it("covers every built-in event without guessing the meaning of custom labels", () => {
    for (const type of EVENT_TYPES) {
      expect(eventGlyph(type).id, type).not.toBe("other-event");
      expect(eventGlyph(type).eventType, type).toBe(type);
    }
    expect(EVENT_GLYPHS.length).toBeGreaterThanOrEqual(40);
    expect(eventGlyph("  DIVORCE ").id).toBe("divorce");
    expect(eventGlyph("Naturalization").id).toBe("naturalisation");
    expect(eventGlyph("Divorce Filing").id).toBe("divorce-filing");
    expect(eventGlyph("Hospitalization").id).toBe("hospitalization");
    expect(eventGlyph("DNA Test").id).toBe("dna-test");
    expect(eventGlyph("Probate").id).toBe("probate");
    expect(eventGlyph("Possible divorce? Research pending").id).toBe("other-event");
    expect(eventGlyph("Wheelchair user").id).toBe("other-event");
  });
  it("uses different silhouettes for separation, divorce and annulment", () => {
    const glyphs = ["Separation", "Divorce", "Annulment"].map(eventGlyph);
    expect(new Set(glyphs.map(glyph => glyph.icon)).size).toBe(3);
  });
  it("gives every protection event one labelled entry with the glossary's exact meaning", () => {
    for (const type of PROTECTION_EVENT_TYPES) {
      const matches = EVENT_GLYPHS.filter(glyph => glyph.eventType === type);
      expect(matches, type).toHaveLength(1);
      const glyph = eventGlyph(` ${type.toUpperCase()} `);
      expect(glyph).toBe(matches[0]);
      expect(glyph.label).toBe(type);
      expect(glyph.id).not.toBe("other-event");
      expect(meaningFor(type), type).toBeTruthy();
      expect(glyph.meaning).toBe(meaningFor(type));
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(createElement(Glyph, { id: glyph.id }));
      expect(element.querySelector("title")?.textContent).toBe(type);
      expect(element.querySelectorAll('[role="img"]')).toHaveLength(1);
    }
  });
  it.each([
    ["Custody Removal", "Custody Change", "Custody Restoration"],
    ["Foster Placement", "Foster Placement End"],
    ["Government Facility Placement", "Government Facility Release"],
    ["Personal Protection Order", "Restraining Order", "Protection Order Change", "Protection Order End"],
    ["Arrest", "House Arrest"],
    ["Care Arrangement", "Care Team Change", "Inpatient Care", "Daycare Arrangement"]
  ])("distinguishes related protection event artwork starting with %s", (...types) => {
    const signatures = types.map(type => {
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(createElement(Glyph, { id: eventGlyph(type).id, decorative: true }));
      return [...element.querySelectorAll("path, circle, line, polyline, rect")].map(shape => shape.outerHTML).join("");
    });
    expect(new Set(signatures).size).toBe(types.length);
  });
  it("does not infer protection or legal outcomes from uncertain custom event labels", () => {
    for (const type of ["Possible arrest", "Custody restoration?", "No custody removal recorded", "Protection order may have ended"]) {
      expect(eventGlyph(type).id).toBe("other-event");
    }
  });
  it("covers relationship roles and explicit union statuses with labelled symbols", () => {
    expect(relationshipGlyph("Parent").id).toBe("relationship-parent");
    expect(relationshipGlyph("Child").id).toBe("relationship-child");
    expect(relationshipGlyph("Sibling").id).toBe("relationship-sibling");
    expect(relationshipGlyph("Spouse").id).toBe("relationship-spouse");
    expect(relationshipGlyph("Partner").id).toBe("relationship-partner");
    expect(relationshipGlyph("Guardian").id).toBe("relationship-guardian");
    expect(relationshipGlyph("Ward").id).toBe("relationship-ward");
    expect(relationshipGlyph("Cousin").id).toBe("relationship-cousin");
    expect(relationshipGlyph("Immediate family").id).toBe("relationship-immediate-family");
    expect(relationshipGlyph("Extended family").id).toBe("relationship-extended-family");
    expect(relationshipGlyph("Biological").id).toBe("relationship-biological");
    expect(relationshipGlyph("Adopted").id).toBe("relationship-adopted");
    expect(relationshipGlyph("Foster").id).toBe("relationship-foster");
    expect(relationshipGlyph("Step").id).toBe("relationship-step");
    expect(relationshipGlyph("Single mom").id).toBe("single-mom");
    expect(relationshipGlyph("Single dad").id).toBe("single-dad");
    expect(relationshipGlyph("Spouse", "divorced").id).toBe("divorce");
    expect(relationshipGlyph("Partner", "separated").id).toBe("separation");
    expect(relationshipGlyph("Spouse", "annulled").id).toBe("annulment");
  });
  it("hides decorative glyphs and retains a labelled fallback for unknown IDs", () => {
    const decorative = renderToStaticMarkup(createElement(Glyph, { id: "disability", decorative: true }));
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("<title");
    const fallback = renderToStaticMarkup(createElement(Glyph, { id: "future-type", label: "User-defined need" }));
    expect(fallback).toContain("User-defined need");
    expect(fallback).toContain("<svg");
  });
});

describe("per-person disability and access annotations", () => {
  it("defaults every newly entered need to private and preserves user wording", () => {
    for (const glyph of NEED_GLYPHS) {
      const need = createPersonNeed(glyph.id, "  My preferred description  ", "source_interview");
      expect(need).toMatchObject({ glyphId: glyph.id, label: glyph.label, detail: "My preferred description", private: true, sourceId: "source_interview" });
    }
    expect(() => createPersonNeed("divorce", "")).toThrow();
    expect(() => createPersonNeed("unknown", "")).toThrow();
  });
  it("leaves existing people unclassified and supports old saved records", () => {
    const state = createSeedState();
    for (const person of state.people) {
      expect(person.accessNeeds).toBeUndefined();
      expect(renderToStaticMarkup(createElement(PersonNeedsSummary, { person }))).toBe("");
    }
  });
  it("keeps annotations on the selected person through backup and restoration", () => {
    const state = createSeedState();
    state.people[0].accessNeeds = [createPersonNeed("captions", "Written summary preferred", "source_interview")];
    const restored = JSON.parse(buildBackup(state)).state;
    expect(restored.people[0].accessNeeds).toEqual(state.people[0].accessNeeds);
    expect(restored.people[1].accessNeeds).toBeUndefined();
  });
  it("does not disclose annotation labels or details in existing share/report/list exports", () => {
    const state = createSeedState();
    const person = state.people[0];
    person.accessNeeds = [{ ...createPersonNeed("disability", "SENSITIVE_DETAIL_SENTINEL"), label: "SENSITIVE_LABEL_SENTINEL" }];
    const outputs = [buildWebsiteExport(state, person.treeId), exportGedcom(state, person.treeId), JSON.stringify(personCsvRows(state.people)),
      ...REPORT_TYPES.map(type => generateReportBody(state, person.treeId, type, person.id)),
      ...LIST_TYPES.map(type => generateListBody(state, person.treeId, type))];
    for (const output of outputs) {
      expect(output).not.toContain("SENSITIVE_DETAIL_SENTINEL");
      expect(output).not.toContain("SENSITIVE_LABEL_SENTINEL");
    }
  });
  it("resolves the dedicated access-needs route", () => {
    const state = createSeedState();
    const route = { treeId: "tree_demo", view: "people" as const, personId: "person_june", tab: "access" };
    expect(resolveWorkspaceRoute(workspacePath(route), state)).toEqual(route);
  });
  it("separates each requested disability from access preferences", () => {
    const requested = ["neurological-impairment", "cerebral-palsy", "blindness", "deafness", "paralysis", "limb-loss"];
    for (const id of requested) {
      expect(DISABILITY_GLYPHS.some(glyph => glyph.id === id)).toBe(true);
      expect(ACCESS_GLYPHS.some(glyph => glyph.id === id)).toBe(false);
      expect(createPersonNeed(id, "").private).toBe(true);
    }
    expect(ACCESS_GLYPHS.some(glyph => glyph.id === "captions")).toBe(true);
    expect(ACCESS_GLYPHS.some(glyph => glyph.id === "mobility")).toBe(true);
  });
  it("finds condition abbreviations and the user's terminology", () => {
    const find = (query: string) => NEED_GLYPHS.filter(glyph => glyphMatchesQuery(glyph, query)).map(glyph => glyph.id);
    expect(find("CP")).toEqual(["cerebral-palsy"]);
    expect(find("C.P.")).toEqual(["cerebral-palsy"]);
    expect(find("amputee")).toContain("limb-loss");
    expect(find("blind")).toContain("blindness");
    expect(find("deaf")).toContain("deafness");
    expect(find("paralysed")).toContain("paralysis");
  });
  it("preserves a person's preferred or uncertainty-qualified record label", () => {
    expect(createPersonNeed("deafness", "Uses written communication", undefined, "Deaf").label).toBe("Deaf");
    expect(createPersonNeed("cerebral-palsy", "Pending source review", undefined, "Possible CP - unconfirmed").label).toBe("Possible CP - unconfirmed");
    expect(createPersonNeed("blindness", "", undefined, "  ").label).toBe("Blindness");
  });
  it("does not infer another disability or access need from an entry", () => {
    const person = createSeedState().people[0];
    person.accessNeeds = [createPersonNeed("cerebral-palsy", "")];
    expect(person.accessNeeds).toHaveLength(1);
    expect(groupPersonNeeds(person.accessNeeds)).toEqual([{ group: "Disabilities", needs: person.accessNeeds }]);
    person.accessNeeds = [createPersonNeed("captions", "")];
    expect(groupPersonNeeds(person.accessNeeds).map(group => group.group)).toEqual(["Access needs"]);
  });
  it("keeps legacy IDs, mixed categories and unrecognized imported annotations", () => {
    const original = createPersonNeed("disability", "Existing description");
    const support = createPersonNeed("captions", "Existing preference");
    const unknown = { ...original, id: "future-record", glyphId: "future-symbol", label: "Custom imported record" };
    const groups = groupPersonNeeds([original, support, unknown]);
    expect(groups.map(group => group.group)).toEqual(["Disabilities", "Access needs", "Other annotations"]);
    expect(groups.flatMap(group => group.needs)).toEqual([original, support, unknown]);
  });
  it("renders distinct artwork for the six requested disability entries", () => {
    const signatures = ["neurological-impairment", "cerebral-palsy", "blindness", "deafness", "paralysis", "limb-loss"].map(id => {
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(createElement(Glyph, { id, decorative: true }));
      return [...element.querySelectorAll("path, circle, line, polyline, rect")].map(shape => shape.outerHTML).join("");
    });
    expect(new Set(signatures).size).toBe(6);
    for (const id of ["paralysis", "limb-loss", "upper-limb-loss", "lower-limb-loss", "deafblindness"]) {
      expect(glyphById(id)?.modifier).toBeDefined();
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(createElement(Glyph, { id }));
      expect(element.querySelectorAll("svg svg")).toHaveLength(2);
      expect(element.querySelectorAll('[role="img"]')).toHaveLength(1);
    }
  });
  it("preserves disability entries and custom labels in backups, not public outputs", () => {
    const state = createSeedState();
    const person = state.people[0];
    person.accessNeeds = DISABILITY_GLYPHS.map(glyph => createPersonNeed(glyph.id, "PRIVATE_CONDITION_DETAILS", "source_interview", "PRIVATE_CONDITION_LABEL"));
    expect(JSON.parse(buildBackup(state)).state.people[0].accessNeeds).toEqual(person.accessNeeds);
    for (const output of [buildWebsiteExport(state, person.treeId), exportGedcom(state, person.treeId), JSON.stringify(personCsvRows(state.people)), ...REPORT_TYPES.map(type => generateReportBody(state, person.treeId, type, person.id)), ...LIST_TYPES.map(type => generateListBody(state, person.treeId, type))]) {
      expect(output).not.toContain("PRIVATE_CONDITION_DETAILS");
      expect(output).not.toContain("PRIVATE_CONDITION_LABEL");
    }
  });
});

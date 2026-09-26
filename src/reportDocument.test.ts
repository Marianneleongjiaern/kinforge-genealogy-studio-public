import { describe, expect, it } from "vitest";
import { buildReportDocument, localReportImage, reportFromText } from "./reportDocument";
import { formattedRtf } from "./reportExports";
import { createEmptyPerson, createSeedState } from "./domain";
import { linkPeople } from "./treeGraph";

describe("Formatted report documents", () => {
  it("builds the person header and ordered reference-style sections as editable document nodes", () => {
    const state = createSeedState();
    const doc = buildReportDocument(state, "tree_demo", "Person Report", "person_june");
    expect(doc.content?.[0].type).toBe("reportHeader");
    const headings = doc.content?.filter(n => n.type === "heading" && n.attrs?.level === 2).map(n => n.content?.[0].text);
    expect(headings?.slice(0, 13)).toEqual(["Name Details", "Biography", "Death, Burial, and Memorial Details", "Events", "Media", "Facts", "Fact Meanings", "Partners", "Parents", "Children", "Ancestors", "Descendants", "Narrative Report"]);
    expect(JSON.stringify(doc)).toContain("A central person with a linked birth source and child relationship.");
    expect(JSON.stringify(doc)).toContain("Eye Color");
    expect(headings).toContain("Kinship Explanations");
    expect(JSON.stringify(doc)).toContain("Once removed = 1 generation apart");
  });
  it("prints cemetery, burial site, hospital and gravestone details in person reports", () => {
    const state = createSeedState();
    const june = state.people.find(person => person.id === "person_june")!;
    june.deathDate = "2065-03-04";
    june.living = false;
    june.deathDetails = {
      ...june.deathDetails,
      deathPlace: "Singapore",
      deathHospital: "Serene General Hospital",
      burialType: "Cemetery interment",
      burialDate: "2065-03-10",
      burialSite: "Serene Memorial Garden",
      cemeteryName: "Rose Silver Cemetery",
      cemeteryPlot: "Lot A-17",
      graveNumber: "G-42",
      hasGravestone: true,
      gravestoneInscription: "Loved and remembered"
    };
    const doc = JSON.stringify(buildReportDocument(state, "tree_demo", "Person Report", "person_june"));
    expect(doc).toContain("Death, Burial, and Memorial Details");
    expect(doc).toContain("Rose Silver Cemetery");
    expect(doc).toContain("Serene General Hospital");
    expect(doc).toContain("Loved and remembered");
  });
  it("includes named cousin explanations in Person Reports as well as Kinship Reports", () => {
    const state = createSeedState(), treeId = "tree_demo";
    for (const id of ["Grandparent", "OtherParent", "Cousin", "CousinChild"]) state.people.push({ ...createEmptyPerson(treeId), id, givenName: id, private: false });
    linkPeople(state, treeId, "parent-child", "Grandparent", "person_alex");
    linkPeople(state, treeId, "parent-child", "Grandparent", "OtherParent");
    linkPeople(state, treeId, "parent-child", "OtherParent", "Cousin");
    linkPeople(state, treeId, "parent-child", "Cousin", "CousinChild");
    state.relationships.find(r => r.type === "parent-child" && r.fromId === "person_alex" && r.toId === "person_june")!.parentRole = "father";
    for (const type of ["Person Report", "Kinship Report"]) {
      const doc = JSON.stringify(buildReportDocument(state, treeId, type, "person_june"));
      expect(doc).toContain("Cousin is June Chang's 1st cousin. CousinChild is Cousin's child.");
      expect(doc).toContain("Once removed means 1 family generation apart");
      expect(doc).toContain("Paternal means this connection starts with June Chang's father, Alex Chang.");
      expect(doc).toContain("Why 1st cousin: Grandparent is a grandparent of both June Chang and Cousin.");
    }
  });
  it("hides a private profile and private intermediary names until explicitly included", () => {
    const state = createSeedState();
    const hidden = JSON.stringify(buildReportDocument(state, "tree_demo", "Person Report", "person_kai"));
    expect(hidden).toContain("Private profile details are hidden"); expect(hidden).not.toContain("Kai Chang");
    const shown = JSON.stringify(buildReportDocument(state, "tree_demo", "Person Report", "person_kai", { includePrivate: true }));
    expect(shown).toContain("Kai Chang"); expect(shown).toContain("Government and Sensitive Details (Private)");
  });
  it("stores raw names as text, never executable markup; accepts only embedded bitmap images", () => {
    expect(reportFromText('Person Report\n<script>alert(1)</script>').content?.[1].content?.[0].text).toBe('<script>alert(1)</script>');
    expect(localReportImage("https://tracking.invalid/image.png")).toBe(false);
    expect(localReportImage("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(localReportImage("data:image/png;base64,AAAA")).toBe(true);
  });
  it("exports RTF headings, inline formatting, colors, alignment and escaped Unicode", () => {
    const rtf = formattedRtf('<h2>Events</h2><p style="text-align:center"><strong>First cousin</strong> twice removed <span style="color:rgb(255, 0, 0);font-size:14pt">Zoë {A}</span></p>');
    expect(rtf).toContain("\\cbpat2"); expect(rtf).toContain("\\b First cousin"); expect(rtf).toContain("\\qc");
    expect(rtf).toContain("\\fs28"); expect(rtf).toContain("\\red255\\green0\\blue0"); expect(rtf).toContain("Zo\\u235? \\{A\\}");
  });
});

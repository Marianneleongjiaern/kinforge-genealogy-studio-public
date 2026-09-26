import type { JSONContent } from "@tiptap/core";

const narrative = ["Life narrative", "Life events", "Relationships", "Recorded facts", "Biography", "Research notes"];
const events = ["Date", "Type", "People", "Place", "Description", "Sources", "Media"];
const facts = ["Person", "Type", "Value", "Date", "Sources"];
const unions = ["Partners", "Type", "Start", "End", "Status", "Sources"];
const sections: Record<string, string[]> = {
  "Narrative Report": [...narrative, "World History"],
  "Family Tree Book": ["Contents", "Family Chapters", "Citations"],
  "Person Report": ["Name Details", "Biography", "Death, Burial, and Memorial Details", "Events", "Media", "Facts", "Fact Meanings", "Medical Files, Diagnoses, and Accessibility Aids", "Work, Company, and Career Files", "Medical and Work Term Meanings", "Partners", "Parents", "Children", "Ancestors", "Descendants", "Narrative Report", "Hourglass Chart", "Notes", "Sources", "Citations", "World History", "Kinship Explanations", "Accessibility and Personal Needs (Private)", "Government and Sensitive Details (Private)"],
  "Map Report": ["Mapped Places", "Map Legend", "Event Routes", "Unmapped Events", "Citations"],
  "World History Report": ["Coverage", "Historical Context", "Local Historical Context", "Historical Citations"],
  "Story Report": [...narrative, "Photo Album", "World History", "Citations"],
  "Family Report": ["Family groups", "Union details", "Family events", "Family member biographies and facts", "Fact Meanings", "Family sources", "Family hourglass"],
  "Family Group Report": ["Family groups", "Union details", "Family events", "Family member biographies and facts", "Fact Meanings", "Family sources", "Family hourglass"],
  "Person Events Report": ["Chronological events"], "Events List": ["Chronological events"],
  "Ahnentafel Report": ["Numbered ancestors", "Ancestor narratives", "Unnumbered ancestor narratives", "Unassigned parent roles"],
  "Ahnentafel Diagram": ["Ancestor diagram", "Numbered ancestors", "Unassigned parent roles"],
  "Fan Chart": ["Ancestor diagram", "Numbered ancestors", "Unassigned parent roles"],
  "Descendancy Report": ["Descendants"], "Descendancy List": ["Descendants"],
  "Register Report": ["Register narratives"],
  "Persons List": ["People"], "Facts List": ["Recorded facts", "Fact Meanings"], "LDS Ordinances List": ["Locally recorded ordinances", "Fact Meanings"],
  "Marriage List": ["Recorded unions", "Marriage events"], "Marriages List": ["Recorded unions", "Marriage events"],
  "Places List": ["Places and events"],
  "Sources List": ["Citations used", "Unlinked bibliography", "Claims without attached citations"],
  "ToDo List": ["Research tasks"], "Changes List": ["Change history"],
  "Anniversary List": ["Annual calendar (month-day)"], "Today Report": ["On this day"],
  "Plausibility Report": ["Publication review", "Possible duplicate records"],
  "Distinctive Persons List": ["Distinctive recorded patterns"], "Particularities Report": ["Distinctive recorded patterns"],
  "Status Report": ["Database overview", "People statistics", "Research statistics", "Media inventory", "Unassigned media"],
  "Person Analysis": ["Values and people", "Analysis statistics", "Analysis chart"],
  "Timeline Report": ["Life chronology", "World History"], "Timeline Chart": ["Timeline diagram", "Life chronology", "World History"],
  "Name Distribution Report": ["Surname chart", "Surname distribution", "Surname and recorded event places"],
  "Name Distribution Chart": ["Surname chart", "Surname distribution", "Surname and recorded event places"],
  "Influential People Report": ["Connection ranking"],
};
const diagram = ["Diagram", "Line legend", "Union status marks", "People in diagram", "Recorded connections"];
for (const type of ["Hourglass Chart", "Relationship Chart", "Genogram", "Sociogram"]) sections[type] = type === "Relationship Chart" ? ["Relationship", ...diagram] : diagram;
sections["Kinship Report"] = ["Kinship Explanations"];
for (const type of ["Person Report", "Family Report", "Family Group Report", "Kinship Report"]) sections[type].push("Protection and Care Records", "Term Meanings");

const columns: Record<string, string[]> = {
  "Persons List": ["Name", "Born", "Birth place", "Died", "Death place", "Gender", "Aliases", "Labels", "Sources", "Events", "Media", "Record ID"],
  "Facts List": facts, "LDS Ordinances List": facts, "Events List": events, "Person Events Report": events,
  "Marriage List": [...unions, "Date", "People", "Place", "Description", "Media"], "Marriages List": [...unions, "Date", "People", "Place", "Description", "Media"],
  "Places List": ["Place", "Address", "Latitude", "Longitude", "Events", "Sources", "Notes"],
  "Sources List": ["Title", "Citation", "Uses", "URL", "Notes", "Media"],
  "ToDo List": ["Task", "Status", "Priority", "Person", "Due date"],
  "Changes List": ["Date", "Change"],
  "Anniversary List": ["Month-day", "Event", "Original date"], "Today Report": ["Month-day", "Event", "Original date"],
};

/** Exact generated section headings and column labels accepted by ReportOptions. */
export const reportSections = (type: string): string[] => [...(sections[type] || [])];
export const reportColumns = (type: string): string[] => [...(columns[type] || [])];

export function filterReportSections(content: JSONContent[], type: string, selected?: string[]) {
  if (selected === undefined) return content;
  const available = new Set(reportSections(type));
  let include = true;
  return content.filter(node => {
    const title = node.content?.map(child => child.text || "").join("");
    if (node.type === "heading" && node.attrs?.level === 2 && title && available.has(title)) include = selected.includes(title);
    return include;
  });
}

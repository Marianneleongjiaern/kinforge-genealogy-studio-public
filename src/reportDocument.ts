import type { JSONContent } from "@tiptap/core";
import { AppState, Person, emptyDeathDetails, emptyIdentityDetails, fullName } from "./domain";
import { generateReportBody } from "./analysis";
import { createKinshipIndex, generateKinshipReport, kinshipMatchesCategories } from "./kinship";
import { ReportOptions, buildCatalogReport, protectionReportContent, reportScope, reportTermMeanings } from "./reportCatalog";
import { personSymbolDocument, symbolDocument } from "./reportSymbols";
import { eventGlyph } from "./glyphs";
import { reportParentageState, PARENTAGE_LABELS } from "./reportParentage";
import { filterReportSections } from "./reportSections";
import { mapReportDocument } from "./reportMap";
import { historyReportDocument } from "./reportHistory";
import { lifeEvents } from "./reportFacts";
import { localReportImage, nestedReportContent, reportMediaVisible, reportPortrait, storyReportDocument } from "./reportStory";
export { localReportImage, reportPortrait } from "./reportStory";

const text = (value: string, bold = false): JSONContent => ({ type: "text", text: value || "Not recorded", ...(bold ? { marks: [{ type: "bold" }] } : {}) });
const p = (value: string): JSONContent => ({ type: "paragraph", content: value ? [text(value)] : [] });
const heading = (value: string, level = 2): JSONContent => ({ type: "heading", attrs: { level }, content: [text(value)] });
const fact = (label: string, value: string): JSONContent => ({ type: "reportField", attrs: { label }, content: [text(value)] });
const fieldLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase());

export function reportFromText(body: string): JSONContent {
  const sections = new Set(["Biography", "Events", "Facts", "Sources", "Government and Sensitive Details", "Mapped Places", "Timeline", "Plausibility Issues"]);
  return { type: "doc", content: body.split("\n").map((line, index) => index === 0 ? heading(line, 1)
    : line.startsWith("RELATIVE: ") ? heading(line.slice(10))
    : line && (sections.has(line) || /^[A-Z][A-Z ,?\-]+$/.test(line)) ? heading(line)
    : line.startsWith("In everyday words: ") ? { type: "blockquote", content: [p(line.slice(19))] }
    : p(line)) };
}

function kinshipDocument(state: AppState, treeId: string, personId: string, options: ReportOptions, includeLinkedRecords = true): JSONContent {
  const doc = reportFromText(generateKinshipReport(state, treeId, personId, options));
  const calculate = createKinshipIndex(reportParentageState(state, options.parentage), treeId);
  const targets = state.people.filter(p => p.treeId === treeId && (options.comparisonId ? p.id === options.comparisonId : p.id !== personId && (!p.private || options.includePrivate))).filter(p => {
    const result = calculate(personId, p.id);
    return kinshipMatchesCategories(result, options.kinshipCategories) && (!options.onlyRelated || result.paths.length || result.direct.length || result.connection.length) && (!options.onlyCousins || result.paths.some(p => p.degree !== undefined) || result.inLaws?.length);
  });
  let index = 0;
  doc.content = doc.content?.flatMap(node => {
    const target = targets[index];
    const name = target?.private && !options.includePrivate ? "[Private person]" : target && fullName(target);
    if (target && node.type === "heading" && node.attrs?.level === 2 && node.content?.[0]?.text === name) {
      index++;
      return [node, ...personSymbolDocument(state, target, options.includePrivate)];
    }
    return [node];
  });
  if (includeLinkedRecords) {
    const scoped = reportScope(state, treeId, options.includePrivate, options.parentage);
    const reference = scoped.people.find(person => person.id === personId);
    const targetIds = new Set(targets.filter(target => scoped.people.some(person => person.id === target.id)).map(target => target.id));
    const relationships = scoped.relationships.filter(r => r.fromId === personId && targetIds.has(r.toId) || r.toId === personId && targetIds.has(r.fromId));
    const validComparison = !options.comparisonId || state.people.some(person => person.treeId === treeId && person.id === options.comparisonId);
    const protection = reference && validComparison ? protectionReportContent(scoped, treeId, { personIds: [reference.id, ...targetIds], relationshipIds: relationships.map(r => r.id) }, options) : [];
    const meanings = reference && validComparison ? reportTermMeanings(relationships.flatMap(r => [r.type, r.subtype, r.status, r.parentage]), state.customFactTerms) : [];
    doc.content = [...(doc.content || []).slice(0, 1), heading("Kinship Explanations"), ...nestedReportContent((doc.content || []).slice(1)),
      ...(protection.length ? [heading("Protection and Care Records"), ...protection] : []),
      ...(meanings.length ? [heading("Term Meanings"), ...meanings] : [])];
  }
  return doc;
}

export function buildReportDocument(state: AppState, treeId: string, type: string, personId?: string, options: ReportOptions = {}): JSONContent {
  const doc = buildRichReportDocument(state, treeId, type, personId, options);
  if (options.includeHistory && personId && ["Narrative Report", "Timeline Report", "Timeline Chart"].includes(type)) {
    doc.content?.push(heading("World History"), ...nestedReportContent(historyReportDocument(state, treeId, personId, options).content!.slice(1)));
  }
  return { ...doc, content: filterReportSections(doc.content || [], type, options.sections) };
}

function familyBookDocument(original: AppState, treeId: string, personId: string | undefined, options: ReportOptions): JSONContent {
  const state = reportScope(original, treeId, options.includePrivate, options.parentage);
  const tree = state.trees.find(t => t.id === treeId);
  const people = [...state.people].sort((a, b) => a.id === personId ? -1 : b.id === personId ? 1 : fullName(a).localeCompare(fullName(b)) || a.id.localeCompare(b.id));
  const content: JSONContent[] = [heading("Family Tree Book", 1), heading(tree?.title || "Untitled tree", 3)];
  if (tree?.author) content.push(p(tree.author));
  content.push(p(`${people.length} person chapters | Private details: ${options.includePrivate ? "included" : "hidden"}`), heading("Contents"));
  content.push(...(people.length ? people.map((person, index) => p(`${index + 1}. ${fullName(person)} | ${person.birthDate || "Birth date not recorded"} | ${person.living ? "Living" : person.deathDate || "Death date not recorded"}`)) : [p("No visible people in this tree.")]));
  content.push(heading("Family Chapters"));
  const citations: JSONContent[] = [];
  people.forEach((person, index) => {
    const nodes = storyReportDocument(original, treeId, person.id, { ...options, sections: undefined, storyStyle: "documentary" }).content || [];
    const citationStart = nodes.findIndex(n => n.type === "heading" && n.attrs?.level === 2 && n.content?.[0]?.text === "Citations");
    if (citationStart >= 0) citations.push(heading(`Chapter ${index + 1}: ${fullName(person)}`, 3), ...nodes.slice(citationStart + 1));
    const chapter = nodes.slice(1, citationStart >= 0 ? citationStart : undefined).map(node => node.type === "heading" ? { ...node, attrs: { ...node.attrs, level: Math.min(6, (node.attrs?.level || 2) + 2) } } : node);
    const portrait = nodes[0]?.type === "reportHeader" ? nodes[0].content?.filter(n => n.type === "image") || [] : [];
    if (index) content.push({ type: "reportPageBreak" });
    content.push({ type: "reportSection", content: [heading(`Chapter ${index + 1}: ${fullName(person)}`, 3), ...portrait, ...chapter] });
  });
  if (!people.length) content.push(p("No person chapters available with these privacy settings."));
  content.push(heading("Citations"), p("Numbered references apply within each chapter."), ...(citations.length ? citations : [p("No chapter citations.")]));
  return { type: "doc", content };
}

function buildRichReportDocument(state: AppState, treeId: string, type: string, personId?: string, options: ReportOptions = {}): JSONContent {
  if (type === "Family Tree Book") return familyBookDocument(state, treeId, personId, options);
  if (type === "Map Report") return mapReportDocument(state, treeId, personId, options);
  if (type === "Story Report") return storyReportDocument(state, treeId, personId, options);
  if (type === "World History Report") return historyReportDocument(state, treeId, personId, options);
  if (type !== "Person Report") {
    const doc = type === "Kinship Report" && personId ? kinshipDocument(state, treeId, personId, options) : buildCatalogReport(state, treeId, type, personId, options) || reportFromText(generateReportBody(state, treeId, type, personId, options));
    const reference = state.people.find(p => p.id === personId && p.treeId === treeId);
    if (reference && (!reference.private || options.includePrivate)) {
      const photo = reportPortrait(state, reference, options.includePrivate);
      if (photo && doc.content?.[0]?.type === "heading") doc.content.splice(0, 1, { type: "reportHeader", content: [{ type: "image", attrs: { src: photo.dataUrl, alt: `${fullName(reference)} profile picture` } }, doc.content[0], heading(fullName(reference), 3)] });
      if (type === "Kinship Report") doc.content?.splice(1, 0, ...personSymbolDocument(state, reference, options.includePrivate));
    }
    return doc;
  }
  const people = state.people.filter(person => person.treeId === treeId);
  const person = people.find(person => person.id === personId);
  if (!person) return { type: "doc", content: [heading("Person Report", 1), p("No person selected.")] };
  const visible = (entry: Person) => !entry.private || !!options.includePrivate;
  const name = (entry: Person) => visible(entry) ? fullName(entry) : "[Private person]";
  const relationships = reportParentageState(state, options.parentage).relationships.filter(r => r.treeId === treeId && people.some(p => p.id === r.fromId) && people.some(p => p.id === r.toId));
  const parents = (id: string) => relationships.filter(r => r.type === "parent-child" && r.toId === id).map(r => people.find(p => p.id === r.fromId)!);
  const children = (id: string) => relationships.filter(r => r.type === "parent-child" && r.fromId === id).map(r => people.find(p => p.id === r.toId)!);
  const detail = (entry: Person) => visible(entry) ? `${name(entry)} | Born: ${entry.birthDate || "not recorded"} | ${entry.living ? "Living" : `Died: ${entry.deathDate || "not recorded"}`}` : name(entry);
  const media = visible(person) ? state.media.filter(m => m.treeId === treeId && reportMediaVisible(state, m, options.includePrivate) && (person.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "person" && a.id === person.id))) : [];
  const deathDetails = { ...emptyDeathDetails(), ...(person.deathDetails || {}) };
  const identity = { ...emptyIdentityDetails(), ...(person.identity || {}) };
  const scoped = reportScope(state, treeId, options.includePrivate, options.parentage);
  const medicalRecords = (scoped.medicalRecords || []).filter(record => record.personId === person.id);
  const medicalRecordMediaIds = new Set(medicalRecords.flatMap(record => record.mediaIds));
  const medicalFiles = scoped.media.filter(item => item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === person.id) && item.tags.includes("medical-file") || medicalRecordMediaIds.has(item.id));
  const workFiles = scoped.media.filter(item => item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === person.id) && item.tags.includes("work-file"));
  const header: JSONContent[] = [];
  const portrait = reportPortrait(state, person, options.includePrivate);
  if (visible(person) && portrait) header.push({ type: "image", attrs: { src: portrait.dataUrl, alt: `${name(person)} profile picture` } });
  header.push(heading("Person Report", 1), heading(name(person), 3));
  if (visible(person)) header.push(fact("Born on", person.birthDate || "Not recorded"), fact(person.living ? "Status" : "Died on", person.living ? "Living" : person.deathDate || "Not recorded"), fact("Record ID", person.id));
  const content: JSONContent[] = [{ type: "reportHeader", content: header }];
  if (!visible(person)) return { type: "doc", content: [...content, p("Private profile details are hidden.")] };
  const section = (title: string, nodes: JSONContent[]) => content.push(heading(title), ...(nodes.length ? nodes : [p("None recorded.")]));
  section("Name Details", [{ type: "reportColumns", content: [fact("First Name", person.givenName), fact("Last Name", person.familyName)] }, fact("Other Names", person.aliases.join(", ") || "None recorded"), fact("Gender", person.gender)]);
  const identityVisible = options.includePrivate || identity.visibility === "shared";
  const identityRows = identityVisible ? [
    fact("Pronouns", identity.pronouns || "Not recorded"),
    fact("Gender identity", identity.genderIdentity || "Not recorded"),
    fact("Gender expression", identity.genderExpression || "Not recorded"),
    fact("Sexual orientation", identity.sexualOrientation || "Not recorded"),
    fact("Romantic orientation", identity.romanticOrientation || "Not recorded"),
    fact("Relationship orientation", identity.relationshipOrientation || "Not recorded"),
    fact("Identity labels", identity.identityLabels.join(", ") || "Not recorded"),
    fact("Identity notes", identity.identityNotes || "Not recorded")
  ].filter(row => row.content?.[0]?.text !== "Not recorded") : [];
  if (identityVisible) section("Identity, Sexuality, Gender, and Pronouns", identityRows);
  const identityMeanings = identityVisible ? reportTermMeanings([identity.pronouns, identity.genderIdentity, identity.genderExpression, identity.sexualOrientation, identity.romanticOrientation, identity.relationshipOrientation, ...identity.identityLabels], state.customFactTerms) : [];
  if (identityMeanings.length) section("Identity Term Meanings", identityMeanings);
  section("Biography", [p(person.biography || "No biography recorded.")]);
  content.push(...personSymbolDocument(state, person, options.includePrivate));
  const hasDeathDetails = Object.entries(deathDetails).some(([key, value]) => key === "hasGravestone" ? Boolean(value) : Boolean(String(value || "").trim()));
  section("Death, Burial, and Memorial Details", hasDeathDetails ? [
    fact("Death place", deathDetails.deathPlace || "Not recorded"),
    fact("Hospital or facility where died", deathDetails.deathHospital || "Not recorded"),
    fact("Death location address", deathDetails.deathAddress || "Not recorded"),
    fact("Burial or memorial type", deathDetails.burialType || "Not recorded"),
    fact("Burial date", deathDetails.burialDate || "Not recorded"),
    fact("Burial site", deathDetails.burialSite || "Not recorded"),
    fact("Cemetery site", deathDetails.cemeteryName || "Not recorded"),
    fact("Cemetery location", deathDetails.cemeteryAddress || "Not recorded"),
    fact("Cemetery plot or section", deathDetails.cemeteryPlot || "Not recorded"),
    fact("Grave number", deathDetails.graveNumber || "Not recorded"),
    fact("Cemetery coordinates", [deathDetails.latitude, deathDetails.longitude].filter(Boolean).join(", ") || "Not recorded"),
    fact("Has gravestone", deathDetails.hasGravestone ? "Yes" : "No"),
    fact("Gravestone inscription", deathDetails.gravestoneInscription || "Not recorded"),
    fact("Funeral home", deathDetails.funeralHome || "Not recorded"),
    fact("Memorial URL", deathDetails.memorialUrl || "Not recorded"),
    fact("Notes", deathDetails.deathNotes || "Not recorded")
  ] : []);
  const events = lifeEvents(reportScope(state, treeId, options.includePrivate, options.parentage), person, options.eventScope || "person", options);
  section("Events", events.flatMap(event => [fact(event.date || "Date not recorded", `${event.type}${event.placeId ? `, ${state.places.find(place => place.treeId === treeId && place.id === event.placeId)?.name || "Place not recorded"}` : ""}`), ...(event.description ? [p(event.description)] : [])]));
  if (events.length) content.push(symbolDocument([...new Map(events.map(event => { const glyph = eventGlyph(event.type); return [glyph.id, { id: glyph.id, glyphId: glyph.id, label: glyph.label, meaning: glyph.meaning }]; })).values()]));
  section("Media", media.length ? [{ type: "reportGallery", content: media.map(item => ({ type: "reportMedia", content: [ ...(item.type === "picture" && localReportImage(item.dataUrl) ? [{ type: "image", attrs: { src: item.dataUrl, alt: item.title } }] : []), p(item.title), ...(item.story ? [p(item.story)] : [])] })) }] : []);
  const visibleFacts = person.facts.filter(f => !f.private || options.includePrivate);
  section("Facts", visibleFacts.map(f => fact(f.type, `${f.value}${f.date ? ` (${f.date})` : ""}`)));
  const factMeanings = reportTermMeanings(visibleFacts.flatMap(f => [f.type, f.value]), state.customFactTerms);
  if (factMeanings.length) section("Fact Meanings", factMeanings);
  const medicalNodes = [
    ...medicalRecords.flatMap(record => [
      heading(record.diagnosisName || record.type || "Medical record", 3),
      fact("Record type", record.type || "Not recorded"),
      fact("Condition category", record.conditionCategory || "Not recorded"),
      fact("Condition type", record.conditionType || "Not recorded"),
      fact("Disorder type", record.disorderType || "Not recorded"),
      fact("Body system", record.bodySystem || "Not recorded"),
      fact("Diagnosis date", record.diagnosisDate || "Not recorded"),
      fact("Onset date", record.onsetDate || "Not recorded"),
      fact("Review date", record.reviewDate || "Not recorded"),
      fact("Diagnostic standard", record.diagnosticStandard || "Not recorded"),
      fact("Criteria met", record.criteriaMet || "Not recorded"),
      fact("Symptoms or traits", record.symptomsOrTraits || "Not recorded"),
      fact("Functional impact", record.functionalImpact || "Not recorded"),
      fact("Course", record.course || "Not recorded"),
      fact("Care level", record.careLevel || "Not recorded"),
      fact("Hospital or clinic", record.hospitalOrClinic || "Not recorded"),
      fact("Diagnosing doctor", record.diagnosingDoctor || "Not recorded"),
      fact("Psychologist", record.psychologist || "Not recorded"),
      fact("Psychiatrist", record.psychiatrist || "Not recorded"),
      fact("Occupational therapist", record.occupationalTherapist || "Not recorded"),
      fact("Assistive devices", record.assistiveDevices || "Not recorded"),
      fact("Accommodations", record.accommodations || "Not recorded"),
      fact("Linked files", record.mediaIds.map(id => scoped.media.find(item => item.id === id)?.title || id).join(", ") || "None linked"),
      ...(record.notes ? [p(record.notes)] : [])
    ]),
    ...medicalFiles.filter(file => !medicalRecordMediaIds.has(file.id)).map(file => fact("Medical file", `${file.title} | ${file.tags.filter(tag => tag !== "medical-file").join(", ") || file.type}`))
  ];
  if (medicalNodes.length) section("Medical Files, Diagnoses, and Accessibility Aids", medicalNodes);
  if (workFiles.length) section("Work, Company, and Career Files", workFiles.map(file => fact("Work file", `${file.title} | ${file.tags.filter(tag => tag !== "work-file").join(", ") || file.type}`)));
  const medicalMeanings = reportTermMeanings(medicalRecords.flatMap(record => [record.type, record.diagnosisName, record.conditionCategory, record.conditionType, record.disorderType, record.bodySystem, record.assistiveDevices, record.accommodations]), state.customFactTerms);
  if (medicalMeanings.length) section("Medical and Work Term Meanings", medicalMeanings);
  const partners = relationships.filter(r => ["spouse", "partner"].includes(r.type) && (r.fromId === person.id || r.toId === person.id));
  section("Partners", partners.flatMap(rel => {
    const partner = people.find(p => p.id === (rel.fromId === person.id ? rel.toId : rel.fromId))!;
    if (!visible(partner)) return [p(detail(partner))];
    const commonChildren = children(person.id).filter(child => children(partner.id).some(p => p.id === child.id));
    return [p(detail(partner)), p(`${rel.type === "spouse" ? "Marriage" : "Partnership"}${rel.status ? `: ${rel.status}` : ""}${rel.startDate ? ` | From: ${rel.startDate}` : ""}${rel.endDate ? ` | Until: ${rel.endDate}` : ""}`), ...commonChildren.map(child => fact("Child", detail(child)))];
  }));
  section("Parents", parents(person.id).map(parent => {
    const link = relationships.find(r => r.type === "parent-child" && r.fromId === parent.id && r.toId === person.id);
    const role = link?.parentRole;
    return fact(`${role === "mother" ? "Mother (maternal)" : role === "father" ? "Father (paternal)" : "Parent (side not recorded)"} | ${PARENTAGE_LABELS[link?.parentage || "unspecified"]}`, detail(parent));
  }));
  section("Children", children(person.id).map(child => p(detail(child))));
  for (const direction of ["Ancestors", "Descendants"]) {
    const generations = Math.max(1, Math.min(10, (direction === "Ancestors" ? options.ancestorGenerations : options.descendantGenerations) ?? options.generations ?? 3));
    let current = [person], visited = new Set([person.id]); const rows: JSONContent[] = [];
    for (let generation = 1; generation <= generations; generation++) {
      const next = [...new Map(current.flatMap(p => direction === "Ancestors" ? parents(p.id) : children(p.id)).filter(p => !visited.has(p.id)).map(p => [p.id, p])).values()];
      if (!next.length) break;
      next.forEach(p => visited.add(p.id));
      rows.push(heading(`Generation ${generation}`, 3), ...next.map(p => fact(direction === "Ancestors" ? "Ancestor" : "Descendant", detail(p))));
      current = next;
    }
    section(direction, rows);
  }
  const nestedOptions = { ...options, sections: undefined };
  section("Narrative Report", nestedReportContent((buildCatalogReport(state, treeId, "Narrative Report", person.id, nestedOptions)?.content || []).slice(3)));
  section("Hourglass Chart", nestedReportContent((buildCatalogReport(state, treeId, "Hourglass Chart", person.id, nestedOptions)?.content || []).slice(3)));
  section("Notes", [p(person.notes || "No notes recorded."), fact("Labels", person.labels.join(", ") || "None recorded")]);
  const sourceIds = new Set([...person.sourceIds, ...events.flatMap(e => e.sourceIds), ...person.facts.filter(f => !f.private || options.includePrivate).flatMap(f => f.sourceIds), ...medicalRecords.flatMap(record => record.sourceIds), ...relationships.filter(r => [r.fromId, r.toId].includes(person.id) && people.some(p => p.id === r.fromId && visible(p)) && people.some(p => p.id === r.toId && visible(p))).flatMap(r => r.sourceIds), ...state.records.filter(r => r.treeId === treeId && r.personId === person.id).flatMap(r => r.sourceId ? [r.sourceId] : [])]);
  section("Sources", state.sources.filter(s => s.treeId === treeId && sourceIds.has(s.id)).map(s => p(s.citation || s.title)));
  section("Citations", state.sources.filter(s => s.treeId === treeId && sourceIds.has(s.id)).flatMap((s, index) => {
    const uses = [person.sourceIds.includes(s.id) ? "Person record" : "", ...events.filter(e => e.sourceIds.includes(s.id)).map(e => `${e.type}${e.date ? ` (${e.date})` : ""}`), ...person.facts.filter(f => (!f.private || options.includePrivate) && f.sourceIds.includes(s.id)).map(f => f.type)].filter(Boolean);
    return [p(`[${index + 1}] ${s.citation || s.title}${s.url ? ` ${s.url}` : ""}`), ...(uses.length ? [p(`Cited by: ${uses.join("; ")}.`)] : [])];
  }));
  if (options.includeHistory !== false) section("World History", nestedReportContent(historyReportDocument(state, treeId, person.id, options).content!.slice(1)));
  if (options.includePrivate) {
    section("Accessibility and Personal Needs (Private)", (person.accessNeeds || []).map(need => fact(need.label, need.detail || "No additional detail")));
    const governmentFiles = state.media.filter(item => item.treeId === treeId && item.tags.includes("government-file") && item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === person.id));
    section("Government and Sensitive Details (Private)", [
      ...Object.entries(person.government).filter(([, value]) => !!value).map(([key, value]) => fact(fieldLabel(key), typeof value === "boolean" ? "Yes" : String(value))),
      ...governmentFiles.map(file => fact("Government file", `${file.title}${file.tags.length ? ` | ${file.tags.filter(tag => tag !== "government-file").join(", ")}` : ""}`))
    ]);
  }
  const linkedRelationships = relationships.filter(r => [r.fromId, r.toId].includes(person.id) && people.some(p => p.id === r.fromId && visible(p)) && people.some(p => p.id === r.toId && visible(p)));
  const linkedFamilies = state.families.filter(family => family.treeId === treeId && [...family.partnerIds, ...family.childIds].includes(person.id));
  const protection = protectionReportContent(state, treeId, { personIds: [person.id], familyIds: linkedFamilies.map(family => family.id), relationshipIds: linkedRelationships.map(r => r.id) }, options);
  if (protection.length) section("Protection and Care Records", protection);
  const meanings = reportTermMeanings(linkedRelationships.flatMap(r => [r.type, r.subtype, r.status, r.parentage]), state.customFactTerms);
  if (meanings.length) section("Term Meanings", meanings);
  section("Kinship Explanations", [p(`The following relatives are described from ${name(person)}'s point of view.`)]);
  const kinship = kinshipDocument(state, treeId, person.id, { ...options, comparisonId: undefined, onlyRelated: true }, false);
  content.push(...nestedReportContent((kinship.content || []).slice(1)));
  content.push(p(`Tree: ${state.trees.find(t => t.id === treeId)?.title || "Untitled"}`), p(`Prepared: ${new Date().toLocaleString()} | Private details: ${options.includePrivate ? "included" : "hidden"}`));
  return { type: "doc", content };
}

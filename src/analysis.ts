import {
  AppState,
  DnaMatch,
  EntityKind,
  fullName,
  Person,
  Relationship,
  birthYear,
  deathYear,
  REPORT_TYPES,
  LIST_TYPES
} from "./domain";
import { generateKinshipReport, KinshipOptions } from "./kinship";
import { reportThreshold, localToday } from "./reportFacts";
import { ageInterval, dateInterval } from "./reportDates";
import type { ReportOptions } from "./reportOptions";

export type PlausibilityIssue = {
  severity: "warning" | "error";
  personId?: string;
  label: string;
  detail: string;
};

export type EvidenceWeakness =
  | "no-sources"
  | "missing-birth"
  | "missing-parents"
  | "missing-media"
  | "private-review"
  | "open-plausibility"
  | "duplicate-risk";

export type EvidenceScore = {
  person: Person;
  score: number;
  strengths: string[];
  weaknesses: Array<{ kind: EvidenceWeakness; label: string; action: string }>;
  sourceCount: number;
  eventSourceCount: number;
  mediaCount: number;
  issueCount: number;
  duplicateCount: number;
};

export type EvidenceDashboard = {
  scores: EvidenceScore[];
  averageScore: number;
  strongest: EvidenceScore[];
  needsReview: EvidenceScore[];
  sourceCoverage: number;
  sourcedEvents: number;
  totalEvents: number;
  issueCount: number;
  duplicateCount: number;
  privateReviewCount: number;
};

export const peopleInTree = (state: AppState, treeId: string) => state.people.filter((person) => person.treeId === treeId);

export const relationshipsInTree = (state: AppState, treeId: string) => state.relationships.filter((rel) => rel.treeId === treeId);

export const getParents = (state: AppState, personId: string) =>
  state.relationships
    .filter((rel) => rel.type === "parent-child" && rel.toId === personId)
    .map((rel) => state.people.find((person) => person.id === rel.fromId))
    .filter(Boolean) as Person[];

export const getChildren = (state: AppState, personId: string) =>
  state.relationships
    .filter((rel) => rel.type === "parent-child" && rel.fromId === personId)
    .map((rel) => state.people.find((person) => person.id === rel.toId))
    .filter(Boolean) as Person[];

export const getPartners = (state: AppState, personId: string) =>
  state.relationships
    .filter((rel) => ["spouse", "partner"].includes(rel.type) && (rel.fromId === personId || rel.toId === personId))
    .map((rel) => state.people.find((person) => (rel.fromId === personId ? person.id === rel.toId : person.id === rel.fromId)))
    .filter(Boolean) as Person[];

export const hasAncestryCycle = (relationships: Relationship[], proposedParentId: string, proposedChildId: string) => {
  const childMap = new Map<string, string[]>();
  relationships
    .filter((rel) => rel.type === "parent-child")
    .forEach((rel) => {
      const next = childMap.get(rel.fromId) ?? [];
      next.push(rel.toId);
      childMap.set(rel.fromId, next);
    });
  const stack = [proposedChildId];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === proposedParentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(childMap.get(current) ?? []));
  }
  return false;
};

export const runPlausibilityChecks = (state: AppState, treeId: string, thresholds: ReportOptions["thresholds"] = {}): PlausibilityIssue[] => {
  const issues: PlausibilityIssue[] = [];
  const people = peopleInTree(state, treeId);
  const rels = relationshipsInTree(state, treeId);
  const minParent = reportThreshold(thresholds.minParentAge, 12), maxParent = reportThreshold(thresholds.maxParentAge, 80);
  const minMarriage = reportThreshold(thresholds.minMarriageAge, 16), maxMarriage = reportThreshold(thresholds.maxMarriageAge, 100);
  const maxLife = reportThreshold(thresholds.maxLifespan, 120), burialDelay = reportThreshold(thresholds.burialDelayDays, 366);
  const today = dateInterval(localToday())!;
  people.forEach((person) => {
    const born = dateInterval(person.birthDate);
    const died = dateInterval(person.deathDate);
    if (born && died && died.latest < born.earliest) {
      issues.push({ severity: "error", personId: person.id, label: "Death before birth", detail: `${fullName(person)} has a death date before their birth date.` });
    }
    if (born && born.earliest > today.latest) {
      issues.push({ severity: "error", personId: person.id, label: "Future birth", detail: `${fullName(person)} has a birth date in the future.` });
    }
    if (person.living && died) {
      issues.push({ severity: "warning", personId: person.id, label: "Living person has death date", detail: `${fullName(person)} is marked living but has a death date.` });
    }
    const lifespan = ageInterval(person.birthDate, person.living ? localToday() : person.deathDate);
    if (lifespan && lifespan.min > maxLife) issues.push({ severity: "warning", personId: person.id, label: "Unusually long lifespan", detail: `${fullName(person)} has a minimum possible age of ${lifespan.min}, over the configured ${maxLife}-year threshold.` });
    for (const event of state.events.filter(e => person.eventIds.includes(e.id))) {
      const interval = dateInterval(event.date);
      if (!interval) continue;
      if (born && interval.latest < born.earliest) issues.push({ severity: "warning", personId: person.id, label: "Event before birth", detail: `${fullName(person)}: ${event.type} (${event.date}) precedes the recorded birth interval.` });
      if (/^marriage$/i.test(event.type)) {
        const age = ageInterval(person.birthDate, event.date);
        if (age && (age.max < minMarriage || age.min > maxMarriage)) issues.push({ severity: "warning", personId: person.id, label: "Unlikely marriage age", detail: `${fullName(person)} appears ${age.max < minMarriage ? `under ${minMarriage}` : `over ${maxMarriage}`} at the recorded marriage event.` });
      }
      if (died && /burial|cremation/i.test(event.type)) {
        if (interval.latest < died.earliest) issues.push({ severity: "error", personId: person.id, label: "Burial before death", detail: `${fullName(person)}: ${event.type} is dated ${event.date}, before death on ${person.deathDate}.` });
        else if ((interval.earliest - died.latest) / 86400000 > burialDelay) issues.push({ severity: "warning", personId: person.id, label: "Burial long after death", detail: `${fullName(person)}: ${event.type} is more than ${burialDelay} days after death. Check the record; delayed burial or reburial may be valid.` });
      }
    }
    if (!person.sourceIds.length && !person.facts.some(f => f.sourceIds.length) && !state.events.some(e => person.eventIds.includes(e.id) && e.sourceIds.length)) {
      issues.push({ severity: "warning", personId: person.id, label: "Needs source", detail: `${fullName(person)} has no person-level source or event source.` });
    }
    const parents = getParents(state, person.id).filter(parent => parent.treeId === treeId);
    parents.forEach((parent) => {
      const parentBorn = dateInterval(parent.birthDate);
      if (born && parentBorn && parentBorn.earliest > born.latest) issues.push({ severity: "error", personId: person.id, label: "Parent born after child", detail: `${fullName(parent)} has a birth interval after ${fullName(person)}'s birth interval.` });
      const age = ageInterval(parent.birthDate, person.birthDate);
      if (age && (age.max < minParent || age.min > maxParent)) {
        issues.push({ severity: "warning", personId: person.id, label: "Unlikely parent age", detail: `${fullName(parent)} appears ${age.max < minParent ? `under ${minParent}` : `over ${maxParent}`} at ${fullName(person)}'s birth. This checks a recorded parent link, not biological parentage.` });
      }
      const parentDied = dateInterval(parent.deathDate);
      if (born && parentDied && (born.earliest - parentDied.latest) / 86400000 > 366) {
        issues.push({ severity: "warning", personId: person.id, label: "Birth after parent death", detail: `${fullName(person)} was born more than a year after ${fullName(parent)} died.` });
      }
    });
  });
  rels.forEach((rel) => {
    if (["spouse", "partner"].includes(rel.type)) {
      const start = dateInterval(rel.startDate || ""), end = dateInterval(rel.endDate || "");
      if (start && end && end.latest < start.earliest) issues.push({ severity: "error", label: "Union ends before it starts", detail: "A recorded union end interval precedes its start interval." });
      if (rel.type === "spouse") for (const person of people.filter(p => [rel.fromId, rel.toId].includes(p.id))) {
        const age = ageInterval(person.birthDate, rel.startDate || "");
        if (age && (age.max < minMarriage || age.min > maxMarriage)) issues.push({ severity: "warning", personId: person.id, label: "Unlikely marriage age", detail: `${fullName(person)} appears ${age.max < minMarriage ? `under ${minMarriage}` : `over ${maxMarriage}`} at the recorded marriage.` });
      }
    }
    if (rel.type === "parent-child" && hasAncestryCycle(rels.filter((candidate) => candidate.id !== rel.id), rel.fromId, rel.toId)) {
      issues.push({ severity: "error", personId: rel.toId, label: "Ancestry cycle", detail: "This parent-child chain loops back on itself." });
    }
  });
  state.families.filter((family) => family.treeId === treeId).forEach((family) => {
    family.partnerIds.forEach((partnerId) => {
      if (!people.some((person) => person.id === partnerId)) {
        issues.push({ severity: "error", label: "Mismatched family partner", detail: `${family.name} references a missing partner.` });
      }
    });
    family.childIds.forEach((childId) => {
      if (!people.some((person) => person.id === childId)) {
        issues.push({ severity: "error", label: "Mismatched family child", detail: `${family.name} references a missing child.` });
      }
    });
  });
  return issues;
};

export const findDuplicateCandidates = (state: AppState, treeId: string) => {
  const people = peopleInTree(state, treeId);
  const pairs: Array<{ a: Person; b: Person; reason: string }> = [];
  people.forEach((a, index) => {
    people.slice(index + 1).forEach((b) => {
      const sameName = fullName(a).toLowerCase() === fullName(b).toLowerCase();
      const closeBirth = !a.birthDate || !b.birthDate || a.birthDate.slice(0, 4) === b.birthDate.slice(0, 4);
      const aliasOverlap = a.aliases.some((alias) => b.aliases.map((item) => item.toLowerCase()).includes(alias.toLowerCase()));
      if ((sameName && closeBirth) || aliasOverlap) {
        pairs.push({ a, b, reason: aliasOverlap ? "Alias overlap" : "Same name and matching birth year" });
      }
    });
  });
  return pairs;
};

export const buildEvidenceDashboard = (state: AppState, treeId: string): EvidenceDashboard => {
  const people = peopleInTree(state, treeId);
  const issues = runPlausibilityChecks(state, treeId);
  const duplicates = findDuplicateCandidates(state, treeId);
  const scores = people.map((person): EvidenceScore => {
    const personIssues = issues.filter(issue => issue.personId === person.id);
    const personDuplicates = duplicates.filter(pair => pair.a.id === person.id || pair.b.id === person.id);
    const events = state.events.filter(event => person.eventIds.includes(event.id));
    const sourcedEvents = events.filter(event => event.sourceIds.length);
    const parents = getParents(state, person.id).filter(parent => parent.treeId === treeId);
    const sourceCount = new Set([...person.sourceIds, ...person.facts.flatMap(fact => fact.sourceIds), ...events.flatMap(event => event.sourceIds)]).size;
    const mediaCount = new Set([...person.mediaIds, ...events.flatMap(event => event.mediaIds)]).size;
    const strengths: string[] = [];
    const weaknesses: EvidenceScore["weaknesses"] = [];
    let score = 30;
    if (person.birthDate) { score += 10; strengths.push("Birth date recorded"); }
    else weaknesses.push({ kind: "missing-birth", label: "Birth missing", action: "Find a birth, baptism, census or civil registration record." });
    if (parents.length) { score += 10; strengths.push(`${parents.length} parent link${parents.length === 1 ? "" : "s"}`); }
    else weaknesses.push({ kind: "missing-parents", label: "Parents missing", action: "Create a research task for parentage evidence before extending this line." });
    if (sourceCount) { score += Math.min(25, sourceCount * 8); strengths.push(`${sourceCount} source link${sourceCount === 1 ? "" : "s"}`); }
    else weaknesses.push({ kind: "no-sources", label: "No sources", action: "Attach one cited source before sharing this profile." });
    if (events.length && sourcedEvents.length === events.length) { score += 10; strengths.push("All events sourced"); }
    else if (events.length) weaknesses.push({ kind: "no-sources", label: "Unsourced events", action: "Review events without citations and attach evidence." });
    if (mediaCount) { score += 5; strengths.push(`${mediaCount} media item${mediaCount === 1 ? "" : "s"}`); }
    else weaknesses.push({ kind: "missing-media", label: "No media", action: "Add a photo, document scan, interview clip or PDF record." });
    if (person.private || person.accessNeeds?.length || person.government.protectiveServices || person.government.custodyRemoved) {
      weaknesses.push({ kind: "private-review", label: "Sensitive profile", action: "Review private annotations before export or inviting relatives." });
    } else {
      score += 5;
    }
    if (personIssues.length) {
      score -= personIssues.filter(issue => issue.severity === "error").length * 18 + personIssues.filter(issue => issue.severity === "warning").length * 9;
      weaknesses.push({ kind: "open-plausibility", label: `${personIssues.length} plausibility issue${personIssues.length === 1 ? "" : "s"}`, action: "Resolve date, relationship or source contradictions." });
    }
    if (personDuplicates.length) {
      score -= personDuplicates.length * 10;
      weaknesses.push({ kind: "duplicate-risk", label: "Duplicate candidate", action: "Compare facts and sources before merging." });
    }
    return {
      person,
      score: Math.max(0, Math.min(100, score)),
      strengths,
      weaknesses,
      sourceCount,
      eventSourceCount: sourcedEvents.length,
      mediaCount,
      issueCount: personIssues.length,
      duplicateCount: personDuplicates.length
    };
  }).sort((a, b) => a.score - b.score || fullName(a.person).localeCompare(fullName(b.person)));
  const treeEvents = state.events.filter(event => people.some(person => person.eventIds.includes(event.id)));
  const sourcedEvents = treeEvents.filter(event => event.sourceIds.length);
  return {
    scores,
    averageScore: scores.length ? Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length) : 0,
    strongest: [...scores].sort((a, b) => b.score - a.score).slice(0, 3),
    needsReview: scores.filter(entry => entry.weaknesses.length).slice(0, 8),
    sourceCoverage: people.length ? Math.round(scores.filter(entry => entry.sourceCount > 0).length / people.length * 100) : 0,
    sourcedEvents: sourcedEvents.length,
    totalEvents: treeEvents.length,
    issueCount: issues.length,
    duplicateCount: duplicates.length,
    privateReviewCount: scores.filter(entry => entry.weaknesses.some(weakness => weakness.kind === "private-review")).length
  };
};

export const buildResearchQuestions = (state: AppState, person: Person) => {
  const questions: string[] = [];
  if (!person.birthDate) questions.push(`Find a birth or baptism record for ${fullName(person)}.`);
  if (!person.deathDate && !person.living) questions.push(`Find a death or burial record for ${fullName(person)}.`);
  if (!getParents(state, person.id).length) questions.push(`Identify parents for ${fullName(person)} using census, civil, or DNA evidence.`);
  if (!getPartners(state, person.id).length) questions.push(`Look for marriage, partnership, or divorce records for ${fullName(person)}.`);
  if (!person.sourceIds.length) questions.push(`Attach at least one source citation to ${fullName(person)}.`);
  if (!person.mediaIds.length) questions.push(`Add photographs, documents, or recorded stories for ${fullName(person)}.`);
  if (person.government.protectiveServices || person.government.custodyRemoved) {
    questions.push(`Review private custody and protective-services notes for ${fullName(person)} before sharing or exporting.`);
  }
  if (!questions.length) questions.push(`${fullName(person)} has the core profile fields covered. Next: confirm citations and enrich life events.`);
  return questions;
};

export const buildSmartFilters = (state: AppState, treeId: string) => {
  const people = peopleInTree(state, treeId);
  return [
    { id: "living", label: "Living people", people: people.filter((person) => person.living) },
    { id: "private", label: "Private profiles", people: people.filter((person) => person.private) },
    { id: "unsourced", label: "Unsourced profiles", people: people.filter((person) => !person.sourceIds.length) },
    { id: "dna", label: "DNA-related profiles", people: people.filter((person) => person.labels.includes("DNA tested") || person.facts.some((fact) => fact.type.toLowerCase().includes("dna"))) },
    { id: "government", label: "Government or custody details", people: people.filter((person) => person.government.governmentEvents || person.government.protectiveServices || person.government.custodyRemoved || person.government.criminalRecord) },
    { id: "anniversary", label: "Upcoming anniversaries", people: people.filter((person) => person.birthDate && person.birthDate.slice(5, 7) === new Date().toISOString().slice(5, 7)) }
  ];
};

export const timelineItems = (state: AppState, treeId: string) =>
  state.events
    .filter((event) => state.people.some((person) => person.treeId === treeId && person.eventIds.includes(event.id)) || state.families.some((family) => family.treeId === treeId && family.eventIds.includes(event.id)))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

export const buildAutoClusters = (matches: DnaMatch[]) => {
  const clusters = new Map<string, DnaMatch[]>();
  matches.forEach((match) => {
    const key = match.surnames[0] || match.locations[0] || match.side || "Unclustered";
    clusters.set(key, [...(clusters.get(key) ?? []), match]);
  });
  return Array.from(clusters.entries()).map(([label, items]) => ({ label, items, totalCm: items.reduce((sum, item) => sum + item.sharedCm, 0) }));
};

export const buildChromosomeRows = (matches: DnaMatch[]) => {
  const chromosomes = Array.from({ length: 22 }, (_, index) => String(index + 1));
  return chromosomes.map((chromosome) => ({
    chromosome,
    segments: matches.flatMap((match) => match.segments.filter((segment) => segment.chromosome === chromosome).map((segment) => ({ ...segment, matchName: match.matchName })))
  }));
};

export const formatEntityReference = (kind: EntityKind, id: string, state: AppState) => {
  if (kind === "person") return fullName(state.people.find((person) => person.id === id));
  if (kind === "family") return state.families.find((family) => family.id === id)?.name ?? "Family";
  if (kind === "source") return state.sources.find((source) => source.id === id)?.title ?? "Source";
  if (kind === "place") return state.places.find((place) => place.id === id)?.name ?? "Place";
  if (kind === "media") return state.media.find((media) => media.id === id)?.title ?? "Media";
  if (kind === "tree") return state.trees.find((tree) => tree.id === id)?.title ?? "Tree";
  return id;
};

export const generateReportBody = (state: AppState, treeId: string, type: string, personId?: string, options: KinshipOptions = {}) => {
  if (type === "Kinship Report") return generateKinshipReport(state, treeId, personId, options);
  const person = state.people.find((candidate) => candidate.id === personId && candidate.treeId === treeId) ?? peopleInTree(state, treeId)[0];
  const lines: string[] = [];
  const tree = state.trees.find((candidate) => candidate.id === treeId);
  lines.push(`${type || REPORT_TYPES[0]}`);
  lines.push(`Tree: ${tree?.title ?? "Untitled tree"}`);
  lines.push(`Prepared: ${new Date().toLocaleString()}`);
  lines.push("");

  if (type.includes("List")) {
    return generateListBody(state, treeId, type);
  }
  if (!person) return lines.concat("No person selected.").join("\n");

  const parents = getParents(state, person.id).map(fullName).join(", ") || "Unknown";
  const partners = getPartners(state, person.id).map(fullName).join(", ") || "None recorded";
  const children = getChildren(state, person.id).map(fullName).join(", ") || "None recorded";
  const events = person.eventIds.map((id) => state.events.find((event) => event.id === id)).filter(Boolean);
  const sources = person.sourceIds.map((id) => state.sources.find((source) => source.id === id)).filter(Boolean);

  if (type === "Family Tree Book") {
    peopleInTree(state, treeId).forEach((entry) => {
      lines.push(fullName(entry));
      lines.push(`Birth: ${entry.birthDate || "Unknown"}    Death: ${entry.deathDate || (entry.living ? "Living" : "Unknown")}`);
      lines.push(`Biography: ${entry.biography || "No biography yet."}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  lines.push(`Person: ${fullName(person)}`);
  lines.push(`Gender symbol: ${person.gender === "female" ? "Venus" : person.gender === "male" ? "Mars" : person.gender === "nonbinary" ? "Combined" : "Unknown"}`);
  lines.push(`Birth: ${person.birthDate || "Unknown"}`);
  lines.push(`Death: ${person.deathDate || (person.living ? "Living" : "Unknown")}`);
  lines.push(`Parents: ${parents}`);
  lines.push(`Partners: ${partners}`);
  lines.push(`Children: ${children}`);
  lines.push(`Labels: ${person.labels.join(", ") || "None"}`);
  lines.push("");
  lines.push("Biography");
  lines.push(person.biography || "No biography entered.");
  lines.push("");
  lines.push("Events");
  events.forEach((event) => lines.push(`- ${event!.type}: ${event!.date || "undated"} ${event!.description}`));
  if (!events.length) lines.push("- No events recorded.");
  lines.push("");
  lines.push("Facts");
  person.facts.forEach((fact) => lines.push(`- ${fact.type}: ${fact.value}`));
  if (!person.facts.length) lines.push("- No facts recorded.");
  lines.push("");
  lines.push("Sources");
  sources.forEach((source) => lines.push(`- ${source!.citation || source!.title}`));
  if (!sources.length) lines.push("- No sources attached.");
  lines.push("");
  lines.push("Government and Sensitive Details");
  lines.push(person.government.governmentEvents || person.government.protectiveServices || person.government.custodyRemoved || person.government.criminalRecord
    ? [
        person.government.governmentEvents && `Government events: ${person.government.governmentEvents}`,
        person.government.protectiveServices && "Protective services: yes",
        person.government.custodyRemoved && "Custody removed from parents: yes",
        person.government.criminalRecord && `Criminal record: ${person.government.criminalRecord}`,
        person.government.agency && `Agency: ${person.government.agency}`,
        person.government.caseNumber && `Case number: ${person.government.caseNumber}`
      ].filter(Boolean).join("\n")
    : "No government or custody details recorded.");

  if (type === "Map Report") {
    lines.push("");
    lines.push("Mapped Places");
    state.places.filter((place) => place.treeId === treeId).forEach((place) => lines.push(`- ${place.name}: ${place.latitude}, ${place.longitude}`));
  }
  if (type === "Timeline Report") {
    lines.push("");
    lines.push("Timeline");
    timelineItems(state, treeId).forEach((event) => lines.push(`- ${event.date}: ${event.type} - ${event.description}`));
  }
  if (type === "Status Report") {
    lines.push("");
    lines.push("Plausibility Issues");
    runPlausibilityChecks(state, treeId).forEach((issue) => lines.push(`- ${issue.severity.toUpperCase()}: ${issue.label} - ${issue.detail}`));
  }
  return lines.join("\n");
};

export const generateListBody = (state: AppState, treeId: string, type: string) => {
  const people = peopleInTree(state, treeId);
  const lines = [`${type || LIST_TYPES[0]}`, `Tree: ${state.trees.find((tree) => tree.id === treeId)?.title ?? "Untitled tree"}`, ""];
  switch (type) {
    case "Events List":
      state.events.forEach((event) => lines.push(`${event.date || "undated"} | ${event.type} | ${event.description}`));
      break;
    case "Facts List":
      people.forEach((person) => person.facts.forEach((fact) => lines.push(`${fullName(person)} | ${fact.type} | ${fact.value}`)));
      break;
    case "Distinctive Persons List":
      people.filter((person) => person.labels.length || person.private || person.government.protectiveServices).forEach((person) => lines.push(`${fullName(person)} | ${person.labels.join(", ") || "Sensitive/private"}`));
      break;
    case "Plausibility Report":
      runPlausibilityChecks(state, treeId).forEach((issue) => lines.push(`${issue.severity.toUpperCase()} | ${issue.label} | ${issue.detail}`));
      break;
    case "Anniversary List":
      people.filter((person) => person.birthDate).forEach((person) => lines.push(`${person.birthDate.slice(5)} | ${fullName(person)} birthday`));
      break;
    case "Places List":
      state.places.filter((place) => place.treeId === treeId).forEach((place) => lines.push(`${place.name} | ${place.latitude}, ${place.longitude} | ${place.address}`));
      break;
    case "Person Analysis":
      people.forEach((person) => lines.push(`${fullName(person)} | sources ${person.sourceIds.length} | events ${person.eventIds.length} | media ${person.mediaIds.length}`));
      break;
    case "Marriage List":
    case "Marriages List":
      state.events.filter((event) => event.type.toLowerCase().includes("marriage")).forEach((event) => lines.push(`${event.date || "undated"} | ${event.description}`));
      break;
    case "ToDo List":
      state.todos.filter((todo) => todo.treeId === treeId).forEach((todo) => lines.push(`${todo.priority} | ${todo.status} | ${todo.title}`));
      break;
    case "Sources List":
      state.sources.filter((source) => source.treeId === treeId).forEach((source) => lines.push(`${source.title} | ${source.citation}`));
      break;
    case "LDS Ordinances List":
      people.forEach((person) => {
        const ordinance = person.facts.find((fact) => fact.type.toLowerCase().includes("ordinance"));
        lines.push(`${fullName(person)} | ${ordinance?.value ?? "No ordinance status entered"}`);
      });
      break;
    case "Changes List":
      state.changes.filter((change) => !change.treeId || change.treeId === treeId).forEach((change) => lines.push(`${change.at} | ${change.label}`));
      break;
    default:
      people.forEach((person) => lines.push(`${fullName(person)} | ${person.birthDate || "unknown birth"} | ${person.living ? "living" : person.deathDate || "deceased"}`));
  }
  return lines.join("\n");
};

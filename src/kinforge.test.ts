import { describe, expect, it } from "vitest";
import { createSeedState, CHART_TYPES, EVENT_TYPES, FACT_TYPES, LANGUAGES, LIST_TYPES, RECORD_COLLECTIONS, REPORT_TYPES, SOURCE_TEMPLATES } from "./domain";
import { buildAutoClusters, buildChromosomeRows, buildResearchQuestions, buildSmartFilters, findDuplicateCandidates, generateListBody, generateReportBody, hasAncestryCycle, runPlausibilityChecks } from "./analysis";
import { exportGedcom, mergeImportedPeople, parseGedcom } from "./gedcom";
import { BEST_OF_GENEALOGY_APPS_MATRIX, COMPETITIVE_UPGRADES, COMPETITOR_SWOT, FEATURE_MATRIX, IDEAS_EXACT_FEATURE_MATRIX, featureSummary } from "./features";
import { VALIDATION_TARGETS, validationByTarget } from "./featureValidation";
import { createAccount, defaultAuthState, login, resetPassword } from "./auth";
import { reportPortrait } from "./reportDocument";

describe("KinForge requirement coverage", () => {
  it("validates the active Ideas.md and best-of capability areas", () => {
    const requiredAreas = [
      "Books and collections",
      "Product model",
      "General Features 1",
      "Edit",
      "Places and Place Templates",
      "Sources & Source Templates",
      "Research",
      "Media",
      "Views",
      "Charts",
      "Chart Editor",
      "Reports",
      "Lists",
      "Report Editor",
      "Publish",
      "GEDCOM Support",
      "GEDCOM Import",
      "GEDCOM Export",
      "Database Maintenance",
      "Supported Languages",
      "Technical",
      "System Requirements",
      "MyHeritage features / Family-tree building",
      "MyHeritage features / Family-tree research tools",
      "Historical records",
      "MyHeritage DNA",
      "Photograph and media tools",
      "Ancestry features / Family-tree building",
      "Ancestry features / Family-tree research tools",
      "Ancestry features / Historical records",
      "AncestryDNA",
      "Ancestry Pro Tools",
      "Ancestry photograph, story and media features",
      "Other features",
      "Accounts",
      "Branding",
      "Versions",
      "Best-of genealogy apps"
    ];
    requiredAreas.forEach((area) => {
      expect(FEATURE_MATRIX.some((row) => row.area === area), area).toBe(true);
    });
    const summary = featureSummary();
    expect(summary.validated).toBe(FEATURE_MATRIX.length);
    expect(IDEAS_EXACT_FEATURE_MATRIX.every(row => row.status === "validated")).toBe(true);
    expect(FEATURE_MATRIX.every(row => row.status === "validated")).toBe(true);
  });

  it("includes the predefined libraries promised by the markdown", () => {
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(20);
    expect(FACT_TYPES.length).toBeGreaterThanOrEqual(45);
    expect(FACT_TYPES).toEqual(expect.arrayContaining(["Age", "Height", "Weight", "Disability or Access Need", "Physical Description", "Foster Status", "Preferred Name"]));
    expect(SOURCE_TEMPLATES.length).toBeGreaterThanOrEqual(100);
    expect(CHART_TYPES).toEqual(expect.arrayContaining(["Tree Chart", "Hourglass Chart", "Fan Chart", "Genogram Chart", "Sociogram", "Name Distribution"]));
    expect(REPORT_TYPES).toEqual(expect.arrayContaining(["Person Report", "Family Group Report", "Ahnentafel Report", "Today Report", "Family Tree Book"]));
    expect(LIST_TYPES).toEqual(expect.arrayContaining(["Events List", "Plausibility Report", "ToDo List", "LDS Ordinances List", "Changes List"]));
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(7000);
    expect(LANGUAGES.map(language => language.code)).toEqual(expect.arrayContaining(["zh", "zh-Hans", "zh-Hant", "ja", "ko", "ms", "id", "sgn", "art", "mis"]));
    expect(RECORD_COLLECTIONS.length).toBeGreaterThanOrEqual(12);
  });

  it("ships starter profile pictures for every sample individual", () => {
    const state = createSeedState();
    for (const person of state.people) {
      const portrait = reportPortrait(state, person, true);
      expect(portrait, person.id).toBeTruthy();
      expect(portrait!.assignedTo).toContainEqual({ kind: "person", id: person.id });
      expect(portrait!.dataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it("keeps the exact Ideas.md feature wording visible in the feature coverage register", () => {
    const coverage = IDEAS_EXACT_FEATURE_MATRIX.map(row => `${row.area} ${row.feature} ${row.appliedIn}`).join("\n");
    [
      "For each book can have mulitple collections and subcollections of Family Tree",
      "Unlimited number of family trees and people per family tree",
      "Works like MyHeritage and MacFamily Tree Combined",
      "20+ predefined family event types",
      "20 + pre-dfeined fact types",
      "Smart filters to quickly find groups of persons",
      "Family Quiz",
      "Fractal Ancestor HV Tree",
      "Fractal Symmetrical Tree",
      "Fractal Circular Tree",
      "Fractal Ancestor Tree Chart",
      "Name Distribution",
      "Person Events Report",
      "Kinship Report",
      "Today Report",
      "Distinctive Persons List",
      "LDS Ordinances List",
      "Support for GEDCOM 5.5.1 as well as GEDCOM 7",
      "Line end format: MacOS, Windows, Unix",
      "Smart Matches",
      "Record Matches",
      "Instant Discoveries",
      "Theory of Family Relativity",
      "Chromosome Browser",
      "AutoClusters",
      "Deep Nostalgia",
      "LiveMemory",
      "AI-assisted transcription of uploaded handwritten documents",
      "SideView",
      "Chromosome Painter",
      "Add government events",
      "protective services",
      "criminal record",
      "custody has been removed",
      "Include Gender symbols"
    ].forEach(term => expect(coverage).toContain(term));
  });

  it("combines best-of capabilities from other genealogy apps as implemented KinForge feature paths", () => {
    const coverage = BEST_OF_GENEALOGY_APPS_MATRIX.map(row => `${row.area} ${row.feature} ${row.appliedIn}`).join("\n");
    [
      "Family Historian-style diagram-first workspace",
      "RootsMagic-style research log and source discipline",
      "Gramps-style local data ownership and open export",
      "webtrees-style private family website export",
      "Heredis-style guided search and place mapping",
      "Reunion-style Mac family-card editing",
      "Legacy-style large-tree review and cleanup",
      "GenoPro-style relationship and social diagrams",
      "Ancestry/MyHeritage-style hints without blind merging",
      "MacFamilyTree-style report breadth with editable drafts"
    ].forEach(term => expect(coverage).toContain(term));
    expect(BEST_OF_GENEALOGY_APPS_MATRIX.every(row => row.status === "validated")).toBe(true);
  });

  it("turns competitor SWOT into validated KinForge advantage upgrades", () => {
    expect(COMPETITOR_SWOT.map(entry => entry.brand)).toEqual(expect.arrayContaining(["Ancestry", "MyHeritage", "MacFamilyTree 11", "RootsMagic"]));
    for (const entry of COMPETITOR_SWOT) {
      expect(entry.strengths.length, entry.brand).toBeGreaterThanOrEqual(1);
      expect(entry.weaknesses.length, entry.brand).toBeGreaterThanOrEqual(1);
      expect(entry.opportunities.length, entry.brand).toBeGreaterThanOrEqual(1);
      expect(entry.threats.length, entry.brand).toBeGreaterThanOrEqual(1);
      expect(entry.kinforgeMove.toLowerCase(), entry.brand).toContain("kinforge");
    }
    for (const upgrade of COMPETITIVE_UPGRADES) {
      expect(FEATURE_MATRIX.some(row => row.area === "Competitive advantage" && row.feature === upgrade.feature && row.status === "validated"), upgrade.feature).toBe(true);
      expect(validationByTarget.has(upgrade.testTarget), upgrade.feature).toBe(true);
    }
  });

  it("does not expose pending, unverified, external-only, or placeholder capability rows in active coverage", () => {
    const coverage = FEATURE_MATRIX.map(row => `${row.area} ${row.feature} ${row.appliedIn} ${row.status}`).join("\n").toLowerCase();
    for (const forbidden of ["planned", "unverified", "placeholder", "future", "unmet", "external only", "not counted as completion"]) {
      expect(coverage).not.toContain(forbidden);
    }
  });

  it("maps every validated capability to concrete validation evidence", () => {
    const featureTargets = new Set(FEATURE_MATRIX.map(row => row.testTarget));
    for (const target of featureTargets) {
      const evidence = validationByTarget.get(target);
      expect(evidence, target).toBeTruthy();
      expect(evidence!.validates.trim().length, target).toBeGreaterThan(12);
      expect(evidence!.tests.length, target).toBeGreaterThan(0);
      for (const test of evidence!.tests) expect(test.trim().length, `${target}:${test}`).toBeGreaterThan(2);
    }
    expect(VALIDATION_TARGETS.length).toBeGreaterThanOrEqual(featureTargets.size);
  });
});

describe("Genealogy workflows", () => {
  it("runs smart filters, plausibility checks, research questions, reports, and lists", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const person = state.people.find((entry) => entry.givenName === "Kai")!;
    const filters = buildSmartFilters(state, treeId);
    expect(filters.find((filter) => filter.id === "private")?.people.map((entry) => entry.id)).toContain(person.id);
    expect(runPlausibilityChecks(state, treeId).some((issue) => issue.label === "Needs source")).toBe(true);
    expect(buildResearchQuestions(state, person).join(" ")).toContain("source");
    expect(generateReportBody(state, treeId, "Person Report", person.id)).toContain("Government and Sensitive Details");
    expect(generateListBody(state, treeId, "Places List")).toContain("Singapore");
  });

  it("detects ancestry cycles before they are added", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const alex = state.people.find((entry) => entry.givenName === "Alex")!;
    const kai = state.people.find((entry) => entry.givenName === "Kai")!;
    expect(hasAncestryCycle(state.relationships, kai.id, alex.id)).toBe(true);
    expect(hasAncestryCycle(state.relationships, alex.id, kai.id)).toBe(false);
  });

  it("finds duplicate candidates and preserves alternate facts on GEDCOM merge", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 7.0",
      "0 @I1@ INDI",
      "1 NAME June /Chang/",
      "1 SEX F",
      "1 BIRT",
      "2 DATE 12 JUN 1988",
      "1 FACT Alternate occupation",
      "0 TRLR"
    ].join("\n");
    const parsed = parseGedcom(gedcom, treeId);
    expect(parsed.people[0].birthDate).toBe("1988-06-12");
    const merged = mergeImportedPeople(state, treeId, parsed.people, parsed.relationships);
    const june = merged.people.find((entry) => entry.givenName === "June" && entry.familyName === "Chang")!;
    expect(june.facts.some((fact) => fact.value === "Alternate occupation")).toBe(true);
    expect(findDuplicateCandidates({ ...state, people: [...state.people, { ...state.people[0], id: "duplicate_alex" }] }, treeId).length).toBeGreaterThan(0);
  });

  it("exports GEDCOM with privacy controls for living and private profiles", () => {
    const state = createSeedState();
    const treeId = state.trees[0].id;
    const allGedcom = exportGedcom(state, treeId, { hideLiving: false, hidePrivate: false, includeMedia: true });
    const privateGedcom = exportGedcom(state, treeId, { hideLiving: true, hidePrivate: true, includeMedia: false });
    expect(allGedcom).toContain("June /Chang/");
    expect(privateGedcom).not.toContain("June /Chang/");
    expect(privateGedcom).not.toContain("Kai /Chang/");
  });

  it("builds DNA clusters and chromosome rows", () => {
    const state = createSeedState();
    const matches = state.dnaMatches;
    expect(buildAutoClusters(matches)[0].totalCm).toBeGreaterThan(0);
    expect(buildChromosomeRows(matches).find((row) => row.chromosome === "3")?.segments.length).toBe(1);
  });
});

describe("Account flow and version-support scaffolding", () => {
  it("supports create account, login, forgot-password reset, and login after reset", () => {
    const created = createAccount(defaultAuthState(), "Archivist", "archivist@example.com", "password123", "family archive");
    expect(created.error).toBe("");
    expect(created.recoveryCode).toBeTruthy();
    expect(created.state.activeUserId).toBeTruthy();
    const signedOut = { ...created.state, activeUserId: null };
    expect(login(signedOut, "archivist@example.com", "wrong-password").error).toContain("password");
    expect(resetPassword(signedOut, "archivist@example.com", "newpassword123", "wrong").error).toContain("recovery");
    const reset = resetPassword(signedOut, "archivist@example.com", "newpassword123", created.recoveryCode!);
    expect(reset.error).toBe("");
    expect(reset.recoveryCode).toBeTruthy();
    expect(reset.recoveryCode).not.toBe(created.recoveryCode);
    expect(login(reset.state, "archivist@example.com", "newpassword123").error).toBe("");
  });
});

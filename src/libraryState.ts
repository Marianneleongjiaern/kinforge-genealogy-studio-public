import { AppState, createSeedState, defaultAccessibilityPreferences, emptyCharacterProfile, emptyDeathDetails, emptyGovernmentDetails, emptyIdentityDetails, normalizeLibraryPlacements } from "./domain";

// Local drafts, cloud snapshots and backups must all receive the same schema upgrades.
// Never fill a real library with the sample people, books or other demo records.
export function hydrateLibrary(state: AppState): AppState {
  const defaults = createSeedState();
  const next = { ...state };
  for (const key of Object.keys(defaults) as (keyof AppState)[]) {
    if (Array.isArray(defaults[key])) {
      if (next[key] == null) (next as any)[key] = [];
      else if (!Array.isArray(next[key])) throw new Error("This saved library needs repair. Your original data has been kept.");
    }
  }
  next.chartConfig = { ...defaults.chartConfig, ...state.chartConfig };
  next.accessibility = { ...defaultAccessibilityPreferences(), ...state.accessibility };
  next.people = next.people.map(person => ({
    ...person,
    aliases: person.aliases || [], labels: person.labels || [], eventIds: person.eventIds || [],
    facts: (person.facts || []).map(fact => ({ ...fact, sourceIds: fact.sourceIds || [] })),
    sourceIds: person.sourceIds || [], mediaIds: person.mediaIds || [],
    government: { ...emptyGovernmentDetails(), ...person.government },
    deathDetails: { ...emptyDeathDetails(), ...person.deathDetails },
    characterProfile: { ...emptyCharacterProfile(), ...person.characterProfile },
    identity: { ...emptyIdentityDetails(), ...person.identity, identityLabels: person.identity?.identityLabels || [] }
  }));
  next.events = next.events.map(event => ({ ...event, sourceIds: event.sourceIds || [], mediaIds: event.mediaIds || [] }));
  next.relationships = next.relationships.map(rel => ({ ...rel, subtype: rel.subtype || "" }));
  next.families = next.families.map(family => ({ ...family, familyType: family.familyType || "Family type not recorded" }));
  next.books = next.books.map(book => ({ ...book }));
  next.collections = next.collections.map(collection => ({ ...collection }));
  next.trees = next.trees.map(tree => ({ ...tree }));
  next.ideasJournal = (next.ideasJournal || []).map(entry => ({ ...entry, tags: entry.tags || [] }));
  next.userFeedback = (next.userFeedback || []).map(entry => ({ ...entry }));
  next.medicalRecords = (next.medicalRecords || []).map(record => ({
    ...record,
    conditionType: record.conditionType || "",
    disorderType: record.disorderType || "",
    bodySystem: record.bodySystem || "",
    onsetDate: record.onsetDate || "",
    reviewDate: record.reviewDate || "",
    course: record.course || "",
    progression: record.progression || "",
    triggers: record.triggers || "",
    riskFactors: record.riskFactors || "",
    differentialDiagnosis: record.differentialDiagnosis || "",
    comorbidities: record.comorbidities || "",
    complications: record.complications || "",
    hereditaryOrFamilyHistory: record.hereditaryOrFamilyHistory || "",
    prognosis: record.prognosis || "",
    careLevel: record.careLevel || "",
    emergencyPlan: record.emergencyPlan || "",
    sourceIds: record.sourceIds || [],
    mediaIds: record.mediaIds || [],
    visibility: record.visibility || "private"
  }));
  next.reportDrafts = next.reportDrafts.map(draft => ({ ...draft }));
  return normalizeLibraryPlacements(next);
}

import type { Parentage, ReportOptions, ReportPresentation } from "./reportOptions";
export { LANGUAGES, LANGUAGE_FALLBACKS, languageLabel, type LanguageOption } from "./languageCatalog";

export type Id = string;
export type SensitiveVisibility = "private" | "shared";
export type ProtectionEntityKind = "person" | "family" | "relationship";

export type ProtectionRecord = {
  id: Id;
  treeId: Id;
  entityKind: ProtectionEntityKind;
  entityId: Id;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  agency: string;
  contact: string;
  jurisdiction: string;
  caseReference: string;
  notes: string;
  sourceIds: Id[];
  mediaIds: Id[];
  visibility: SensitiveVisibility;
};

export type Gender = "female" | "male" | "nonbinary" | "unknown";
export type EntityKind = "person" | "family" | "source" | "place" | "event" | "media" | "tree";

export type Book = {
  id: Id;
  title: string;
  description: string;
};

export type Collection = {
  id: Id;
  bookId: Id;
  parentId?: Id;
  name: string;
};

export type Tree = {
  id: Id;
  bookId: Id;
  collectionId?: Id;
  title: string;
  author: string;
  authorContact: string;
  language: string;
  citationStyle: string;
  crestMediaId?: Id;
  privacy: "private" | "invited" | "public-export";
  createdAt: string;
};

export type PersonEvent = {
  id: Id;
  type: string;
  date: string;
  placeId?: Id;
  description: string;
  sourceIds: Id[];
  mediaIds: Id[];
  private?: boolean;
};

export type PersonFact = {
  id: Id;
  type: string;
  value: string;
  date?: string;
  sourceIds: Id[];
  private?: boolean;
};

export type CustomFactTermCategory = "Religion" | "Belief" | "Religious practice" | "Mental health condition" | "Mental health support need" | "Physical condition" | "Disability or access need" | "Medical or diagnostic term" | "Identity, sexuality, or gender" | "Custom fact";

export type CustomFactTerm = {
  id: Id;
  category: CustomFactTermCategory;
  term: string;
  meaning: string;
};

export type GovernmentDetails = {
  governmentEvents: string;
  protectiveServices: boolean;
  custodyRemoved: boolean;
  custodyNotes: string;
  criminalRecord: string;
  fosterRecord: string;
  custodyChangeRecord: string;
  removalRecord: string;
  protectiveServicesRecord: string;
  personalProtectionOrderRecord: string;
  restrainingOrderRecord: string;
  houseArrestRecord: string;
  arrestRecord: string;
  agency: string;
  caseNumber: string;
  governmentFacility: string;
  governmentProtectionStatus: string;
  socialWorkerName: string;
  socialWorkerAgency: string;
  doctorName: string;
  doctorPractice: string;
  inpatientStatus: string;
  daycareStatus: string;
  careTeamNotes: string;
  birthMethod: string;
  birthAssistant: string;
  birthNotes: string;
};

export type DeathDetails = {
  deathPlace: string;
  deathHospital: string;
  deathAddress: string;
  burialType: string;
  burialDate: string;
  burialSite: string;
  cemeteryName: string;
  cemeteryAddress: string;
  cemeteryPlot: string;
  graveNumber: string;
  latitude: string;
  longitude: string;
  hasGravestone: boolean;
  gravestoneInscription: string;
  memorialUrl: string;
  funeralHome: string;
  deathNotes: string;
};

export type PersonNeed = {
  id: Id;
  glyphId: string;
  label: string;
  detail: string;
  sourceId?: Id;
  private: true;
};

export type CharacterProfile = {
  species: string;
  subspecies: string;
  speciesName: string;
  hybrid: boolean;
  hybridLineage: string;
  appearance: string;
  personality: string;
  personalityStyle: string;
  subcultureAesthetic: string;
  aestheticKeywords: string;
  abilities: string;
  relationshipDynamics: string;
  friendships: string;
  rivals: string;
  romanticOrShipNotes: string;
  foundFamily: string;
  likes: string;
  dislikes: string;
  strengths: string;
  weaknesses: string;
  goals: string;
  conflicts: string;
  backstory: string;
  affiliations: string;
  titles: string;
  canonStatus: string;
  fandomSource: string;
  culture: string;
  longFormProfile: string;
  creatorNotes: string;
  quotes: string;
  trivia: string;
  externalLinks: string;
};

export type IdentityDetails = {
  pronouns: string;
  genderIdentity: string;
  genderExpression: string;
  sexualOrientation: string;
  romanticOrientation: string;
  relationshipOrientation: string;
  identityLabels: string[];
  identityNotes: string;
  visibility: SensitiveVisibility;
};

export type Person = {
  id: Id;
  profileMediaId?: Id;
  treeId: Id;
  givenName: string;
  familyName: string;
  aliases: string[];
  gender: Gender;
  birthDate: string;
  deathDate: string;
  living: boolean;
  private: boolean;
  biography: string;
  notes: string;
  branchColor: string;
  labels: string[];
  eventIds: Id[];
  facts: PersonFact[];
  sourceIds: Id[];
  mediaIds: Id[];
  government: GovernmentDetails;
  deathDetails: DeathDetails;
  characterProfile: CharacterProfile;
  identity: IdentityDetails;
  accessNeeds?: PersonNeed[];
  // Account/library visibility for government details, sensitive facts and access annotations.
  sensitiveVisibility?: SensitiveVisibility;
};

export type RelationshipType = "parent-child" | "spouse" | "partner" | "guardian" | "sibling" | "relative";
export type ParentRole = "mother" | "father" | "parent";

export type Relationship = {
  id: Id;
  treeId: Id;
  type: RelationshipType;
  fromId: Id;
  toId: Id;
  startDate?: string;
  endDate?: string;
  status?: string;
  subtype?: string;
  parentRole?: ParentRole;
  parentage?: Parentage;
  sourceIds: Id[];
};

export type Family = {
  id: Id;
  treeId: Id;
  name: string;
  familyType?: string;
  partnerIds: Id[];
  childIds: Id[];
  eventIds: Id[];
  sourceIds: Id[];
  notes: string;
};

export type PlaceTemplate = {
  id: Id;
  name: string;
  levels: string[];
  citationPattern: string;
};

export type Place = {
  id: Id;
  treeId: Id;
  name: string;
  templateId: Id;
  address: string;
  levels: Record<string, string>;
  latitude: string;
  longitude: string;
  pointsOfInterest: string;
  wikipediaTitle: string;
  mediaIds: Id[];
  sourceIds: Id[];
  notes: string;
};

export type SourceTemplate = {
  id: Id;
  name: string;
  fields: string[];
  category: string;
};

export type Source = {
  id: Id;
  treeId: Id;
  title: string;
  templateId: Id;
  fields: Record<string, string>;
  citation: string;
  url: string;
  mediaIds: Id[];
  notes: string;
};

export type MediaItem = {
  id: Id;
  treeId: Id;
  visibility?: SensitiveVisibility;
  title: string;
  type: "picture" | "video" | "audio" | "pdf" | "website" | "document";
  dataUrl: string;
  externalUrl: string;
  assignedTo: Array<{ kind: EntityKind; id: Id }>;
  tags: string[];
  rotation: number;
  crop: string;
  colorized: boolean;
  enhanced: boolean;
  repaired: boolean;
  story: string;
  transcript: string;
  createdAt: string;
};

export type ToDo = {
  id: Id;
  treeId: Id;
  personId?: Id;
  title: string;
  status: "open" | "doing" | "done";
  priority: "low" | "normal" | "high";
  dueDate: string;
};

export type DnaSegment = {
  chromosome: string;
  start: number;
  end: number;
  side: "maternal" | "paternal" | "unknown";
};

export type DnaMatch = {
  id: Id;
  treeId: Id;
  personId?: Id;
  matchName: string;
  sharedCm: number;
  predictedRelationship: string;
  surnames: string[];
  locations: string[];
  geneticGroups: string[];
  ethnicity: string;
  side: "maternal" | "paternal" | "unknown";
  segments: DnaSegment[];
  notes: string;
};

export type HistoricalRecord = {
  id: Id;
  treeId: Id;
  personId?: Id;
  collection: string;
  title: string;
  date: string;
  placeId?: Id;
  citation: string;
  sourceId?: Id;
  transcription: string;
};

export type IdeaJournalEntry = {
  id: Id;
  treeId: Id;
  personId?: Id;
  title: string;
  category: string;
  status: "idea" | "drafting" | "canon" | "archive";
  tags: string[];
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type UserFeedbackEntry = {
  id: Id;
  treeId: Id;
  personId?: Id;
  type: "bug" | "feature" | "accessibility" | "confusing" | "performance" | "other";
  status: "new" | "reviewing" | "planned" | "done" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  body: string;
  page: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MedicalRecord = {
  id: Id;
  treeId: Id;
  personId: Id;
  type: string;
  diagnosisName: string;
  conditionCategory: string;
  conditionType: string;
  disorderType: string;
  bodySystem: string;
  diagnosisDate: string;
  onsetDate: string;
  reviewDate: string;
  diagnosticStandard: string;
  diagnosticCriteria: string;
  criteriaMet: string;
  symptomsOrTraits: string;
  functionalImpact: string;
  severity: string;
  status: string;
  course: string;
  progression: string;
  triggers: string;
  riskFactors: string;
  differentialDiagnosis: string;
  comorbidities: string;
  complications: string;
  hereditaryOrFamilyHistory: string;
  prognosis: string;
  careLevel: string;
  emergencyPlan: string;
  hospitalOrClinic: string;
  hospitalAddress: string;
  diagnosingDoctor: string;
  psychologist: string;
  psychiatrist: string;
  occupationalTherapist: string;
  physiotherapist: string;
  speechTherapist: string;
  socialWorker: string;
  otherClinicians: string;
  medications: string;
  therapies: string;
  accommodations: string;
  assistiveDevices: string;
  notes: string;
  sourceIds: Id[];
  mediaIds: Id[];
  visibility: SensitiveVisibility;
  createdAt: string;
  updatedAt: string;
};

export type ChartConfig = {
  type: string;
  orientation: "horizontal" | "vertical" | "radial";
  style: "classic" | "compact" | "documentary" | "color-branches";
  font: string;
  showLabels: boolean;
  showShadows: boolean;
  color: string;
  pageSize: "single" | "letter" | "a4" | "poster";
  extraText: string;
  lineNote: string;
  rotation: number;
};

export type AccessibilityPreferences = {
  appLanguage: string;
  fontFamily: "system" | "hyperlegible" | "dyslexia" | "dysgraphia" | "serif" | "mono";
  textScale: "normal" | "large" | "extra-large";
  colorVision: "standard" | "deuteranopia" | "protanopia" | "tritanopia" | "monochrome" | "high-contrast";
  symbolMode: "standard" | "dyslexia" | "dysgraphia" | "low-vision" | "text-first";
  symbolSize: "standard" | "large" | "extra-large";
  speechToText: boolean;
};

export type ReportDraft = {
  id: Id;
  treeId: Id;
  /** Optional library placement; older drafts inherit the tree's placement. */
  bookId?: Id;
  collectionId?: Id;
  visibility?: SensitiveVisibility;
  title: string;
  type: string;
  mode?: "report" | "list";
  personId?: Id;
  body: string;
  html?: string;
  pageSize?: "a4" | "letter";
  presentation?: ReportPresentation;
  options?: ReportOptions;
  updatedAt: string;
};

export type ChangeEntry = {
  id: Id;
  at: string;
  treeId?: Id;
  label: string;
  before?: string;
  after?: string;
};

export type AppState = {
  books: Book[];
  collections: Collection[];
  trees: Tree[];
  people: Person[];
  relationships: Relationship[];
  families: Family[];
  events: PersonEvent[];
  places: Place[];
  placeTemplates: PlaceTemplate[];
  sources: Source[];
  sourceTemplates: SourceTemplate[];
  media: MediaItem[];
  todos: ToDo[];
  dnaMatches: DnaMatch[];
  records: HistoricalRecord[];
  ideasJournal: IdeaJournalEntry[];
  userFeedback: UserFeedbackEntry[];
  protectionRecords?: ProtectionRecord[];
  medicalRecords?: MedicalRecord[];
  reportDrafts: ReportDraft[];
  labels: string[];
  customEventTypes: string[];
  customFactTypes: string[];
  customFactTerms: CustomFactTerm[];
  customFamilyTypes: string[];
  customRelationshipSubtypes: string[];
  chartConfig: ChartConfig;
  accessibility: AccessibilityPreferences;
  changes: ChangeEntry[];
};

/**
 * Brings older local/cloud snapshots into the current book -> collection -> tree/report model.
 * Placement is metadata only, so invalid legacy links are cleared without changing genealogy data.
 */
export function normalizeLibraryPlacements(state: AppState): AppState {
  const books = new Set((state.books || []).map(book => book.id));
  const fallbackBook = state.books?.[0]?.id;
  const collections = new Map((state.collections || []).map(collection => [collection.id, collection]));

  for (const collection of state.collections || []) {
    if (!books.has(collection.bookId) && fallbackBook) collection.bookId = fallbackBook;
    const parent = collection.parentId ? collections.get(collection.parentId) : undefined;
    if (!parent || parent.id === collection.id || parent.bookId !== collection.bookId) delete collection.parentId;
  }
  for (const collection of state.collections || []) {
    const visited = new Set([collection.id]);
    let current = collection;
    while (current.parentId) {
      const parent = collections.get(current.parentId);
      if (!parent || visited.has(parent.id)) { delete current.parentId; break; }
      visited.add(parent.id);
      current = parent;
    }
  }
  for (const tree of state.trees || []) {
    if (!books.has(tree.bookId) && fallbackBook) tree.bookId = fallbackBook;
    const collection = tree.collectionId ? collections.get(tree.collectionId) : undefined;
    if (!collection || collection.bookId !== tree.bookId) delete tree.collectionId;
    else if (!collection.parentId) {
      let subcollection = (state.collections || []).find(entry => entry.bookId === tree.bookId && entry.parentId === collection.id);
      if (!subcollection) {
        subcollection = { id: makeId("collection"), bookId: tree.bookId, parentId: collection.id, name: "Family trees" };
        state.collections.push(subcollection);
        collections.set(subcollection.id, subcollection);
      }
      tree.collectionId = subcollection.id;
    }
    if (!tree.collectionId && fallbackBook) {
      let parent = (state.collections || []).find(entry => entry.bookId === tree.bookId && !entry.parentId);
      if (!parent) {
        parent = { id: makeId("collection"), bookId: tree.bookId, name: "Family tree collection" };
        state.collections.push(parent);
        collections.set(parent.id, parent);
      }
      let subcollection = (state.collections || []).find(entry => entry.bookId === tree.bookId && entry.parentId === parent.id);
      if (!subcollection) {
        subcollection = { id: makeId("collection"), bookId: tree.bookId, parentId: parent.id, name: "Family trees" };
        state.collections.push(subcollection);
        collections.set(subcollection.id, subcollection);
      }
      tree.collectionId = subcollection.id;
    }
  }
  for (const draft of state.reportDrafts || []) {
    const tree = state.trees?.find(entry => entry.id === draft.treeId);
    if (!books.has(draft.bookId || "")) draft.bookId = tree?.bookId || fallbackBook;
    const collection = draft.collectionId ? collections.get(draft.collectionId) : undefined;
    if (!collection || collection.bookId !== draft.bookId) draft.collectionId = tree && tree.bookId === draft.bookId ? tree.collectionId : undefined;
  }
  return state;
}

export const nowIso = () => new Date().toISOString();
export const makeId = (prefix = "id") => `${prefix}_${crypto.randomUUID()}`;

export const PROTECTION_EVENT_TYPES = [
  "Custody Removal",
  "Custody Change",
  "Custody Restoration",
  "Government Protection Status",
  "Agency Involvement",
  "Social Worker Assignment",
  "Care Arrangement",
  "Care Team Change",
  "Foster Placement",
  "Foster Placement End",
  "Government Facility Placement",
  "Government Facility Release",
  "Personal Protection Order",
  "Restraining Order",
  "Protection Order Change",
  "Protection Order End",
  "Arrest",
  "House Arrest",
  "Inpatient Care",
  "Daycare Arrangement"
] as const;

export const EVENT_TYPES = [
  "Birth",
  "Naming",
  "Baptism",
  "Christening",
  "Blessing",
  "Adoption",
  "Guardianship",
  "Foster Care",
  "Residence",
  "Address Change",
  "Education",
  "Graduation",
  "Occupation",
  "Employment Start",
  "Employment End",
  "Retirement",
  "Immigration",
  "Emigration",
  "Naturalisation",
  "Citizenship",
  "Travel",
  "Military Service",
  "Military Enlistment",
  "Military Discharge",
  "Engagement",
  "Engagement Ended",
  "Betrothal",
  "Relationship Started",
  "Dating Started",
  "Courtship Started",
  "Relationship Milestone",
  "Breakup",
  "Partner Breakup",
  "Reconciliation",
  "Cohabitation Started",
  "Cohabitation Ended",
  "Commitment Ceremony",
  "Civil Partnership",
  "Domestic Partnership",
  "Polycule Joined",
  "Polycule Left",
  "Metamour Link",
  "Queerplatonic Partnership",
  "Relationship Agreement",
  "Relationship Status Change",
  "Marriage",
  "Marriage Banns",
  "Marriage License",
  "Separation",
  "Trial Separation",
  "Legal Separation",
  "Divorce Filing",
  "Divorce Decree",
  "Divorce",
  "Annulment",
  "Annulment Filing",
  "Partnership",
  "Civil Union",
  "Child Custody",
  "Protective Services",
  "Criminal Record",
  "Court Record",
  "Government Record",
  "Census",
  "Property",
  "Land Record",
  "Tax Record",
  "Medical Event",
  "Diagnosis Event",
  "Prescription Issued",
  "Treatment Started",
  "Treatment Ended",
  "Therapy Started",
  "Therapy Ended",
  "Hospital Admission",
  "Hospital Discharge",
  "Surgery",
  "Assessment",
  "Accessibility Accommodation Started",
  "Accessibility Aid Received",
  "Hospitalization",
  "Work Contract Signed",
  "Employment Contract",
  "Company Joined",
  "Company Left",
  "Promotion",
  "Workplace Accommodation",
  "Work Transfer",
  "Freelance Contract",
  "Character Arc",
  "Canon Event",
  "Fandom Milestone",
  "DNA Test",
  "Award",
  "Religious Event",
  "Community Event",
  "Membership",
  "Will",
  "Probate",
  "Burial",
  "Cremation",
  "Memorial",
  "Death",
  ...PROTECTION_EVENT_TYPES
];

export const FACT_TYPES = [
  "Age",
  "Age at Event",
  "Age Range",
  "Eye Color",
  "Hair Color",
  "Hair Texture",
  "Height",
  "Weight",
  "Body Type",
  "Build",
  "Complexion",
  "Skin Tone",
  "Dominant Hand",
  "Distinguishing Marks",
  "Birthmark",
  "Scar",
  "Tattoo",
  "Physical Description",
  "Blood Type",
  "Allergy",
  "Medication",
  "Medical Condition",
  "Diagnosis",
  "Diagnosis criteria",
  "Condition Type",
  "Disorder Type",
  "Body System",
  "Onset Date",
  "Review Date",
  "Care Level",
  "Physical condition",
  "Chronic condition",
  "Degenerative condition",
  "Rare disease",
  "Pain condition",
  "Trauma-related condition",
  "Neurological condition",
  "Developmental condition",
  "Physical disability",
  "Sensory disability",
  "Mobility disability",
  "Neurological disability",
  "Developmental disability",
  "Cognitive disability",
  "Communication disability",
  "Functional limitation",
  "Health support need",
  "Access accommodation",
  "Disability or Access Need",
  "Mobility Aid",
  "Assistive Technology",
  "DNA Kit",
  "Ethnicity Estimate",
  "Genetic Group",
  "Haplogroup",
  "Religion",
  "Belief",
  "Religious practice",
  "Mental health condition",
  "Mental health support need",
  "Pronouns",
  "Gender Identity",
  "Gender Expression",
  "Sexual Orientation",
  "Romantic Orientation",
  "Relationship Orientation",
  "LGBTQIA2+ Identity",
  "2SLGBTQIA+ Identity",
  "Hypersexuality",
  "Sexuality Note",
  "Identity Label",
  "Alterhuman Identity",
  "Alterhuman Branch",
  "Kintype",
  "Theriotype",
  "Otherkin Identity",
  "Therian Identity",
  "Polytherian Identity",
  "Phytanthropy",
  "Phytanthrope",
  "Phytotherian",
  "Plantkin",
  "Language",
  "Nationality",
  "Citizenship",
  "Ethnicity",
  "Clan or Tribe",
  "Education Level",
  "School",
  "Degree",
  "Occupation",
  "Employer",
  "Job Title",
  "Cause of Death",
  "Medical Note",
  "Military Rank",
  "Title",
  "Nickname",
  "Preferred Name",
  "Name Pronunciation",
  "Adopted Status",
  "Foster Status",
  "Protective Status",
  "Custody Status",
  "Criminal Case",
  "Government Identifier",
  "LDS: Baptism",
  "LDS: Confirmation",
  "LDS: Initiatory",
  "LDS: Endowment",
  "LDS: Sealing to Parents",
  "LDS: Sealing to Spouse"
];

export const FAMILY_TYPE_OPTIONS = [
  "Nuclear family",
  "Immediate family",
  "Extended family",
  "Stepfamily",
  "Blended family",
  "Foster family",
  "Adoptive family",
  "Biological family",
  "Single-parent family",
  "In-law family",
  "Chosen family",
  "Household family",
  "Guardianship family",
  "Other"
];

export const RELATIONSHIP_SUBTYPE_OPTIONS = [
  "",
  "Immediate family",
  "Extended family",
  "Biological relative",
  "Adoptive relative",
  "Foster relative",
  "Step relative",
  "Husband",
  "Wife",
  "Spouse",
  "Partner",
  "Fiance",
  "Fiancee",
  "Engaged partner",
  "Dating partner",
  "Boyfriend",
  "Girlfriend",
  "Life partner",
  "Domestic partner",
  "Civil union partner",
  "Common-law partner",
  "Polyamorous partner",
  "Multiple partner relationship",
  "Ethical non-monogamy",
  "Open relationship",
  "Polycule member",
  "Metamour",
  "Nesting partner",
  "Anchor partner",
  "Primary partner",
  "Secondary partner",
  "Queerplatonic partner",
  "Former spouse",
  "Former partner",
  "Separated spouse",
  "Annulled spouse",
  "Co-parent",
  "Ex-partner",
  "Half sibling",
  "Step sibling",
  "Foster sibling",
  "Adoptive sibling",
  "In-law",
  "Mother-in-law",
  "Father-in-law",
  "Sister-in-law",
  "Brother-in-law",
  "Child-in-law",
  "Cousin-in-law",
  "Cousin",
  "Godparent",
  "Godchild",
  "Household member",
  "Caregiver",
  "Other"
];

export const BURIAL_TYPE_OPTIONS = [
  "",
  "Burial",
  "Cremation",
  "Cemetery interment",
  "Mausoleum",
  "Columbarium",
  "Memorial only",
  "Scattering",
  "Green burial",
  "Reburial",
  "Unknown",
  "Other"
];

export const CHART_TYPES = [
  "Tree Chart",
  "Hourglass Chart",
  "Ancestor Chart",
  "Double Ancestor Chart",
  "Fan Chart",
  "Descendant Chart",
  "Timeline",
  "Statistics Chart",
  "Relationship Chart",
  "Genogram Chart",
  "Sociogram",
  "Fractal Ancestor HV Tree",
  "Fractal Symmetrical Tree",
  "Fractal Circular Tree",
  "Fractal Ancestor Tree Chart",
  "Name Distribution"
];

export const REPORT_TYPES = [
  "Person Report",
  "Person Events Report",
  "Family Group Report",
  "Kinship Report",
  "Map Report",
  "Story Report",
  "World History Report",
  "Narrative Report",
  "Ahnentafel Report",
  "Descendancy Report",
  "Register Report",
  "Status Report",
  "Timeline Report",
  "Today Report",
  "Family Tree Book",
  "Family Report", "Particularities Report", "Person Analysis", "Plausibility Report", "Sources List",
  "Medical Files Report", "Diagnosis Files Report", "Prescription Files Report", "Treatment Files Report",
  "Work Contracts Report", "Company Files Report", "Character Work Files Report",
  "Descendancy List", "Marriage List", "Places List", "Events List", "Anniversary List",
  "Name Distribution Report", "Influential People Report", "Fan Chart", "Hourglass Chart",
  "Relationship Chart", "Ahnentafel Diagram", "Genogram", "Timeline Chart", "Name Distribution Chart", "Sociogram"
];

export const LIST_TYPES = [
  "Events List",
  "Facts List",
  "Distinctive Persons List",
  "Plausibility Report",
  "Anniversary List",
  "Places List",
  "Person Analysis",
  "Persons List",
  "Marriage List",
  "ToDo List",
  "Sources List",
  "Medical Files Report",
  "Diagnosis Files Report",
  "Prescription Files Report",
  "Treatment Files Report",
  "Work Contracts Report",
  "Company Files Report",
  "LDS Ordinances List",
  "Changes List",
  "Marriages List"
];

const sourceTemplateNames = [
  "Birth Certificate",
  "Baptism Register",
  "Adoption Record",
  "Marriage Certificate",
  "Divorce Decree",
  "Death Certificate",
  "Burial Register",
  "Cemetery Inscription",
  "Census Schedule",
  "Electoral Roll",
  "Passenger List",
  "Naturalisation File",
  "Passport Application",
  "Military Draft Card",
  "Military Service Record",
  "Pension File",
  "Land Deed",
  "Probate File",
  "Will",
  "Court Record",
  "Criminal Court Record",
  "Protective Services File",
  "Custody Order",
  "Government Case Note",
  "School Register",
  "Yearbook",
  "University Transcript",
  "Apprenticeship Record",
  "Employment Record",
  "Union Membership",
  "Church Membership",
  "Confirmation Register",
  "Bar Mitzvah Register",
  "Mosque Register",
  "Temple Register",
  "Newspaper Notice",
  "Obituary",
  "Funeral Program",
  "Family Bible",
  "Personal Letter",
  "Diary",
  "Oral History",
  "Photograph Caption",
  "Audio Interview",
  "Video Interview",
  "DNA Match Page",
  "DNA Ethnicity Report",
  "DNA Segment Data",
  "Chromosome Browser",
  "Autosomal Raw Data",
  "Y-DNA Result",
  "mtDNA Result",
  "Family Tree Website",
  "Online Family Tree",
  "GEDCOM File",
  "Family Group Sheet",
  "Pedigree Chart",
  "Ahnentafel Report",
  "Descendancy Report",
  "Research Log",
  "To-Do Note",
  "Repository Catalog",
  "Library Book",
  "Genealogy Periodical",
  "Published Family History",
  "City Directory",
  "Telephone Directory",
  "Tax List",
  "Voter Registration",
  "Immigration Card",
  "Border Crossing",
  "Ship Manifest",
  "Railway Record",
  "Hospital Record",
  "Medical Certificate",
  "Insurance File",
  "Adoption Agency Note",
  "Foster Care Record",
  "Social Work Assessment",
  "Police Report",
  "Prison Register",
  "Parole Record",
  "Business License",
  "Professional License",
  "Guild Record",
  "Property Map",
  "Cadastral Survey",
  "Gazetteer",
  "Place Name Index",
  "Map Annotation",
  "Coordinate Source",
  "Wikipedia Article",
  "Wikimedia Image",
  "Find a Grave Memorial",
  "BillionGraves Record",
  "FamilySearch Record",
  "Ancestry Record",
  "MyHeritage Record",
  "Newspapers.com Clipping",
  "Fold3 Record",
  "National Archives Record",
  "Local Archive Record",
  "Museum Catalog",
  "Custom Citation"
];

export const SOURCE_TEMPLATES: SourceTemplate[] = sourceTemplateNames.map((name, index) => ({
  id: `st_${index + 1}`,
  name,
  category: index < 14 ? "Vital and civil" : index < 35 ? "Institutional" : index < 58 ? "Family and DNA" : index < 86 ? "Records and maps" : "Online and custom",
  fields: ["Author/creator", "Title", "Repository", "Date", "Call number", "URL", "Accessed"]
}));

export const RECORD_COLLECTIONS = [
  "Birth, baptism, and adoption records",
  "Marriage, divorce, and partnership records",
  "Death, burial, and cemetery records",
  "Census, population, and voter records",
  "Immigration, naturalisation, and passenger records",
  "Military and pension records",
  "Newspapers, obituaries, and funeral notices",
  "Church and religious records",
  "Wills, probate, court, custody, and legal records",
  "School, yearbook, employment, and occupation records",
  "Land, property, tax, and directory records",
  "Family trees, family-history books, and genealogy publications",
  "Government, protective-services, agency, and case records",
  "DNA reports, matches, ethnicity estimates, and chromosome segments",
  "World History",
  "Historical Context"
];

export const PRIVACY_FIELDS = [
  "Hide private people",
  "Hide living people",
  "Hide protected child and custody details",
  "Hide criminal-record details",
  "Exclude media files",
  "Export source citations only"
];

export const defaultPlaceTemplates: PlaceTemplate[] = [
  {
    id: "pt_civic",
    name: "Civic address",
    levels: ["Room", "Street", "District", "City", "County", "State/Province", "Country"],
    citationPattern: "{name}, {city}, {country}"
  },
  {
    id: "pt_historical",
    name: "Historical jurisdiction",
    levels: ["Hamlet", "Parish", "Hundred", "County", "Kingdom/Empire", "Modern Country"],
    citationPattern: "{name}, historically {county}, {kingdom}"
  },
  {
    id: "pt_cemetery",
    name: "Cemetery or memorial",
    levels: ["Plot", "Section", "Cemetery", "Town", "Region", "Country"],
    citationPattern: "{cemetery}, {town}, {country}, plot {plot}"
  }
];

export const emptyGovernmentDetails = (): GovernmentDetails => ({
  governmentEvents: "",
  protectiveServices: false,
  custodyRemoved: false,
  custodyNotes: "",
  criminalRecord: "",
  fosterRecord: "",
  custodyChangeRecord: "",
  removalRecord: "",
  protectiveServicesRecord: "",
  personalProtectionOrderRecord: "",
  restrainingOrderRecord: "",
  houseArrestRecord: "",
  arrestRecord: "",
  agency: "",
  caseNumber: "",
  governmentFacility: "",
  governmentProtectionStatus: "",
  socialWorkerName: "",
  socialWorkerAgency: "",
  doctorName: "",
  doctorPractice: "",
  inpatientStatus: "",
  daycareStatus: "",
  careTeamNotes: "",
  birthMethod: "",
  birthAssistant: "",
  birthNotes: ""
});

export const emptyDeathDetails = (): DeathDetails => ({
  deathPlace: "",
  deathHospital: "",
  deathAddress: "",
  burialType: "",
  burialDate: "",
  burialSite: "",
  cemeteryName: "",
  cemeteryAddress: "",
  cemeteryPlot: "",
  graveNumber: "",
  latitude: "",
  longitude: "",
  hasGravestone: false,
  gravestoneInscription: "",
  memorialUrl: "",
  funeralHome: "",
  deathNotes: ""
});

export const emptyCharacterProfile = (): CharacterProfile => ({
  species: "",
  subspecies: "",
  speciesName: "",
  hybrid: false,
  hybridLineage: "",
  appearance: "",
  personality: "",
  personalityStyle: "",
  subcultureAesthetic: "",
  aestheticKeywords: "",
  abilities: "",
  relationshipDynamics: "",
  friendships: "",
  rivals: "",
  romanticOrShipNotes: "",
  foundFamily: "",
  likes: "",
  dislikes: "",
  strengths: "",
  weaknesses: "",
  goals: "",
  conflicts: "",
  backstory: "",
  affiliations: "",
  titles: "",
  canonStatus: "",
  fandomSource: "",
  culture: "",
  longFormProfile: "",
  creatorNotes: "",
  quotes: "",
  trivia: "",
  externalLinks: ""
});

export const emptyIdentityDetails = (): IdentityDetails => ({
  pronouns: "",
  genderIdentity: "",
  genderExpression: "",
  sexualOrientation: "",
  romanticOrientation: "",
  relationshipOrientation: "",
  identityLabels: [],
  identityNotes: "",
  visibility: "private"
});

export const defaultAccessibilityPreferences = (): AccessibilityPreferences => ({
  appLanguage: "en",
  fontFamily: "system",
  textScale: "normal",
  colorVision: "standard",
  symbolMode: "standard",
  symbolSize: "standard",
  speechToText: false
});

export const emptyMedicalRecord = (treeId: Id, personId: Id): MedicalRecord => ({
  id: makeId("medical"),
  treeId,
  personId,
  type: "Diagnosis",
  diagnosisName: "",
  conditionCategory: "",
  conditionType: "",
  disorderType: "",
  bodySystem: "",
  diagnosisDate: "",
  onsetDate: "",
  reviewDate: "",
  diagnosticStandard: "",
  diagnosticCriteria: "",
  criteriaMet: "",
  symptomsOrTraits: "",
  functionalImpact: "",
  severity: "",
  status: "",
  course: "",
  progression: "",
  triggers: "",
  riskFactors: "",
  differentialDiagnosis: "",
  comorbidities: "",
  complications: "",
  hereditaryOrFamilyHistory: "",
  prognosis: "",
  careLevel: "",
  emergencyPlan: "",
  hospitalOrClinic: "",
  hospitalAddress: "",
  diagnosingDoctor: "",
  psychologist: "",
  psychiatrist: "",
  occupationalTherapist: "",
  physiotherapist: "",
  speechTherapist: "",
  socialWorker: "",
  otherClinicians: "",
  medications: "",
  therapies: "",
  accommodations: "",
  assistiveDevices: "",
  notes: "",
  sourceIds: [],
  mediaIds: [],
  visibility: "private",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

export const createEmptyPerson = (treeId: Id): Person => ({
  id: makeId("person"),
  treeId,
  givenName: "",
  familyName: "",
  aliases: [],
  gender: "unknown",
  birthDate: "",
  deathDate: "",
  living: true,
  private: false,
  sensitiveVisibility: "private",
  biography: "",
  notes: "",
  branchColor: "#b88f98",
  labels: [],
  eventIds: [],
  facts: [],
  sourceIds: [],
  mediaIds: [],
  government: emptyGovernmentDetails(),
  deathDetails: emptyDeathDetails(),
  characterProfile: emptyCharacterProfile(),
  identity: emptyIdentityDetails()
});

function portraitDataUri(initials: string, background: string, accent: string) {
  void initials; void background; void accent;
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAAaklEQVR42u3YMQrAIBAF0Nz/0rYQxNbCTmF5iYwEPXwXbDQx28p3r9sGAPjokm3btk1wHnXkSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkoqEVuG3y3n2M79BLPzmX8iKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkqKQ6oLvvQhW0MWL2AAAAAASUVORK5CYII=";
}

export const createSeedState = (): AppState => {
  const bookId = "book_kin";
  const collectionId = "collection_chang";
  const treeId = "tree_demo";
  const alex = "person_alex";
  const mei = "person_mei";
  const june = "person_june";
  const kai = "person_kai";
  const sourceBirth = "source_birth";
  const sourceInterview = "source_interview";
  const placeSingapore = "place_singapore";
  const birthEvent = "event_birth_june";
  const marriageEvent = "event_marriage";
  const today = nowIso();

  const people: Person[] = [
    {
      ...createEmptyPerson(treeId),
      id: alex,
      profileMediaId: "media_portrait_alex",
      givenName: "Alex",
      familyName: "Chang",
      gender: "male",
      birthDate: "1958-04-18",
      living: true,
      biography: "A sample ancestor record with sources, family links, and events.",
      branchColor: "#9f6f7d",
      labels: ["Paternal branch"],
      sourceIds: [sourceInterview],
      facts: [
        { id: "fact_alex_occ", type: "Occupation", value: "Architect", date: "1984", sourceIds: [sourceInterview] },
        { id: "fact_alex_height", type: "Height", value: "175 cm", sourceIds: [] }
      ],
      government: emptyGovernmentDetails(),
      deathDetails: emptyDeathDetails()
    },
    {
      ...createEmptyPerson(treeId),
      id: mei,
      profileMediaId: "media_portrait_mei",
      givenName: "Mei",
      familyName: "Tan",
      gender: "female",
      birthDate: "1961-09-02",
      living: true,
      biography: "A sample spouse record for family and chart views.",
      branchColor: "#8a5a44",
      labels: ["Maternal branch"],
      sourceIds: [sourceInterview],
      facts: [{ id: "fact_mei_lang", type: "Language", value: "English, Mandarin", sourceIds: [] }],
      government: emptyGovernmentDetails(),
      deathDetails: emptyDeathDetails()
    },
    {
      ...createEmptyPerson(treeId),
      id: june,
      profileMediaId: "media_portrait_june",
      givenName: "June",
      familyName: "Chang",
      aliases: ["Junie"],
      gender: "female",
      birthDate: "1988-06-12",
      living: true,
      biography: "A central person with a linked birth source and child relationship.",
      branchColor: "#5f5aa2",
      labels: ["DNA tested", "Interview needed"],
      eventIds: [birthEvent],
      sourceIds: [sourceBirth],
      facts: [
        { id: "fact_june_eye", type: "Eye Color", value: "Brown", sourceIds: [] },
        { id: "fact_june_dna", type: "DNA Kit", value: "Imported match summary", sourceIds: [] }
      ],
      government: {
        ...emptyGovernmentDetails(),
        governmentEvents: "Passport renewal recorded as a government event example."
      },
      deathDetails: emptyDeathDetails()
    },
    {
      ...createEmptyPerson(treeId),
      id: kai,
      profileMediaId: "media_portrait_kai",
      givenName: "Kai",
      familyName: "Chang",
      gender: "male",
      birthDate: "2014-11-05",
      living: true,
      private: true,
      biography: "A private living-child example for privacy export checks.",
      branchColor: "#b36a5e",
      labels: ["Living private"],
      government: {
        ...emptyGovernmentDetails(),
        protectiveServices: false,
        custodyRemoved: false,
        custodyNotes: "Private child details are hidden by privacy exports."
      },
      deathDetails: emptyDeathDetails()
    }
  ];

  return {
    books: [{ id: bookId, title: "KinForge Research Book", description: "Multiple collections and subcollections of family trees." }],
    collections: [
      { id: collectionId, bookId, name: "Chang and Tan lines" },
      { id: "collection_civil", bookId, parentId: collectionId, name: "Civil records and government files" },
      { id: "collection_dna", bookId, parentId: collectionId, name: "DNA and match clusters" }
    ],
    trees: [
      {
        id: treeId,
        bookId,
        collectionId: "collection_civil",
        title: "Chang-Tan working tree",
        author: "Family Archivist",
        authorContact: "private local archive",
        language: "en",
        citationStyle: "Evidence Explained",
        privacy: "private",
        createdAt: today
      }
    ],
    people,
    protectionRecords: [],
    relationships: [
      { id: "rel_alex_mei", treeId, type: "spouse", fromId: alex, toId: mei, startDate: "1986-05-25", subtype: "Nuclear family", sourceIds: [sourceInterview] },
      { id: "rel_alex_june", treeId, type: "parent-child", fromId: alex, toId: june, parentRole: "father", sourceIds: [sourceBirth] },
      { id: "rel_mei_june", treeId, type: "parent-child", fromId: mei, toId: june, parentRole: "mother", sourceIds: [sourceBirth] },
      { id: "rel_june_kai", treeId, type: "parent-child", fromId: june, toId: kai, parentRole: "mother", sourceIds: [] }
    ],
    families: [
      { id: "family_chang_tan", treeId, name: "Chang-Tan family", familyType: "Nuclear family", partnerIds: [alex, mei], childIds: [june], eventIds: [marriageEvent], sourceIds: [sourceInterview], notes: "Sample family group." }
    ],
    events: [
      { id: birthEvent, type: "Birth", date: "1988-06-12", placeId: placeSingapore, description: "Birth record created from a sample certificate.", sourceIds: [sourceBirth], mediaIds: [] },
      { id: marriageEvent, type: "Marriage", date: "1986-05-25", placeId: placeSingapore, description: "Marriage entered from an interview and pending certificate.", sourceIds: [sourceInterview], mediaIds: [] }
    ],
    places: [
      {
        id: placeSingapore,
        treeId,
        name: "Singapore",
        templateId: "pt_civic",
        address: "Singapore",
        levels: { "City": "Singapore", "Country": "Singapore" },
        latitude: "1.3521",
        longitude: "103.8198",
        pointsOfInterest: "National archives, civil registry, family residence cluster",
        wikipediaTitle: "Singapore",
        mediaIds: [],
        sourceIds: [],
        notes: "Coordinates included for map and globe views."
      }
    ],
    placeTemplates: defaultPlaceTemplates,
    sources: [
      {
        id: sourceBirth,
        treeId,
        title: "June Chang birth certificate",
        templateId: "st_1",
        fields: { "Repository": "Family archive", "Date": "1988-06-12", "Call number": "BC-1988-JC" },
        citation: "June Chang birth certificate, family archive, 1988.",
        url: "",
        mediaIds: [],
        notes: "Sample source citation."
      },
      {
        id: sourceInterview,
        treeId,
        title: "Interview with Mei Tan",
        templateId: "st_42",
        fields: { "Author/creator": "Mei Tan", "Repository": "Private audio archive", "Date": "2026-09-22" },
        citation: "Mei Tan interview by family archivist, 2026.",
        url: "",
        mediaIds: [],
        notes: "Sample oral-history source."
      }
    ],
    sourceTemplates: SOURCE_TEMPLATES,
    media: [
      { id: "media_portrait_alex", treeId, title: "Alex Chang profile picture", type: "picture", dataUrl: portraitDataUri("AC", "#dcefed", "#245d63"), externalUrl: "", assignedTo: [{ kind: "person", id: alex }], tags: ["profile", "portrait"], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "Generated local profile portrait for Alex Chang.", transcript: "", createdAt: today },
      { id: "media_portrait_mei", treeId, title: "Mei Tan profile picture", type: "picture", dataUrl: portraitDataUri("MT", "#f0e0d5", "#7a4a34"), externalUrl: "", assignedTo: [{ kind: "person", id: mei }], tags: ["profile", "portrait"], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "Generated local profile portrait for Mei Tan.", transcript: "", createdAt: today },
      { id: "media_portrait_june", treeId, title: "June Chang profile picture", type: "picture", dataUrl: portraitDataUri("JC", "#e3e0f4", "#4f4a91"), externalUrl: "", assignedTo: [{ kind: "person", id: june }], tags: ["profile", "portrait"], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "Generated local profile portrait for June Chang.", transcript: "", createdAt: today },
      { id: "media_portrait_kai", treeId, title: "Kai Chang profile picture", type: "picture", dataUrl: portraitDataUri("KC", "#f0ded9", "#9a5148"), externalUrl: "", assignedTo: [{ kind: "person", id: kai }], tags: ["profile", "portrait"], rotation: 0, crop: "", colorized: false, enhanced: false, repaired: false, story: "Generated local profile portrait for Kai Chang.", transcript: "", createdAt: today }
    ],
    todos: [
      { id: "todo_birth", treeId, personId: june, title: "Attach scanned birth certificate", status: "open", priority: "high", dueDate: "" },
      { id: "todo_grave", treeId, title: "Search cemetery databases for older Chang line", status: "doing", priority: "normal", dueDate: "" }
    ],
    dnaMatches: [
      {
        id: "dna_cousin",
        treeId,
        personId: june,
        matchName: "A. Tan",
        sharedCm: 412,
        predictedRelationship: "First cousin once removed",
        surnames: ["Tan", "Lim"],
        locations: ["Singapore", "Malacca"],
        geneticGroups: ["Straits Chinese"],
        ethnicity: "East and Southeast Asian",
        side: "maternal",
        segments: [
          { chromosome: "3", start: 24000000, end: 71000000, side: "maternal" },
          { chromosome: "12", start: 10000000, end: 36000000, side: "maternal" }
        ],
        notes: "Sample match for chromosome browser and clusters."
      }
    ],
    records: [
      {
        id: "record_birth",
        treeId,
        personId: june,
        collection: "Birth, baptism, and adoption records",
        title: "Civil birth registration index",
        date: "1988",
        placeId: placeSingapore,
        citation: "Civil registry index, sample imported record.",
        sourceId: sourceBirth,
        transcription: "Sample transcription of birth record details."
      }
    ],
    ideasJournal: [
      {
        id: "idea_character_profile",
        treeId,
        personId: june,
        title: "Character profile expansion ideas",
        category: "Character arc",
        status: "idea",
        tags: ["profile", "lore", "relationships"],
        body: "Use the character profile section for species, aesthetic, personality style, relationship dynamics, backstory and fandom-style long-form notes.",
        createdAt: today,
        updatedAt: today
      }
    ],
    userFeedback: [
      {
        id: "feedback_update_agent",
        treeId,
        personId: june,
        type: "feature",
        status: "planned",
        priority: "high",
        title: "Use feedback to guide monthly updates",
        body: "Feedback entries should feed the internal update agent so recurring bugs, feature requests, accessibility notes and confusing workflows can guide future releases.",
        page: "Ideas Journal",
        createdBy: "KinForge",
        createdAt: today,
        updatedAt: today
      }
    ],
    medicalRecords: [{
      ...emptyMedicalRecord(treeId, june),
      id: "medical_june_migraine",
      type: "Diagnosis record",
      diagnosisName: "Migraine disorder",
      conditionCategory: "Physical condition",
      conditionType: "Neurological condition",
      disorderType: "Migraine disorder",
      bodySystem: "Nervous system",
      diagnosisDate: "2026-01-12",
      diagnosticStandard: "Clinical assessment",
      criteriaMet: "Demo record: recurring migraine-pattern symptoms and sensory sensitivity were recorded for testing report layout only.",
      symptomsOrTraits: "Headache episodes, light sensitivity, sound sensitivity",
      functionalImpact: "Needs dim lighting, rest breaks, and reduced screen glare during attacks.",
      course: "Episodic",
      careLevel: "Outpatient",
      hospitalOrClinic: "KinForge Demo Clinic",
      diagnosingDoctor: "Dr. Serene Example",
      accommodations: "Low-glare display, quiet room, flexible scheduling",
      assistiveDevices: "Blue-light filter, noise-reducing headphones",
      notes: "Synthetic sample used to validate diagnosis reports, privacy filtering, deletion, and downloads. Not a real medical record.",
      sourceIds: [sourceInterview],
      visibility: "private",
      createdAt: today,
      updatedAt: today
    }],
    reportDrafts: [],
    labels: ["Paternal branch", "Maternal branch", "DNA tested", "Interview needed", "Living private", "Needs source", "Government record"],
    customEventTypes: [],
    customFactTypes: [],
    customFactTerms: [],
    customFamilyTypes: [],
    customRelationshipSubtypes: [],
    chartConfig: {
      type: "Tree Chart",
      orientation: "horizontal",
      style: "color-branches",
      font: "Inter",
      showLabels: true,
      showShadows: true,
      color: "#9f6f7d",
      pageSize: "single",
      extraText: "Prepared in KinForge Genealogy Studio",
      lineNote: "Evidence-linked working chart",
      rotation: 0
    },
    accessibility: defaultAccessibilityPreferences(),
    changes: [
      { id: "change_seed", at: today, treeId, label: "Created starter KinForge research book", after: "Seed data added." }
    ]
  };
};

export const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const fullName = (person?: Person) => {
  if (!person) return "Unknown person";
  return `${person.givenName} ${person.familyName}`.trim() || "Unnamed person";
};

export const characterSpeciesLine = (person?: Person) => {
  const profile = person?.characterProfile;
  if (!profile) return "";
  const base = [profile.species, profile.subspecies].filter(Boolean).join(" / ");
  const scientific = profile.speciesName ? `(${profile.speciesName})` : "";
  const hybrid = profile.hybrid ? `Hybrid${profile.hybridLineage ? `: ${profile.hybridLineage}` : ""}` : "";
  return [base, scientific, hybrid].filter(Boolean).join(" ");
};

export const birthYear = (person?: Person) => {
  const match = person?.birthDate.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
};

export const deathYear = (person?: Person) => {
  const match = person?.deathDate.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
};

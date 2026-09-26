import type { KinshipOptions } from "./kinship";

export type Parentage = "unspecified" | "biological" | "adoptive" | "foster" | "step";
export type ReportLanguage = string;
export type ReportOptions = KinshipOptions & {
  generations?: number;
  ancestorGenerations?: number;
  descendantGenerations?: number;
  familyId?: string;
  analysisType?: string;
  sections?: string[];
  eventScope?: "person" | "immediate-family" | "all-relatives";
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "name" | "date" | "type";
  sortDirection?: "asc" | "desc";
  groupBy?: "none" | "type" | "surname" | "place" | "status";
  columns?: string[];
  kinshipCategories?: string[];
  language?: ReportLanguage;
  includeHistory?: boolean;
  parentage?: "all" | Parentage;
  todoStatus?: "all" | "open" | "doing" | "done";
  includeUnassignedMedia?: boolean;
  storyStyle?: "documentary" | "album" | "chronicle";
  thresholds?: { minParentAge?: number; maxParentAge?: number; maxLifespan?: number; minMarriageAge?: number; maxMarriageAge?: number; manyChildren?: number; earlyDeath?: number; burialDelayDays?: number };
};

export type ReportPresentation = {
  layout?: "flow" | "canvas";
  canvasWidth?: number;
  theme?: "aqua" | "classic" | "forest" | "monochrome";
  orientation?: "portrait" | "landscape";
  margin?: number;
  watermark?: string;
  header?: string;
  footer?: string;
  pageNumbers?: boolean;
  crest?: string;
  printBackground?: boolean;
};

export const REPORT_THEMES = {
  aqua: { ink: "#202528", accent: "#2f7f88", band: "#e0f0f2" },
  classic: { ink: "#28252a", accent: "#744569", band: "#f0e8ee" },
  forest: { ink: "#222b25", accent: "#356747", band: "#e6efe8" },
  monochrome: { ink: "#202020", accent: "#454545", band: "#eeeeee" }
};

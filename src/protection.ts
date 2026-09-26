import { makeId, PROTECTION_EVENT_TYPES } from "./domain";
import type { AppState, PersonEvent, ProtectionRecord, SensitiveVisibility } from "./domain";

export type { ProtectionEntityKind, ProtectionRecord, SensitiveVisibility } from "./domain";
export type ProtectionScope = Pick<ProtectionRecord, "treeId" | "entityKind" | "entityId">;
export type ProtectionValidationErrors = Partial<Record<keyof ProtectionRecord, string>>;
export type ProtectionSaveResult =
  | { ok: true; records: ProtectionRecord[] }
  | { ok: false; errors: ProtectionValidationErrors };

export const PROTECTION_RECORD_TYPES = [
  "Child Custody", "Guardianship", "Foster Care", "Protective Services",
  "Criminal Record", "Court Record", "Government Record", "Medical Event", "Hospitalization",
  ...PROTECTION_EVENT_TYPES
] as const;

export const SENSITIVE_VISIBILITY_LABELS: Record<SensitiveVisibility, string> = {
  private: "Private to your account",
  shared: "Visible to shared-library members"
};

export const defaultSensitiveVisibility = (canManagePrivacy = true): SensitiveVisibility => canManagePrivacy ? "private" : "shared";

/** Missing legacy sensitivity settings remain private; this is not a server access check. */
export const effectiveSensitiveVisibility = (visibility?: SensitiveVisibility): SensitiveVisibility => visibility === "shared" ? "shared" : "private";

const sensitiveEventTypes = new Set<string>([...PROTECTION_RECORD_TYPES, "Adoption", "DNA Test"].map(type => type.toLowerCase()));
export const isSensitiveEventType = (type: string): boolean => sensitiveEventTypes.has(type.trim().toLowerCase());

/** Use when creating PersonEvent.private; existing recorded privacy is never changed here. */
export const defaultEventPrivacy = (type: string, canManagePrivacy = true): boolean => isSensitiveEventType(type) && canManagePrivacy;

export function withSensitiveEventPrivacy<T extends Pick<PersonEvent, "type" | "private">>(event: T, canManagePrivacy = true): T & { private: boolean } {
  return { ...event, private: event.private ?? defaultEventPrivacy(event.type, canManagePrivacy) };
}

export function createProtectionRecord(scope: ProtectionScope, canManagePrivacy = true): ProtectionRecord {
  return {
    ...scope, id: makeId("protection"), type: "", status: "", startDate: "", endDate: "",
    agency: "", contact: "", jurisdiction: "", caseReference: "", notes: "", sourceIds: [], mediaIds: [],
    visibility: defaultSensitiveVisibility(canManagePrivacy)
  };
}

export const protectionRecordMatchesScope = (record: ProtectionRecord, scope: ProtectionScope): boolean =>
  record.treeId === scope.treeId && record.entityKind === scope.entityKind && record.entityId === scope.entityId;

/** Presentation filtering only. The server must independently redact private records. */
export function protectionRecordsForEntity(state: AppState, scope: ProtectionScope, canManagePrivacy = true): ProtectionRecord[] {
  return (state.protectionRecords ?? []).filter(record => protectionRecordMatchesScope(record, scope)
    && (canManagePrivacy || record.visibility === "shared"));
}

function scopeExists(state: AppState, scope: ProtectionScope): boolean {
  if (!state.trees.some(tree => tree.id === scope.treeId)) return false;
  const entries = scope.entityKind === "person" ? state.people
    : scope.entityKind === "family" ? state.families
      : scope.entityKind === "relationship" ? state.relationships : [];
  return entries.some(entry => entry.id === scope.entityId && entry.treeId === scope.treeId);
}

function dateBounds(value: string): { earliest: number; latest: number } | undefined {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]), month = match[2] ? Number(match[2]) : undefined;
  const day = match[3] ? Number(match[3]) : undefined;
  if (year < 1 || (month !== undefined && (month < 1 || month > 12))) return undefined;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = month === undefined ? 31 : [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day !== undefined && (day < 1 || day > days)) return undefined;
  return {
    earliest: year * 10000 + (month ?? 1) * 100 + (day ?? 1),
    latest: year * 10000 + (month ?? 12) * 100 + (day ?? days)
  };
}

export function validateProtectionRecord(
  record: ProtectionRecord, state: AppState, scope: ProtectionScope, canManagePrivacy = true
): ProtectionValidationErrors {
  const errors: ProtectionValidationErrors = {};
  const stringFields = ["id", "treeId", "entityId", "type", "status", "startDate", "endDate", "agency", "contact", "jurisdiction", "caseReference", "notes"] as const;
  for (const field of stringFields) {
    if (typeof record[field] !== "string") errors[field] = "Enter text for this field.";
  }
  if (typeof record.id !== "string" || !record.id.trim()) errors.id = "A record ID is required.";
  if (typeof record.type !== "string" || !record.type.trim()) errors.type = "Select a record type.";
  if (!protectionRecordMatchesScope(record, scope) || !scopeExists(state, scope)) {
    errors.entityId = "The record must belong to an existing person, family or relationship in this tree.";
  }
  if (record.visibility !== "private" && record.visibility !== "shared") errors.visibility = "Select account or shared-library visibility.";
  if (!canManagePrivacy && record.visibility !== "shared") errors.visibility = "Only the library owner can manage private records.";
  const existing = (state.protectionRecords ?? []).find(entry => entry.id === record.id);
  if (existing && !protectionRecordMatchesScope(existing, scope)) errors.id = "This record ID belongs to a different entity.";
  if (existing && !canManagePrivacy && existing.visibility !== "shared") errors.visibility = "Only the library owner can manage private records.";

  const start = typeof record.startDate === "string" ? record.startDate.trim() : "";
  const end = typeof record.endDate === "string" ? record.endDate.trim() : "";
  const startBounds = dateBounds(start), endBounds = dateBounds(end);
  if (start && !startBounds) errors.startDate = "Enter a valid date as YYYY, YYYY-MM or YYYY-MM-DD.";
  if (end && !endBounds) errors.endDate = "Enter a valid date as YYYY, YYYY-MM or YYYY-MM-DD.";
  // Partial dates are ranges: reject only an end that is definitely before the start.
  if (startBounds && endBounds && endBounds.latest < startBounds.earliest) errors.endDate = "End date cannot be before start date.";

  for (const field of ["sourceIds", "mediaIds"] as const) {
    const ids = record[field];
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
      errors[field] = "Choose each linked item only once.";
      continue;
    }
    const available = field === "sourceIds" ? state.sources.filter(source => source.treeId === scope.treeId)
      : state.media.filter(media => media.treeId === scope.treeId && (canManagePrivacy || media.visibility !== "private"));
    if (ids.some(id => !available.some(item => item.id === id))) errors[field] = "Remove unavailable items or choose items from this tree.";
  }
  return errors;
}

/** Returns the complete collection, preserving other entities and trees. No state is mutated. */
export function upsertProtectionRecord(
  state: AppState, scope: ProtectionScope, record: ProtectionRecord, canManagePrivacy = true
): ProtectionSaveResult {
  const errors = validateProtectionRecord(record, state, scope, canManagePrivacy);
  if (Object.keys(errors).length) return { ok: false, errors };
  const value: ProtectionRecord = { ...record, sourceIds: [...record.sourceIds], mediaIds: [...record.mediaIds] };
  const records = state.protectionRecords ?? [];
  return { ok: true, records: records.some(entry => entry.id === value.id)
    ? records.map(entry => entry.id === value.id ? value : entry) : [...records, value] };
}

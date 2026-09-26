import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createEmptyPerson, createSeedState, EVENT_TYPES, PROTECTION_EVENT_TYPES } from "./domain";
import type { ProtectionRecord } from "./domain";
import { ProtectionPanel } from "./ProtectionPanel";
import type { ProtectionPanelProps } from "./ProtectionPanel";
import {
  createProtectionRecord, defaultEventPrivacy, defaultSensitiveVisibility, effectiveSensitiveVisibility,
  isSensitiveEventType, protectionRecordsForEntity, upsertProtectionRecord, validateProtectionRecord,
  withSensitiveEventPrivacy
} from "./protection";
import type { ProtectionScope } from "./protection";

const personScope: ProtectionScope = { treeId: "tree_demo", entityKind: "person", entityId: "person_june" };
const familyScope: ProtectionScope = { treeId: "tree_demo", entityKind: "family", entityId: "family_chang_tan" };
const relationshipScope: ProtectionScope = { treeId: "tree_demo", entityKind: "relationship", entityId: "rel_alex_june" };
const recordFor = (scope = personScope, values: Partial<ProtectionRecord> = {}): ProtectionRecord => ({ ...createProtectionRecord(scope), type: "Custody Change", ...values });

describe("protection visibility and defaults", () => {
  it("defaults owner records and legacy sensitive groups to account-private without supplying facts", () => {
    expect(createSeedState().protectionRecords).toEqual([]);
    expect(createEmptyPerson(personScope.treeId).sensitiveVisibility).toBe("private");
    expect(defaultSensitiveVisibility()).toBe("private");
    expect(effectiveSensitiveVisibility()).toBe("private");
    expect(effectiveSensitiveVisibility("shared")).toBe("shared");
    expect(createProtectionRecord(personScope)).toMatchObject({ ...personScope, visibility: "private", type: "", status: "", startDate: "", endDate: "", notes: "", agency: "", contact: "", jurisdiction: "", caseReference: "", sourceIds: [], mediaIds: [] });
  });

  it("defaults invited editors to shared-sensitive records", () => {
    expect(defaultSensitiveVisibility(false)).toBe("shared");
    const record = { ...createProtectionRecord(personScope, false), type: "Foster Placement" };
    expect(record.visibility).toBe("shared");
    expect(validateProtectionRecord(record, createSeedState(), personScope, false)).toEqual({});
  });

  it("detects every new sensitive event and retains existing event types", () => {
    expect(EVENT_TYPES).toEqual(expect.arrayContaining(["Birth", "Naming", "Marriage", "Foster Care", "Child Custody", "Protective Services", "Government Record", "Death", ...PROTECTION_EVENT_TYPES]));
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
    for (const type of [...PROTECTION_EVENT_TYPES, "Child Custody", "Court Record", "DNA Test", "Medical Event"]) {
      expect(isSensitiveEventType(` ${type.toUpperCase()} `)).toBe(true);
      expect(defaultEventPrivacy(type)).toBe(true);
      expect(defaultEventPrivacy(type, false)).toBe(false);
    }
    expect(defaultEventPrivacy("Birth")).toBe(false);
    expect(isSensitiveEventType("Unrecorded custom event")).toBe(false);
  });

  it("preserves explicit event privacy flags and other fields when adding defaults", () => {
    const event = { type: "Custody Removal", private: true, description: "Recorded wording" };
    expect(withSensitiveEventPrivacy(event, false)).toEqual(event);
    expect(withSensitiveEventPrivacy({ ...event, private: false })).toEqual({ ...event, private: false });
    expect(withSensitiveEventPrivacy({ type: "Custody Removal" }).private).toBe(true);
    expect(withSensitiveEventPrivacy({ type: "Custody Removal" }, false).private).toBe(false);
    expect(event.private).toBe(true);
  });

  it("rejects private creation, editing and private-to-shared conversion by nonowners", () => {
    const state = createSeedState(), record = recordFor();
    expect(upsertProtectionRecord(state, personScope, record, false).ok).toBe(false);
    state.protectionRecords = [record];
    expect(upsertProtectionRecord(state, personScope, { ...record, visibility: "shared" }, false).ok).toBe(false);
    expect(upsertProtectionRecord(state, personScope, { ...record, visibility: "shared" }, true).ok).toBe(true);
    expect(state.protectionRecords[0].visibility).toBe("private");
  });
});

describe("protection entity scope and updates", () => {
  it.each([personScope, familyScope, relationshipScope])("saves records for $entityKind without changing the entity", scope => {
    const state = createSeedState(), before = JSON.stringify(state), record = recordFor(scope);
    const result = upsertProtectionRecord(state, scope, record);
    expect(result).toEqual({ ok: true, records: [record] });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("filters by tree, kind, ID and visibility with a missing-collection fallback", () => {
    const state = createSeedState();
    delete state.protectionRecords;
    expect(protectionRecordsForEntity(state, personScope)).toEqual([]);
    const privateRecord = recordFor(), shared = recordFor(personScope, { visibility: "shared" });
    state.protectionRecords = [privateRecord, shared,
      recordFor({ ...personScope, treeId: "other_tree" }),
      recordFor({ ...personScope, entityKind: "family" }),
      recordFor({ ...personScope, entityId: "person_kai" })];
    expect(protectionRecordsForEntity(state, personScope)).toEqual([privateRecord, shared]);
    expect(protectionRecordsForEntity(state, personScope, false)).toEqual([shared]);
  });

  it("preserves all unrelated records and exact supplied wording during an update", () => {
    const state = createSeedState(), record = recordFor(), other = recordFor(familyScope);
    state.protectionRecords = [record, other];
    const replacement = { ...record, status: "Status supplied in correspondence", notes: "  Original wording\nSecond line", sourceIds: [state.sources[0].id] };
    const result = upsertProtectionRecord(state, personScope, replacement);
    expect(result).toEqual({ ok: true, records: [replacement, other] });
    if (!result.ok) throw new Error("Expected saved records");
    expect(result.records[1]).toBe(other);
    result.records[0].sourceIds.push("later_mutation");
    expect(replacement.sourceIds).toEqual([state.sources[0].id]);
    expect(state.protectionRecords[0]).toBe(record);
  });

  it("rejects missing entities, wrong trees, scope changes and IDs owned by another entity", () => {
    const state = createSeedState(), record = recordFor();
    for (const scope of [{ ...personScope, entityId: "missing" }, { ...personScope, treeId: "other_tree" }, { ...personScope, entityKind: "family" as const }]) {
      expect(validateProtectionRecord(recordFor(scope), state, scope).entityId).toBeTruthy();
    }
    expect(validateProtectionRecord(record, state, familyScope).entityId).toBeTruthy();
    state.protectionRecords = [recordFor(familyScope, { id: record.id })];
    expect(validateProtectionRecord(record, state, personScope).id).toBeTruthy();
  });
});

describe("protection validation", () => {
  it.each([
    ["", ""], ["2024", ""], ["", "2023-05-12"], ["2024-02-29", "2024-02-29"],
    ["2024-12-31", "2024"], ["2024", "2024-01"], ["2024-02", "2024-02-01"], ["0099-01", "0100"]
  ])("accepts supplied dates %s / %s without filling gaps", (startDate, endDate) => {
    const record = recordFor(personScope, { startDate, endDate }), state = createSeedState();
    expect(validateProtectionRecord(record, state, personScope)).toEqual({});
    expect(upsertProtectionRecord(state, personScope, record)).toEqual({ ok: true, records: [record] });
  });

  it.each(["2023-02-29", "2024-02-30", "1900-02-29", "2024-04-31", "2024-13", "2024-00-01", "2024-01-00", "0000", "09/24/2024"])("rejects invalid dates %s", date => {
    const state = createSeedState();
    expect(validateProtectionRecord(recordFor(personScope, { startDate: date }), state, personScope).startDate).toBeTruthy();
    expect(validateProtectionRecord(recordFor(personScope, { endDate: date }), state, personScope).endDate).toBeTruthy();
  });

  it.each([["2024-02-02", "2024-02-01"], ["2025", "2024"], ["2024-03", "2024-02"], ["2025-01-01", "2024"]])("rejects a definitely reversed range %s / %s", (startDate, endDate) => {
    expect(validateProtectionRecord(recordFor(personScope, { startDate, endDate }), createSeedState(), personScope).endDate).toBe("End date cannot be before start date.");
  });

  it("requires a type and valid visibility but never invents status or care conclusions", () => {
    const state = createSeedState();
    expect(validateProtectionRecord(recordFor(personScope, { type: "  " }), state, personScope).type).toBeTruthy();
    expect(validateProtectionRecord(recordFor(personScope, { visibility: "public" as never }), state, personScope).visibility).toBeTruthy();
    expect(validateProtectionRecord(recordFor(personScope, { status: "", type: "User-supplied government event" }), state, personScope)).toEqual({});
  });

  it("validates linked sources and media against this tree and editor access", () => {
    const state = createSeedState();
    state.sources.push({ ...state.sources[0], id: "source_other", treeId: "tree_other" });
    state.media.push({ ...state.media[0], id: "media_other", treeId: "tree_other" });
    state.media[0].visibility = "private";
    for (const sourceIds of [["missing"], ["source_other"], [state.sources[0].id, state.sources[0].id]]) {
      expect(validateProtectionRecord(recordFor(personScope, { sourceIds }), state, personScope).sourceIds).toBeTruthy();
    }
    for (const mediaIds of [["missing"], ["media_other"], [state.media[0].id, state.media[0].id]]) {
      expect(validateProtectionRecord(recordFor(personScope, { mediaIds }), state, personScope).mediaIds).toBeTruthy();
    }
    const record = recordFor(personScope, { visibility: "shared", sourceIds: [state.sources[0].id], mediaIds: [state.media[0].id] });
    expect(validateProtectionRecord(record, state, personScope)).toEqual({});
    expect(validateProtectionRecord(record, state, personScope, false).mediaIds).toBeTruthy();
    expect(validateProtectionRecord({ ...record, mediaIds: [state.media[1].id] }, state, personScope, false)).toEqual({});
  });

  it("reports malformed fields without rewriting or throwing", () => {
    const record = recordFor(personScope, { id: 42 as never, status: null as never, sourceIds: null as never, mediaIds: [null] as never });
    expect(validateProtectionRecord(record, createSeedState(), personScope)).toMatchObject({ id: expect.any(String), status: expect.any(String), sourceIds: expect.any(String), mediaIds: expect.any(String) });
  });
});

describe("ProtectionPanel interactions", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  beforeAll(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
  });
  afterEach(() => { act(() => root?.unmount()); root = undefined; container?.remove(); });
  afterAll(() => {
    if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    vi.unstubAllGlobals();
  });
  const mount = (overrides: Partial<ProtectionPanelProps> = {}) => {
    const props: ProtectionPanelProps = { state: createSeedState(), ...personScope, canManagePrivacy: true, onChange: vi.fn(), onDelete: vi.fn(), onDownload: vi.fn(), ...overrides };
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root!.render(createElement(ProtectionPanel, props)));
    return props;
  };
  const button = (name: string) => {
    const result = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.getAttribute("aria-label") === name || element.textContent === name);
    if (!result) throw new Error(`Missing button: ${name}`);
    act(() => result.click());
  };
  const control = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`dialog [name="${name}"]`)!;
  const change = (name: string, value: string) => {
    const input = control(name);
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  };

  it("creates an owner record with every field, sources, attachments and the full collection callback", () => {
    const state = createSeedState(), other = recordFor(familyScope); state.protectionRecords = [other];
    const props = mount({ state }); button("Add record");
    expect(control("visibility").value).toBe("private");
    expect(control("status").value).toBe("");
    for (const [name, value] of Object.entries({ type: "Custody Restoration", status: "Recorded in letter", startDate: "2024-01", endDate: "2024-02", agency: "Recorded agency", contact: "Recorded worker", jurisdiction: "Recorded jurisdiction", caseReference: "REF-123", notes: "Supplied notes" })) change(name, value);
    act(() => (control("sourceIds") as HTMLInputElement).click());
    act(() => (control("mediaIds") as HTMLInputElement).click());
    button("Save record");
    expect(props.onChange).toHaveBeenCalledOnce();
    const saved = vi.mocked(props.onChange).mock.calls[0][0];
    expect(saved[0]).toBe(other);
    expect(saved[1]).toMatchObject({ ...personScope, type: "Custody Restoration", status: "Recorded in letter", startDate: "2024-01", endDate: "2024-02", agency: "Recorded agency", contact: "Recorded worker", jurisdiction: "Recorded jurisdiction", caseReference: "REF-123", notes: "Supplied notes", sourceIds: [state.sources[0].id], mediaIds: [state.media[0].id], visibility: "private" });
    expect(document.querySelector("dialog")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Record saved.");
  });

  it("excludes private records and attachments for shared editors and offers only shared visibility", () => {
    const state = createSeedState(), privateRecord = recordFor(personScope, { type: "Custody Removal" }), shared = recordFor(personScope, { visibility: "shared" });
    state.protectionRecords = [privateRecord, shared]; state.media[0].visibility = "private";
    const props = mount({ state, canManagePrivacy: false });
    expect(container.textContent).not.toContain("Custody Removal");
    expect(container.textContent).toContain("Custody Change");
    button("Add record");
    expect([...control("visibility").querySelectorAll("option")].map(option => option.value)).toEqual(["shared"]);
    expect(document.querySelector(`dialog input[value="${state.media[0].id}"]`)).toBeNull();
    change("type", "Government Protection Status"); button("Save record");
    expect(vi.mocked(props.onChange).mock.calls[0][0].at(-1)?.visibility).toBe("shared");
    button("Edit Custody Change"); change("notes", "Shared editor update"); button("Save record");
    expect(vi.mocked(props.onChange).mock.calls[1][0]).toEqual([privateRecord, { ...shared, notes: "Shared editor update" }]);
  });

  it("shows validation errors and does not save a reversed date range", () => {
    const props = mount(); button("Add record"); change("type", "Foster Placement"); change("startDate", "2024-04-01"); change("endDate", "2024-03-31"); button("Save record");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(control("endDate").getAttribute("aria-invalid")).toBe("true");
    const errorId = control("endDate").getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe("End date cannot be before start date.");
    change("endDate", ""); button("Save record");
    expect(vi.mocked(props.onChange).mock.calls[0][0][0].endDate).toBe("");
  });

  it("edits all record fields and forwards delete and download IDs to the parent", () => {
    const state = createSeedState(), record = recordFor(personScope, { status: "Recorded status", sourceIds: [state.sources[0].id], mediaIds: [state.media[0].id] }); state.protectionRecords = [record];
    const props = mount({ state }); button("Edit Custody Change");
    for (const [name, value] of Object.entries({ type: "Custody Restoration", status: "Updated wording", startDate: "2023", endDate: "2024", agency: "Updated agency", contact: "Updated contact", jurisdiction: "Updated jurisdiction", caseReference: "REF-456", notes: "Updated notes", visibility: "shared" })) change(name, value);
    act(() => (control("sourceIds") as HTMLInputElement).click());
    act(() => (control("mediaIds") as HTMLInputElement).click());
    button("Save record");
    expect(vi.mocked(props.onChange).mock.calls[0][0][0]).toMatchObject({ id: record.id, type: "Custody Restoration", status: "Updated wording", startDate: "2023", endDate: "2024", agency: "Updated agency", contact: "Updated contact", jurisdiction: "Updated jurisdiction", caseReference: "REF-456", notes: "Updated notes", visibility: "shared", sourceIds: [], mediaIds: [] });
    button("Download Custody Change"); button("Delete Custody Change");
    expect(props.onDownload).toHaveBeenCalledWith(record.id); expect(props.onDelete).toHaveBeenCalledWith(record.id);
  });

  it.each([{ ...familyScope, canManagePrivacy: true }, { ...personScope, canManagePrivacy: false }])("closes the previous editor on scope or owner changes", next => {
    const props = mount(); button("Add record"); change("notes", "Unsaved private note");
    act(() => root!.render(createElement(ProtectionPanel, { ...props, ...next })));
    expect(document.querySelector("dialog")).toBeNull();
    button("Add record"); expect(control("notes").value).toBe("");
    expect(control("visibility").value).toBe(next.canManagePrivacy ? "private" : "shared");
  });

  it("blocks saving a record that was changed by another update", () => {
    const state = createSeedState(), record = recordFor(); state.protectionRecords = [record];
    const props = mount({ state }); button("Edit Custody Change"); change("notes", "Unsaved note");
    act(() => root!.render(createElement(ProtectionPanel, { ...props, state: { ...state, protectionRecords: [{ ...record, notes: "Concurrent update" }] } })));
    button("Save record"); expect(props.onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("changed while you were editing");
  });

  it("cancels without mutating state and restores keyboard focus", () => {
    const props = mount(), before = JSON.stringify(props.state); button("Add record"); change("notes", "Unsaved note"); button("Cancel");
    expect(props.onChange).not.toHaveBeenCalled(); expect(JSON.stringify(props.state)).toBe(before);
    expect(document.activeElement?.textContent).toBe("Add record");
  });
  it("disables mutation controls for readers but keeps downloads available", () => {
    const state = createSeedState(), record = recordFor(); state.protectionRecords = [record];
    const props = mount({ state, readOnly: true });
    for (const name of ["Add record", "Edit Custody Change", "Delete Custody Change"]) {
      const element = [...container.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === name || button.textContent === name)!;
      expect(element.disabled).toBe(true); button(name);
    }
    expect(document.querySelector("dialog")).toBeNull(); expect(props.onDelete).not.toHaveBeenCalled();
    button("Download Custody Change"); expect(props.onDownload).toHaveBeenCalledWith(record.id);
  });
  it("blocks portal submission after editing permission is revoked", () => {
    const props = mount(); button("Add record"); change("type", "Custody Change"); change("notes", "Unsaved private note");
    act(() => root!.render(createElement(ProtectionPanel, { ...props, readOnly: true })));
    expect(document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')?.disabled).toBe(true);
    expect(control("type").disabled).toBe(true);
    act(() => document.querySelector("dialog form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("no longer have editing access");
    button("Cancel"); expect(document.querySelector("dialog")).toBeNull();
  });
});

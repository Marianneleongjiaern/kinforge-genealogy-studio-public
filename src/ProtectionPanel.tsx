import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, LockKeyhole, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import type { AppState, ProtectionEntityKind, ProtectionRecord } from "./domain";
import {
  createProtectionRecord, effectiveSensitiveVisibility, PROTECTION_RECORD_TYPES,
  protectionRecordsForEntity, SENSITIVE_VISIBILITY_LABELS, upsertProtectionRecord
} from "./protection";
import type { ProtectionScope, ProtectionValidationErrors } from "./protection";
import { TermMeaning } from "./TermsDialog";
import "./protection.css";

export type ProtectionPanelProps = {
  state: AppState;
  treeId: string;
  entityKind: ProtectionEntityKind;
  entityId: string;
  /** Receives the full protectionRecords array, including unchanged entities and trees. */
  onChange: (records: ProtectionRecord[]) => void;
  /** Parent owns deletion confirmation, linked-record cleanup and downloads. */
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  canManagePrivacy: boolean;
  readOnly?: boolean;
};

export function ProtectionPanel(props: ProtectionPanelProps) {
  // Changing selection or owner access discards the previous entity's open editor.
  return <ScopedProtectionPanel key={JSON.stringify([props.treeId, props.entityKind, props.entityId, props.canManagePrivacy])} {...props} />;
}

function ScopedProtectionPanel({ state, treeId, entityKind, entityId, onChange, onDelete, onDownload, canManagePrivacy, readOnly = false }: ProtectionPanelProps) {
  const scope: ProtectionScope = { treeId, entityKind, entityId };
  const titleId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState<{ record: ProtectionRecord; isNew: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const records = protectionRecordsForEntity(state, scope, canManagePrivacy);
  const visibleEditor = editing && (editing.isNew || records.some(record => record.id === editing.record.id));
  useEffect(() => { if (editing && !visibleEditor) setEditing(null); }, [editing, visibleEditor]);

  return <section className="protection-panel" aria-labelledby={titleId}>
    <div className="protection-heading">
      <h2 id={titleId}>Protection and government records</h2>
      <button ref={addButton} className="button primary" type="button" disabled={readOnly} onClick={() => {
        if (readOnly) return;
        setNotice(""); setEditing({ record: createProtectionRecord(scope, canManagePrivacy), isNew: true });
      }}><Plus size={16} aria-hidden="true" />Add record</button>
    </div>
    <p className="protection-notice" role="status">{notice}</p>
    {!records.length && <p className="quiet">No protection or government records recorded.</p>}
    <div className="protection-list">{records.map(record => {
      const visibility = effectiveSensitiveVisibility(record.visibility);
      return <article className="protection-record" key={record.id}>
        <div className="protection-record-heading">
          <div>
            <h3>{record.type}</h3>
            <span className="protection-visibility">{visibility === "private" ? <LockKeyhole size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}{SENSITIVE_VISIBILITY_LABELS[visibility]}</span>
          </div>
          <div className="protection-actions">
            <button className="icon-button" type="button" disabled={readOnly} title={`Edit ${record.type}`} aria-label={`Edit ${record.type}`} onClick={() => {
              if (readOnly) return;
              setNotice(""); setEditing({ record, isNew: false });
            }}><Pencil size={17} aria-hidden="true" /></button>
            <button className="icon-button" type="button" title={`Download ${record.type}`} aria-label={`Download ${record.type}`} onClick={() => onDownload(record.id)}><Download size={17} aria-hidden="true" /></button>
            <button className="icon-button" type="button" disabled={readOnly} title={`Delete ${record.type}`} aria-label={`Delete ${record.type}`} onClick={() => { if (!readOnly) onDelete(record.id); }}><Trash2 size={17} aria-hidden="true" /></button>
          </div>
        </div>
        <dl className="protection-summary">
          {record.status && <div><dt>Recorded status</dt><dd>{record.status}</dd></div>}
          {record.startDate && <div><dt>Start date</dt><dd>{record.startDate}</dd></div>}
          {record.endDate && <div><dt>End date</dt><dd>{record.endDate}</dd></div>}
        </dl>
        <details><summary>Record details</summary><dl className="protection-details">
          {([['agency', 'Agency'], ['contact', 'Contact'], ['jurisdiction', 'Jurisdiction'], ['caseReference', 'Case reference'], ['notes', 'Notes']] as const).map(([field, label]) => record[field] && <div key={field}><dt>{label}</dt><dd>{record[field]}</dd></div>)}
          {!!record.sourceIds.length && <div><dt>Sources</dt><dd><ul>{record.sourceIds.map(id => <li key={id}>{state.sources.find(source => source.id === id && source.treeId === treeId)?.title || "Unavailable source"}</li>)}</ul></dd></div>}
          {!!record.mediaIds.length && <div><dt>Attachments</dt><dd><ul>{record.mediaIds.map(id => <li key={id}>{state.media.find(media => media.id === id && media.treeId === treeId && (canManagePrivacy || media.visibility !== "private"))?.title || "Unavailable attachment"}</li>)}</ul></dd></div>}
        </dl></details>
      </article>;
    })}</div>
    {editing && visibleEditor && <ProtectionEditor key={editing.record.id} state={state} scope={scope} initial={editing.record} isNew={editing.isNew}
      canManagePrivacy={canManagePrivacy} readOnly={readOnly} returnFocus={() => addButton.current?.focus()} onClose={() => setEditing(null)} onSave={records => {
        if (!readOnly) { onChange(records); setEditing(null); setNotice("Record saved."); }
      }} />}
  </section>;
}

type ProtectionEditorProps = {
  state: AppState;
  scope: ProtectionScope;
  initial: ProtectionRecord;
  isNew: boolean;
  canManagePrivacy: boolean;
  readOnly: boolean;
  returnFocus: () => void;
  onClose: () => void;
  onSave: (records: ProtectionRecord[]) => void;
};

function ProtectionEditor({ state, scope, initial, isNew, canManagePrivacy, readOnly, returnFocus, onClose, onSave }: ProtectionEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const [record, setRecord] = useState<ProtectionRecord>(() => ({ ...initial, visibility: effectiveSensitiveVisibility(initial.visibility), sourceIds: [...initial.sourceIds], mediaIds: [...initial.mediaIds] }));
  const [errors, setErrors] = useState<ProtectionValidationErrors>({});
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLSelectElement>("select")?.focus();
    return () => { element?.close(); if (previous?.isConnected && previous !== document.body) previous.focus(); else returnFocus(); };
  }, []);
  useEffect(() => {
    if (Object.keys(errors).length) dialog.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus();
  }, [errors]);
  const patch = <K extends keyof ProtectionRecord>(field: K, value: ProtectionRecord[K]) => setRecord(current => ({ ...current, [field]: value }));
  const errorId = (field: keyof ProtectionRecord) => `${prefix}-${field}-error`;
  const error = (field: keyof ProtectionRecord) => errors[field] ? <span className="protection-error" id={errorId(field)}>{errors[field]}</span> : null;
  const accessibility = (field: keyof ProtectionRecord) => ({ disabled: readOnly, "aria-invalid": errors[field] ? true as const : undefined, "aria-describedby": errors[field] ? errorId(field) : undefined });
  const types = [...new Set<string>([...PROTECTION_RECORD_TYPES, ...state.customEventTypes, ...(record.type ? [record.type] : [])])];

  const textField = (field: "status" | "startDate" | "endDate" | "agency" | "contact" | "jurisdiction" | "caseReference", label: string) => <label className="field" key={field}>
    <span>{label}</span><input className="control" name={field} aria-label={label} value={record[field]} autoComplete="off" {...accessibility(field)}
      placeholder={field === "startDate" || field === "endDate" ? "YYYY-MM-DD" : undefined} onChange={event => patch(field, event.target.value)} />{error(field)}
  </label>;
  const links = (field: "sourceIds" | "mediaIds", label: string) => {
    const available = field === "sourceIds" ? state.sources.filter(source => source.treeId === scope.treeId)
      : state.media.filter(media => media.treeId === scope.treeId && (canManagePrivacy || media.visibility !== "private"));
    const options = [...available, ...record[field].filter(id => !available.some(item => item.id === id)).map(id => ({ id, title: field === "sourceIds" ? "Unavailable source" : "Unavailable attachment" }))];
    return <fieldset className="protection-links" {...accessibility(field)}><legend>{label}</legend>
      <div className="protection-link-options">{options.map(item => <label key={item.id}><input type="checkbox" name={field} value={item.id} checked={record[field].includes(item.id)} onChange={event => patch(field, event.target.checked ? [...record[field], item.id] : record[field].filter(id => id !== item.id))} /><span>{item.title || "Untitled"}</span></label>)}</div>
      {!options.length && <p className="quiet">{field === "sourceIds" ? "No sources available." : "No attachments available."}</p>}{error(field)}
    </fieldset>;
  };

  return createPortal(<dialog ref={dialog} className="relative-dialog protection-dialog" aria-label={isNew ? "Add protection or government record" : "Edit protection or government record"} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2 id={`${prefix}-title`}>{isNew ? "Add protection or government record" : "Edit protection or government record"}</h2><button className="icon-button" type="button" title="Close record" aria-label="Close record" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
    <form noValidate autoComplete="off" onSubmit={event => {
      event.preventDefault();
      if (readOnly) { setErrors({ id: "You no longer have editing access to this library." }); return; }
      if (!isNew) {
        const current = state.protectionRecords?.find(entry => entry.id === initial.id);
        if (!current || JSON.stringify(current) !== JSON.stringify(initial)) {
          setErrors({ id: "This record changed while you were editing. Close and reopen it to use the latest version." }); return;
        }
      }
      const result = upsertProtectionRecord(state, scope, record, canManagePrivacy);
      if (result.ok) onSave(result.records); else setErrors(result.errors);
    }}>
      {!!Object.keys(errors).length && <div role="alert" tabIndex={-1} className="protection-error">{errors.id || errors.entityId || "Check the marked fields before saving."}</div>}
      {readOnly && <p role="status">You no longer have editing access to this library.</p>}
      <div className="protection-form-grid">
        <div><label className="field"><span>Record type</span><select className="control" name="type" aria-label="Record type" required value={record.type} {...accessibility("type")} onChange={event => patch("type", event.target.value)}><option value="">Select record type</option>{types.map(type => <option key={type} value={type}>{type}</option>)}</select>{error("type")}</label><TermMeaning term={record.type} /></div>
        {textField("status", "Recorded status")}
        {textField("startDate", "Start date")}{textField("endDate", "End date")}
        {textField("agency", "Agency")}{textField("contact", "Contact")}
        {textField("jurisdiction", "Jurisdiction")}{textField("caseReference", "Case reference")}
      </div>
      <label className="field"><span>Notes</span><textarea className="textarea" name="notes" aria-label="Notes" rows={4} value={record.notes} {...accessibility("notes")} onChange={event => patch("notes", event.target.value)} />{error("notes")}</label>
      <label className="field"><span>Visibility</span><select className="control" name="visibility" aria-label="Visibility" value={record.visibility} {...accessibility("visibility")} onChange={event => patch("visibility", event.target.value === "private" && canManagePrivacy ? "private" : "shared")}>
        {canManagePrivacy && <option value="private">{SENSITIVE_VISIBILITY_LABELS.private}</option>}<option value="shared">{SENSITIVE_VISIBILITY_LABELS.shared}</option>
      </select>{error("visibility")}</label>
      {links("sourceIds", "Sources")}{links("mediaIds", "Attachments")}
      <div className="protection-form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={readOnly}><Save size={16} aria-hidden="true" />Save record</button></div>
    </form>
  </dialog>, document.body);
}

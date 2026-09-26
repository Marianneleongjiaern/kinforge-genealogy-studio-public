import { useEffect, useRef, useState } from "react";
import { Download, Search, Trash2, X } from "lucide-react";
import { AppState } from "./domain";
import { DELETABLE_RECORDS, DeleteKind, DeleteTarget, deletionEntries, planDeletion } from "./deletion";

type Actions = { onDelete: (target: DeleteTarget) => void; onDownload: (target: DeleteTarget) => void; readOnly?: boolean; feedback?: string };
export function ItemActions({ target, title, onDelete, onDownload, readOnly }: Actions & { target: DeleteTarget; title: string }) {
  return <span className="item-actions"><button type="button" className="icon-button" title={`Download ${title}`} aria-label={`Download ${title}`} onClick={() => onDownload(target)}><Download size={17} /></button><button type="button" className="icon-button danger-icon" title={`Delete ${title}`} aria-label={`Delete ${title}`} disabled={readOnly} onClick={() => onDelete(target)}><Trash2 size={17} /></button></span>;
}

export function SavedItemsDialog({ state, treeId, initialKind, onClose, ...actions }: Actions & { state: AppState; treeId: string; initialKind: DeleteKind; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState(initialKind), [query, setQuery] = useState("");
  const [allTrees, setAllTrees] = useState(false);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  const entries = deletionEntries(state, kind, allTrees ? undefined : treeId).filter(entry => entry.title.toLowerCase().includes(query.toLowerCase()));
  return <dialog ref={ref} className="relative-dialog saved-items-dialog" aria-label="Saved items" onCancel={onClose}>
    <div className="dialog-heading"><h2 id="saved-items-title">Saved items</h2><button className="icon-button" aria-label="Close saved items" onClick={onClose}><X size={20} /></button></div>
    <div className="saved-item-filters"><label className="field"><span>Item type</span><select className="control" aria-label="Item type" value={kind} onChange={e => setKind(e.target.value as DeleteKind)}>{Object.entries(DELETABLE_RECORDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="tree-search"><Search size={16} /><input aria-label="Search saved items" placeholder="Search saved items" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <label className="saved-items-scope"><input type="checkbox" checked={allTrees} onChange={e => setAllTrees(e.target.checked)} />All trees in this library</label>
    <p className="quiet">Downloads include this item's private details and stored attachments. Keep exported copies secure.</p>
    {actions.feedback && <p role="status">{actions.feedback}</p>}
    <div className="saved-item-list">{entries.map(({ target, title }) => <div className="saved-item-row" key={`${target.ownerId || ""}:${target.id}`}><span>{title}</span><ItemActions {...actions} target={target} title={title} /></div>)}{!entries.length && <p className="quiet">No saved items match.</p>}</div>
  </dialog>;
}

export function DeleteItemDialog({ state, target, readOnly, onConfirm, onClose, onDownload, cloud, feedback }: { state: AppState; target: DeleteTarget; readOnly?: boolean; onConfirm: () => void; onClose: () => void; onDownload: (target: DeleteTarget) => void; cloud: boolean; feedback?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const plan = planDeletion(state, target);
  const fingerprint = JSON.stringify(plan.counts);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  useEffect(() => { setName(""); }, [plan.title, fingerprint]);
  return <dialog ref={ref} className="relative-dialog delete-item-dialog" aria-labelledby="delete-item-title" onCancel={onClose}>
    <div className="dialog-heading"><h2 id="delete-item-title">Delete {DELETABLE_RECORDS[target.kind].toLowerCase()}?</h2><button className="icon-button" aria-label="Close delete confirmation" onClick={onClose}><X size={20} /></button></div>
    {plan.exists ? <><p><strong>{plan.title}</strong></p><ul className="deletion-counts">{plan.counts.map(c => <li key={c.label}>{c.count} {c.label.toLowerCase()}{c.count === 1 ? "" : " records"}</li>)}</ul>
      <p>{plan.container ? "This also deletes the items listed above inside it. Other books, collections and trees are kept." : "Links to this item are removed. Other people and unrelated records are kept."}</p>
      {target.kind === "families" && <p>The family record is removed, but its people and relationship lines remain.</p>}
      <p>{cloud ? "This deletion syncs to all devices and members of this shared library." : "This deletion changes this device's demo library."} Previously exported files and cloud backup history are not erased.</p>
      {plan.container && <label className="field"><span>Type the name to confirm</span><input className="control" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>}
      {readOnly && <p role="alert">You no longer have editing access to this library.</p>}
      {feedback && <p role="status">{feedback}</p>}
      <div className="dialog-footer"><button className="button secondary" onClick={() => onDownload(target)}><Download size={16} />Download first</button><button className="button secondary" autoFocus onClick={onClose}>Cancel</button><button className="button danger" disabled={readOnly || (plan.container && name !== plan.title)} onClick={onConfirm}><Trash2 size={16} />Delete</button></div>
    </> : <><p>This item has already been removed.</p><button className="button secondary" onClick={onClose}>Close</button></>}
  </dialog>;
}

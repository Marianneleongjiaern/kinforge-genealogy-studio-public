import { useEffect, useId, useRef, useState } from "react";
import { LockKeyhole, Pencil, Plus, Save, Search, Trash2, Users, X } from "lucide-react";
import { Person, PersonNeed, Source } from "./domain";
import { CaptionedGlyph, Glyph, SymbolLegend } from "./Glyph";
import { NEED_GLYPHS, PERSON_GLYPH_GROUPS, createPersonNeed, glyphById, glyphMatchesQuery, groupPersonNeeds } from "./glyphs";

export function PersonNeedsSummary({ person }: { person: Person }) {
  if (!person.accessNeeds?.length) return null;
  return <section className="person-needs-private" aria-label={person.sensitiveVisibility === "shared" ? "Shared disability and access needs" : "Private disability and access needs"}><h2>Disability and access needs</h2>{groupPersonNeeds(person.accessNeeds).map(({ group, needs }) => <div className="needs-summary-group" key={group}><h3>{group}</h3><div className="needs-summary">{needs.map(need => <div key={need.id}><CaptionedGlyph id={need.glyphId} label={need.label} />{person.sensitiveVisibility === "shared" ? <Users size={13} aria-label="Shared annotation" /> : <LockKeyhole size={13} aria-label="Private annotation" />}</div>)}</div></div>)}</section>;
}

export function PersonNeeds({ person, sources, onChange }: { person: Person; sources: Source[]; onChange: (needs: PersonNeed[]) => void }) {
  const [editing, setEditing] = useState<PersonNeed | "new" | null>(null);
  const needs = person.accessNeeds ?? [];
  return <section className="person-needs-private" aria-label="Disability and access needs">
    <div className="needs-heading"><div><h2>Disability and access needs</h2><span className="needs-privacy">{person.sensitiveVisibility === "shared" ? <><Users size={14} />Visible to shared-library members</> : <><LockKeyhole size={14} />Private to your account</>}</span></div><div className="needs-actions"><SymbolLegend /><button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={16} />Add annotation</button></div></div>
    {groupPersonNeeds(needs).map(({ group, needs: entries }) => <div className="needs-record-group" key={group}><h3 className="needs-group-title">{group}</h3><div className="needs-list">{entries.map(need => <article className="need-row" key={need.id}><CaptionedGlyph id={need.glyphId} size={24} /><div><h4>{need.label}</h4><p>{glyphById(need.glyphId)?.meaning || "Unrecognized annotation symbol; read the recorded wording."}</p>{need.detail && <p>{need.detail}</p>}{need.sourceId && <small>{sources.find(source => source.id === need.sourceId)?.title ?? "Source unavailable"}</small>}</div><div className="needs-actions"><button className="icon-button" type="button" title={`Edit ${need.label}`} aria-label={`Edit ${need.label}`} onClick={() => setEditing(need)}><Pencil size={17} /></button><button className="icon-button" type="button" title={`Remove ${need.label}`} aria-label={`Remove ${need.label}`} onClick={() => onChange(needs.filter(entry => entry.id !== need.id))}><Trash2 size={17} /></button></div></article>)}</div></div>)}
    {!needs.length && <p className="empty-state">No disability or access needs recorded.</p>}
    {editing && <NeedDialog key={editing === "new" ? "new" : editing.id} shared={person.sensitiveVisibility === "shared"} need={editing === "new" ? undefined : editing} sources={sources} onClose={() => setEditing(null)} onSave={value => {
      onChange(editing === "new" ? [...needs, value] : needs.map(entry => entry.id === editing.id ? value : entry));
      setEditing(null);
    }} />}
  </section>;
}

function NeedDialog({ need, sources, onClose, onSave, shared }: { need?: PersonNeed; sources: Source[]; onClose: () => void; onSave: (need: PersonNeed) => void; shared: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [glyphId, setGlyphId] = useState(need?.glyphId ?? "");
  const [detail, setDetail] = useState(need?.detail ?? "");
  const [sourceId, setSourceId] = useState(need?.sourceId ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [recordLabel, setRecordLabel] = useState(need?.label ?? "");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const matching = NEED_GLYPHS.filter(glyph => (category === "All" || glyph.group === category) && glyphMatchesQuery(glyph, query));
  const selected = NEED_GLYPHS.find(glyph => glyph.id === glyphId);
  return <dialog className="relative-dialog glyph-dialog" ref={dialog} aria-labelledby={titleId} onCancel={onClose}>
    <div className="dialog-heading"><h2 id={titleId}>{need ? "Edit annotation" : "Add annotation"}</h2><button type="button" className="icon-button" title="Close annotation" aria-label="Close annotation" onClick={onClose}><X size={20} /></button></div>
    <p className="quiet">{shared ? "Visible to shared-library members" : "Private to your account"}</p>
    <form onSubmit={event => { event.preventDefault(); if (!glyphId) return; const value = selected ? createPersonNeed(glyphId, detail, sourceId || undefined, recordLabel) : { ...need!, label: recordLabel.trim() || need!.label, detail: detail.trim(), sourceId: sourceId || undefined }; onSave({ ...value, id: need?.id ?? value.id }); }}>
      <label className="tree-search"><Search size={16} /><input aria-label="Find an annotation symbol" placeholder="Find a symbol" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="segmented glyph-categories" role="group" aria-label="Annotation category">{["All", ...PERSON_GLYPH_GROUPS].map(group => <button type="button" key={group} aria-pressed={category === group} className={category === group ? "active" : ""} onClick={() => setCategory(group)}>{group}</button>)}</div>
      <fieldset className="glyph-picker"><legend>Annotation type</legend><div className="glyph-picker-grid">{PERSON_GLYPH_GROUPS.map(group => <div className="glyph-picker-group" key={group}>{matching.some(glyph => glyph.group === group) && <><h3>{group}</h3>{matching.filter(glyph => glyph.group === group).map(glyph => <label key={glyph.id} className={`glyph-option ${glyphId === glyph.id ? "selected" : ""}`}><input type="radio" name="annotation-type" value={glyph.id} checked={glyphId === glyph.id} onChange={() => { setGlyphId(glyph.id); setRecordLabel(glyph.label); }} /><Glyph id={glyph.id} decorative /><span>{glyph.label}</span></label>)}</>}</div>)}</div>{!matching.length && <p className="quiet">No matching symbols.</p>}</fieldset>
      {glyphId && <div className="selected-glyph"><Glyph id={glyphId} size={26} decorative /><strong>{selected?.label ?? need?.label}</strong>{shared ? <Users size={15} aria-label="Shared annotation" /> : <LockKeyhole size={15} aria-label="Private annotation" />}</div>}
      {glyphId && <label className="field"><span>Record label</span><input className="control" maxLength={120} value={recordLabel} onChange={event => setRecordLabel(event.target.value)} /></label>}
      <label className="field"><span>Details in the person's preferred terms</span><textarea className="textarea compact" maxLength={4000} value={detail} onChange={event => setDetail(event.target.value)} /></label>
      <label className="field"><span>Source</span><select className="control" value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">No source attached</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}{sourceId && !sources.some(source => source.id === sourceId) && <option value={sourceId}>Source unavailable</option>}</select></label>
      <div className="dialog-footer"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={!glyphId}><Save size={16} />Save annotation</button></div>
    </form>
  </dialog>;
}

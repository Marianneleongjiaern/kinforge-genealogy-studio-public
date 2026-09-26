import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import catalog from "./requirements.generated.json";

export function RequirementsRegister() {
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [page, setPage] = useState(0);
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const rows = catalog.entries.filter(e => (!sourceId || e.sourceId === sourceId) && terms.every(t => `${e.text} ${e.section}`.toLocaleLowerCase().includes(t)));
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  return <section className="requirements-register" aria-labelledby="requirements-title">
    <h2 id="requirements-title">Source Requirements</h2>
    <p>{catalog.sources.length} documents | {catalog.entries.length} indexed passages | Full verification pending</p>
    <div className="register-filters">
      <label className="field"><span>Search requirements</span><input type="search" className="control" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      <label className="field"><span>Source document</span><select className="control" value={sourceId} onChange={e => { setSourceId(e.target.value); setPage(0); }}>
        <option value="">All documents</option>{catalog.sources.map(s => <option key={s.id} value={s.id}>{s.path}</option>)}
      </select></label>
    </div>
    <p role="status">{rows.length} matching passages</p>
    {rows.slice(page * 20, (page + 1) * 20).map(e => <details key={e.id} className="requirement-passage">
      <summary>{e.text.slice(0, 170)}{e.text.length > 170 ? "..." : ""}</summary>
      <small>{catalog.sources.find(s => s.id === e.sourceId)?.path} | line {e.line} | {e.kind} | {e.status}</small>
      <p>{e.section}</p><pre>{e.text}</pre>
    </details>)}
    <div className="register-pagination"><button disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous requirements page" title="Previous requirements page"><ChevronLeft size={18} /></button><span>{page + 1} / {pageCount}</span><button disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)} aria-label="Next requirements page" title="Next requirements page"><ChevronRight size={18} /></button></div>
  </section>;
}

import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { GLOSSARY_NOTE, GLOSSARY_SOURCES, meaningFor, searchTerms } from "./terms";
import "./terms.css";

export type CustomGlossaryEntry = { term: string; meaning: string; category: string; aliases: readonly string[]; sourceIds: readonly string[] };

export function TermMeaning({ term, customEntries = [] }: { term: string; customEntries?: readonly CustomGlossaryEntry[] }) {
  const meaning = meaningFor(term) || customEntries.find(entry => entry.term.toLocaleLowerCase() === term.toLocaleLowerCase() || entry.aliases?.some(alias => alias.toLocaleLowerCase() === term.toLocaleLowerCase()))?.meaning;
  if (!meaning) return null;
  return <span className="term-meaning" aria-label={`Meaning of ${term}`}>{meaning}</span>;
}

export function TermsDialog({ onClose, customEntries = [] }: { onClose: () => void; customEntries?: readonly CustomGlossaryEntry[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const searchId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const matching = searchTerms(query, customEntries);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    search.current?.focus();
    return () => {
      if (element?.open) element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => { if (results.current) results.current.scrollTop = 0; }, [query]);

  return <dialog ref={dialog} className="relative-dialog terms-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <div className="dialog-heading">
      <h2 id={titleId}><BookOpen size={20} aria-hidden="true" />Terms and meanings</h2>
      <button type="button" className="icon-button" aria-label="Close terms" title="Close terms" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <div className="terms-search-area">
      <label className="terms-search-label" htmlFor={searchId}>Search terms</label>
      <div className="tree-search terms-search">
        <Search size={16} aria-hidden="true" />
        <input ref={search} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search terms or meanings" aria-controls={resultsId} autoComplete="off" />
        <button type="button" className="icon-button terms-clear" aria-label="Clear search" title="Clear search" disabled={!query} onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="terms-count" role="status" aria-live="polite" aria-atomic="true">{matching.length ? `${matching.length} ${matching.length === 1 ? "term" : "terms"}` : "No matching terms."}</p>
    </div>
    <div ref={results} id={resultsId} className="terms-results" role="region" aria-label="Term meanings" tabIndex={0}>
      <dl className="terms-list">{matching.map(entry => <div className="terms-row" key={entry.term}>
        <dt>{entry.term}<small>{entry.category}</small></dt>
        <dd>{entry.meaning}</dd>
      </div>)}</dl>
    </div>
    <footer className="terms-footer">
      <p>{GLOSSARY_NOTE}</p>
      <details>
        <summary>Sources and context</summary>
        <p>Government and court references describe their own jurisdictions. Religious references describe that faith's practices. General record labels describe the saved information, not a legal finding.</p>
        <ul>{GLOSSARY_SOURCES.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
      </details>
    </footer>
  </dialog>;
}

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { BELIEF_OPTIONS, RELIGION_OPTIONS, RELIGIOUS_PRACTICE_OPTIONS } from "./personFactCatalog";
import type { CustomFactTerm } from "./domain";
import "./terms.css";

type ReligiousEntry = { term: string; meaning: string; category: string };

export function ReligiousTermsDialog({ customTerms = [], onClose }: { customTerms?: readonly CustomFactTerm[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const entries = useMemo<ReligiousEntry[]>(() => [
    ...RELIGION_OPTIONS.map(entry => ({ term: entry.label, meaning: entry.meaning, category: "Religion and denomination" })),
    ...BELIEF_OPTIONS.map(entry => ({ term: entry.label, meaning: entry.meaning, category: "Belief and worldview" })),
    ...RELIGIOUS_PRACTICE_OPTIONS.map(entry => ({ term: entry.label, meaning: entry.meaning, category: "Practice and observance" })),
    ...customTerms.filter(entry => ["Religion", "Belief", "Religious practice"].includes(entry.category)).map(entry => ({ term: entry.term, meaning: entry.meaning, category: `${entry.category} - custom` }))
  ], [customTerms]);
  const matching = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter(entry => words.every(word => `${entry.term} ${entry.meaning} ${entry.category}`.toLocaleLowerCase().includes(word)));
  }, [entries, query]);

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

  return <dialog ref={dialog} className="relative-dialog terms-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <div className="dialog-heading">
      <h2 id={titleId}><BookOpen size={20} aria-hidden="true" />Religious terms and practices</h2>
      <button type="button" className="icon-button" aria-label="Close religious terms" title="Close religious terms" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <p className="quiet">Browse the recorded names, beliefs, denominations, practices, and observances in KinForge. This is a family-history reference, not a rulebook: a tradition can be understood and practiced differently by different people and communities.</p>
    <div className="terms-search-area">
      <label className="terms-search-label" htmlFor={`${titleId}-search`}>Search religious terms</label>
      <div className="tree-search terms-search">
        <Search size={16} aria-hidden="true" />
        <input ref={search} id={`${titleId}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a religion, denomination, belief, or practice" autoComplete="off" />
        <button type="button" className="icon-button terms-clear" aria-label="Clear religious search" title="Clear religious search" disabled={!query} onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="terms-count" role="status" aria-live="polite" aria-atomic="true">{matching.length ? `${matching.length} ${matching.length === 1 ? "term" : "terms"}` : "No matching religious terms."}</p>
    </div>
    <div className="terms-results" role="region" aria-label="Religious terms list" tabIndex={0}>
      <dl className="terms-list">{matching.map(entry => <div className="terms-row" key={`${entry.category}:${entry.term}`}><dt>{entry.term}<small>{entry.category}</small></dt><dd>{entry.meaning}</dd></div>)}</dl>
    </div>
    <footer className="terms-footer">
      <p>When a person has a practice, denomination, or fictional tradition that is not listed, use the custom-term editor in the person's Facts section. Keep the person's wording, dates, source, and any community-specific rules with the record.</p>
      <details><summary>Reference context</summary><ul>
        <li><a href="https://www.pewresearch.org/religion/2026/02/12/religious-diversity-around-the-world/" target="_blank" rel="noopener noreferrer">Pew Research Center: Religious Diversity Around the World</a></li>
        <li><a href="https://www.churchofjesuschrist.org/learn/about-us?lang=eng" target="_blank" rel="noopener noreferrer">The Church of Jesus Christ of Latter-day Saints: About Us</a></li>
      </ul></details>
    </footer>
  </dialog>;
}

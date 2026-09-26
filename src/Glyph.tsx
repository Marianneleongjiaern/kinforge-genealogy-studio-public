import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, Search, X } from "lucide-react";
import { GLYPHS, eventGlyph, glyphById, glyphMatchesQuery } from "./glyphs";
import { GlyphArtwork } from "./GlyphArtwork";

export function Glyph({ id, size = 20, label, decorative = false }: { id: string; size?: number; label?: string; decorative?: boolean }) {
  const glyph = glyphById(id);
  const titleId = useId();
  return <GlyphArtwork glyph={glyph ?? glyphById("other-support")!} className="kin-glyph" data-glyph={id} size={size} aria-hidden={decorative || undefined} role={decorative ? undefined : "img"} aria-labelledby={decorative ? undefined : titleId} focusable="false">
    {!decorative && <title id={titleId}>{label ?? glyph?.label ?? "Unrecognized symbol"}</title>}
  </GlyphArtwork>;
}

export function EventGlyph({ type }: { type: string }) {
  return <Glyph id={eventGlyph(type).id} decorative />;
}

export function CaptionedGlyph({ id, label, meaning, size = 22 }: { id: string; label?: string; meaning?: string; size?: number }) {
  const glyph = glyphById(id);
  return <span className="captioned-glyph" title={meaning || glyph?.meaning}>
    <Glyph id={id} size={size} decorative /><span className="glyph-caption">{label || glyph?.label || "Unrecognized symbol"}</span>
  </span>;
}

export function SymbolLegend() {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="button secondary" onClick={() => setOpen(true)}><CircleHelp size={16} />Symbol legend</button>{open && <LegendDialog onClose={() => setOpen(false)} />}</>;
}

function LegendDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const matching = GLYPHS.filter(glyph => glyphMatchesQuery(glyph, query));
  return <dialog className="relative-dialog glyph-dialog" ref={dialog} onCancel={onClose} aria-labelledby={titleId}>
    <div className="dialog-heading"><h2 id={titleId}>Symbol legend</h2><button type="button" className="icon-button" aria-label="Close symbol legend" title="Close symbol legend" onClick={onClose}><X size={20} /></button></div>
    <label className="tree-search"><Search size={16} /><input aria-label="Search symbols" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search symbols" /></label>
    <div className="glyph-legend-list">{matching.map(glyph => <div className="glyph-legend-row" key={glyph.id}><Glyph id={glyph.id} size={24} decorative /><div><strong>{glyph.label}</strong><small>{glyph.group}</small><p>{glyph.meaning}</p></div></div>)}{!matching.length && <p className="quiet" role="status">No matching symbols.</p>}</div>
  </dialog>;
}

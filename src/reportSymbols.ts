import type { JSONContent } from "@tiptap/core";
import { AppState, Person, fullName } from "./domain";
import { personSymbols, PersonSymbol } from "./personSymbols";
import { FamilyLine, LINE_STYLES, UNION_STATUS_LABELS } from "./familyLines";

export function symbolDocument(symbols: PersonSymbol[]): JSONContent {
  return { type: "reportSymbols", content: symbols.map(symbol => ({ type: "reportSymbol", content: [
    { type: "reportGlyph", attrs: { glyphId: symbol.glyphId, label: symbol.label } },
    { type: "paragraph", content: [{ type: "text", text: symbol.label, marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: symbol.meaning }] },
    ...(symbol.detail ? [{ type: "paragraph", content: [{ type: "text", text: symbol.detail }] }] : [])
  ] })) };
}

export function personSymbolDocument(state: AppState, person: Person, includePrivate = false): JSONContent[] {
  const symbols = personSymbols(state, person, includePrivate);
  return symbols.length ? [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: `Symbols for ${fullName(person)}` }] }, symbolDocument(symbols)] : [];
}

export function lineLegendDocument(lines: FamilyLine[]): JSONContent {
  const kinds = [...new Set(lines.flatMap(line => line.paths.map(p => p.kind)))];
  const statuses = [...new Set(lines.flatMap(line => line.status && ["separated", "divorced", "annulled"].includes(line.status) ? [line.status] : []))];
  const captions = [
    ...kinds.map(kind => ({ kind, label: LINE_STYLES[kind].label })),
    ...statuses.filter(status => !kinds.includes(status)).map(status => ({ status, label: UNION_STATUS_LABELS[status] }))
  ];
  return { type: "reportSymbols", content: captions.map(({ label, ...attrs }) => ({ type: "reportSymbol", content: [{ type: "reportLine", attrs: { ...attrs, label } }, { type: "paragraph", content: [{ type: "text", text: label }] }] })) };
}

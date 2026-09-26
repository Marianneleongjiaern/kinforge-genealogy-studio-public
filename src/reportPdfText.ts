import type jsPDF from "jspdf";

export type PdfTextRun = { text: string; x: number; y: number; width: number; height: number; size: number };
export const pdfUnicode = (text: string) => `FEFF${Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, "0")).join("")}`;

type PdfFont = { id: string; objectNumber: number; isAlreadyPutted: boolean; metadata: unknown };
type FontEvent = { font: PdfFont; newObject: () => number; out: (s: string) => void; putStream: (o: { data: string; objectId: number }) => void };

// A nonpainting Type 3 font maps every original Unicode code point, including
// surrogate pairs. Browser pixels supply appearance; this font supplies selection.
export function createPdfTextLayer(pdf: jsPDF) {
  const groups: { font: PdfFont; chars: string[] }[] = [];
  const codes = new Map<string, { group: number; code: number }>();
  pdf.internal.events.subscribe("putFont", ({ font, newObject, out, putStream }: FontEvent) => {
    const group = groups.find(g => g.font.id === font.id);
    if (!group) return;
    const glyph = newObject();
    putStream({ data: "1000 0 d0", objectId: glyph }); out("endobj");
    const map = newObject();
    const entries = group.chars.map((c, i) => `<${(i + 1).toString(16).padStart(2, "0")}> <${pdfUnicode(c).slice(4)}>`);
    const chunks: string[] = [];
    for (let i = 0; i < entries.length; i += 100) { const part = entries.slice(i, i + 100); chunks.push(`${part.length} beginbfchar\n${part.join("\n")}\nendbfchar`); }
    putStream({ objectId: map, data: `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /KinForgeUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n${chunks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend` }); out("endobj");
    font.objectNumber = newObject();
    out(`<< /Type /Font /Subtype /Type3 /Name /${font.id} /FontBBox [0 -250 1000 1000] /FontMatrix [0.001 0 0 0.001 0 0] /FirstChar 1 /LastChar ${group.chars.length} /Widths [${group.chars.map(() => "1000").join(" ")}] /Encoding << /Type /Encoding /Differences [1 ${group.chars.map((_, i) => `/g${i + 1}`).join(" ")}] >> /CharProcs << ${group.chars.map((_, i) => `/g${i + 1} ${glyph} 0 R`).join(" ")} >> /Resources << >> /ToUnicode ${map} 0 R >>`);
    out("endobj"); font.isAlreadyPutted = true;
  });
  return (runs: PdfTextRun[], pageHeight: number) => {
    const commands: string[] = [];
    for (const run of runs) {
      const chars = Array.from(run.text);
      if (!chars.length || !run.width) continue;
      let x = run.x;
      for (const char of chars) {
        let entry = codes.get(char);
        if (!entry) {
          if (!groups.length || groups[groups.length - 1].chars.length === 255) {
            const name = `ReportSelection${groups.length}`;
            // Register using the already bundled font, then replace its metadata
            // so jsPDF's TTF serializer leaves our Type 3 font to this handler.
            pdf.addFont("reportPdfNotoSans.ttf", name, "normal");
            pdf.setFont(name, "normal");
            const font = pdf.getFont() as unknown as PdfFont;
            font.metadata = {}; groups.push({ font, chars: [] });
          }
          const group = groups.length - 1;
          groups[group].chars.push(char); entry = { group, code: groups[group].chars.length }; codes.set(char, entry);
        }
        const width = run.width / chars.length;
        commands.push(`BT /${groups[entry.group].font.id} 1 Tf 3 Tr ${width.toFixed(4)} 0 0 ${run.size.toFixed(4)} ${x.toFixed(4)} ${(pageHeight - run.y - run.height + (run.height - run.size) / 2 + run.size * .2).toFixed(4)} Tm <${entry.code.toString(16).padStart(2, "0")}> Tj ET`);
        x += width;
      }
    }
    return commands.join("\n");
  };
}

export function measurePdfText(root: HTMLElement): PdfTextRun[] {
  const origin = root.getBoundingClientRect(), result: PdfTextRun[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text, parent = node.parentElement;
    if (!parent || parent.closest("[data-pdf-skip-text],script,style,[hidden]")) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const range = document.createRange();
    let offset = 0;
    for (const char of Array.from(node.data)) {
      range.setStart(node, offset); offset += char.length; range.setEnd(node, offset);
      const rect = range.getBoundingClientRect();
      if (!rect.height || !rect.width || /[\r\n]/.test(char)) continue;
      result.push({ text: char, x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height, size: parseFloat(style.fontSize) });
    }
  }
  return result;
}

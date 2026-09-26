import jsPDF, { AcroFormTextField } from "jspdf";
import html2canvas from "html2canvas";
import type { ReportPresentation } from "./reportOptions";
import { createPdfTextLayer, measurePdfText, pdfUnicode, type PdfTextRun } from "./reportPdfText";
import { createReportPdfLayout, pageDecoration } from "./reportPdfLayout";
import { PUBLIC_EXPORT_NOTICE } from "./exportAttribution";

const PX = 4 / 3;
const fontFiles = new Map<string, Promise<string>>();
type EditableFontMetadata = {
  cmap: { unicode: { codeMap: Record<string, number> } };
  Unicode: { widths: (number | number[])[] };
  glyIdsUsed: number[];
  toUnicode: Record<number, number>;
  widthOfGlyph: (glyph: number) => number;
  rawData: Uint8Array;
  subset: { encode: (glyphs: number[], format: number) => Uint8Array };
};

function retainEditableGlyphs(pdf: jsPDF, name: string) {
  pdf.setFont(name, "normal");
  const metadata = pdf.getFont().metadata as unknown as EditableFontMetadata;
  const used = new Set<number>([0]);
  metadata.Unicode.widths = [];
  for (const [code, glyph] of Object.entries(metadata.cmap.unicode.codeMap)) {
    if (!glyph || Number(code) > 65535 || used.has(glyph)) continue;
    used.add(glyph); metadata.toUnicode[glyph] = Number(code);
    metadata.Unicode.widths.push(glyph, [Math.trunc(metadata.widthOfGlyph(glyph))]);
  }
  // Editing can introduce characters absent from the initial values. Keep the
  // bundled font's BMP repertoire instead of embedding only those initial names.
  metadata.glyIdsUsed = [...used];
  // Full-font embedding also avoids jsPDF's quadratic CJK subset traversal.
  metadata.subset.encode = () => metadata.rawData;
}
async function loadFont(pdf: jsPDF, file: string, name: string) {
  let pending = fontFiles.get(file);
  if (!pending) {
    pending = fetch(new URL(`fonts/${file}`, document.baseURI)).then(async response => {
      if (!response.ok) throw new Error(`The bundled PDF font ${file} is unavailable.`);
      const data = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
      return btoa(binary);
    }).catch(error => { fontFiles.delete(file); throw error; });
    fontFiles.set(file, pending);
  }
  pdf.addFileToVFS(file, await pending); pdf.addFont(file, name, "normal");
}

type InternalPdf = jsPDF["internal"] & {
  write: (text: string) => void;
  newObjectDeferred: () => number;
  newObjectDeferredBegin: (id: number, begin: boolean) => void;
  putStream: (options: { data?: string; objectId: number; additionalKeyValues: { key: string; value: string }[]; filters?: string[] }) => void;
  out: (text: string) => void;
  collections: { addImage_images: Record<string, { alias: string; index: number }> };
  acroformPlugin: { acroFormDictionaryRoot: object };
};
type FieldWithDictionary = AcroFormTextField & { getKeyValueListForStream: () => { key: string; value: unknown }[] };
type PreparedField = { element: HTMLElement; id: string; label: string; value: string; x: number; y: number; width: number; height: number; size: number; runs: PdfTextRun[]; canvas: HTMLCanvasElement };
const points = (run: PdfTextRun): PdfTextRun => ({ text: run.text, x: run.x / PX, y: run.y / PX, width: run.width / PX, height: run.height / PX, size: run.size / PX });

function addInteractiveField(pdf: jsPDF, field: PreparedField, x: number, y: number, textLayer: ReturnType<typeof createPdfTextLayer>, font: string) {
  const internal = pdf.internal as InternalPdf, w = field.width / PX, h = field.height / PX;
  const widget = new AcroFormTextField() as FieldWithDictionary;
  widget.fieldName = field.id; widget.value = field.value; widget.defaultValue = field.value;
  widget.x = x; widget.y = y; widget.width = w; widget.height = h;
  widget.fontName = font; widget.fontSize = field.size / PX;
  widget.multiline = field.value.includes("\n") || field.height > field.size * 1.6;
  widget.showWhenPrinted = true;
  Object.defineProperty(widget, "hasAppearanceStream", { get: () => false });
  const alias = `appearance-${field.id}`;
  // The unused form registers the image/font resources without painting the old
  // value onto the page. The widget alone owns its appearance and searchable text.
  pdf.beginFormObject(0, 0, w, h, pdf.Matrix(1, 0, 0, 1, 0, 0));
  pdf.addImage(field.canvas, "PNG", 0, 0, w, h, alias, "FAST");
  pdf.setFont(font, "normal").setFontSize(12);
  pdf.text(`${Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("")} ${field.value}`, 0, 0, { renderingMode: "invisible" });
  pdf.endFormObject(alias);
  const fontId = pdf.getFont().id;
  const image = Object.values(internal.collections.addImage_images).find(item => item.alias === alias)!;
  const content = `q ${w} 0 0 ${h} 0 0 cm /I${image.index} Do Q\n${textLayer(field.runs.map(points), h)}`;
  let appearanceId = 0;
  internal.events.subscribe("buildDocument", () => { appearanceId = internal.newObjectDeferred(); });
  const dictionary = widget.getKeyValueListForStream.bind(widget);
  widget.getKeyValueListForStream = () => [
    ...dictionary().filter(entry => !["V", "DV", "DA", "AP"].includes(entry.key)),
    { key: "V", value: `<${pdfUnicode(field.value)}>` }, { key: "DV", value: `<${pdfUnicode(field.value)}>` },
    { key: "TU", value: `<${pdfUnicode(field.label)}>` },
    { key: "DA", value: `(/${fontId} ${widget.fontSize} Tf 0 g)` },
    { key: "BS", value: "<< /W 0 >>" }, { key: "MK", value: "<< /BG [1 1 1] >>" },
    { key: "AP", value: `<< /N ${appearanceId} 0 R >>` }
  ];
  pdf.addField(widget);
  const root = internal.acroformPlugin.acroFormDictionaryRoot;
  if (!Object.hasOwnProperty.call(root, "DR")) Object.defineProperty(root, "DR", { value: "2 0 R", configurable: false });
  internal.events.subscribe("postPutResources", () => {
    internal.newObjectDeferredBegin(appearanceId, true);
    internal.putStream({ objectId: appearanceId, data: content, additionalKeyValues: [{ key: "Type", value: "/XObject" }, { key: "Subtype", value: "/Form" }, { key: "BBox", value: `[0 0 ${w} ${h}]` }, { key: "Resources", value: "2 0 R" }] });
    internal.out("endobj");
  });
}

/** Hybrid PDF: browser-rendered visual page plus positioned Unicode text. */
export async function buildFormattedPdf(element: HTMLElement, format: "a4" | "letter", presentation: ReportPresentation = {}, fillable = false) {
  const pdf = new jsPDF({ unit: "pt", format, orientation: presentation.orientation || "portrait", compress: true });
  const internal = pdf.internal as InternalPdf, putStream = internal.putStream.bind(internal);
  // jsPDF 2.5 compresses even empty dictionaries into streams. A field must be
  // a dictionary: otherwise other readers can clone its widget and value apart.
  internal.putStream = options => putStream(options.data ? options : { ...options, filters: [] });
  pdf.setProperties({ title: "KinForge report", creator: "KinForge Genealogy Studio", subject: fillable ? "Searchable report with interactive form fields" : "Searchable report", keywords: PUBLIC_EXPORT_NOTICE });
  await loadFont(pdf, "reportPdfNotoSans.ttf", "ReportNoto");
  const textLayer = createPdfTextLayer(pdf);
  const { host, clone, geometry, scale, pages, dispose } = await createReportPdfLayout(element, format, presentation, fillable);
  try {
    const origin = clone.getBoundingClientRect(), fields: PreparedField[] = [];
    if (fillable) {
      for (const [i, value] of Array.from(clone.querySelectorAll<HTMLElement>(".report-field .report-field-value")).entries()) {
        const rect = value.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
        const label = value.closest<HTMLElement>(".report-field")?.dataset.label || value.closest(".report-field")?.querySelector(".report-field-label")?.textContent?.replace(/:\s*$/, "") || "Field";
        fields.push({ element: value, id: `report_field_${i + 1}`, label, value: value.textContent ? value.innerText : "", x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height, size: parseFloat(getComputedStyle(value).fontSize), runs: measurePdfText(value), canvas: await html2canvas(value, { scale: 2, backgroundColor: "#ffffff", logging: false }) });
        value.dataset.pdfSkipText = "true"; value.dataset.pdfField = "true";
      }
      retainEditableGlyphs(pdf, "ReportNoto");
      if (fields.some(field => /[\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7ff]/.test(field.value))) {
        await loadFont(pdf, "reportPdfNotoSansSC.ttf", "ReportNotoCJK");
        retainEditableGlyphs(pdf, "ReportNotoCJK");
      }
    }
    const runs = measurePdfText(clone);
    for (const [index, slice] of pages.entries()) {
      if (index) pdf.addPage();
      const page = document.createElement("section");
      Object.assign(page.style, { position: "relative", width: `${geometry.width * PX}px`, height: `${geometry.height * PX}px`, background: "white", overflow: "hidden" });
      pageDecoration(page, presentation, geometry, index, pages.length);
      host.replaceChildren(page);
      for (const image of page.querySelectorAll<HTMLImageElement>("img")) {
        try { await image.decode(); }
        catch { image.replaceWith(document.createTextNode(image.alt || "Image unavailable")); }
      }
      const decorationRuns = measurePdfText(page);
      const viewport = document.createElement("div");
      Object.assign(viewport.style, { position: "absolute", top: `${geometry.top * PX}px`, left: `${geometry.margin * PX}px`, width: `${geometry.contentWidth * PX}px`, height: `${(slice.end - slice.start) * scale}px`, overflow: "hidden" });
      clone.style.top = `${-slice.start * scale}px`; clone.style.transform = `scale(${scale})`; clone.style.transformOrigin = "top left";
      viewport.appendChild(clone); page.appendChild(viewport);
      const raster = await html2canvas(page, { scale: 2, backgroundColor: "#ffffff", logging: false, onclone: doc => doc.querySelectorAll<HTMLElement>('[data-pdf-field="true"]').forEach(node => { node.style.visibility = "hidden"; }) });
      pdf.addImage(raster, "PNG", 0, 0, geometry.width, geometry.height, undefined, "FAST");
      const pageRuns = runs.filter(run => run.y + run.height / 2 >= slice.start && run.y + run.height / 2 < slice.end).map(run => points({ ...run, x: run.x * scale + geometry.margin * PX, y: (run.y - slice.start) * scale + geometry.top * PX, width: run.width * scale, height: run.height * scale, size: run.size * scale }));
      (pdf.internal as InternalPdf).write(textLayer([...decorationRuns.map(points), ...pageRuns], geometry.height));
      pdf.setFont("ReportNoto", "normal");
      pdf.setFontSize(7);
      pdf.text(PUBLIC_EXPORT_NOTICE, geometry.margin, geometry.height - Math.max(10, geometry.margin / 2), { maxWidth: geometry.width - geometry.margin * 2 });
      for (const field of fields.filter(field => field.y >= slice.start - .1 && field.y < slice.end - .1)) {
        const font = /[\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7ff]/.test(field.value) ? "ReportNotoCJK" : "ReportNoto";
        const scaledField = { ...field, width: field.width * scale, height: field.height * scale, size: field.size * scale, runs: field.runs.map(run => ({ ...run, x: run.x * scale, y: run.y * scale, width: run.width * scale, height: run.height * scale, size: run.size * scale })) };
        addInteractiveField(pdf, scaledField, geometry.margin + field.x * scale / PX, geometry.top + (field.y - slice.start) * scale / PX, textLayer, font);
      }
    }
    return pdf;
  } finally { dispose(); }
}

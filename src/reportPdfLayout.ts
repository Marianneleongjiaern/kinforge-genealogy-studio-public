import type { ReportPresentation } from "./reportOptions";
import { REPORT_THEMES } from "./reportOptions";
import { measurePdfText } from "./reportPdfText";

export const PAGE_BREAK_SELECTOR = '[data-report-page-break],.report-page-break,[data-type="reportPageBreak"],reportPageBreak';
const PX = 4 / 3;
export const localPdfImage = (src: string) => /^data:image\/(png|jpe?g|webp);base64,/i.test(src);

export function reportPageGeometry(format: "a4" | "letter", presentation: ReportPresentation = {}) {
  const dims = format === "letter" ? [612, 792] : [595.28, 841.89];
  if (presentation.orientation === "landscape") dims.reverse();
  const requested = presentation.margin ?? 21;
  const margin = Number.isFinite(requested) ? Math.max(0, Math.min(144, requested)) : 21;
  const contentWidth = dims[0] - margin * 2;
  const lines = (text: string, width: number) => text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).reduce((w, c) => w + (c.charCodeAt(0) >= 0x2e80 ? 10 : 5.6), 0) / Math.max(40, width))), 0);
  const topBand = presentation.header || presentation.crest ? Math.max(40, lines(presentation.header || "", contentWidth - (presentation.crest ? 36 : 0)) * 13 + 8) : 0;
  const bottomBand = presentation.footer || presentation.pageNumbers ? Math.max(26, lines(presentation.footer || "", contentWidth - (presentation.pageNumbers ? 64 : 0)) * 13 + 8) : 0;
  const contentHeight = dims[1] - margin * 2 - topBand - bottomBand;
  if (contentHeight < 72) throw new Error("The header, footer and margins leave too little space for the report. Shorten the header or footer, or reduce the margins.");
  return { width: dims[0], height: dims[1], margin, top: margin + topBand, contentWidth: dims[0] - margin * 2, contentHeight };
}

export function preparePdfClone(element: HTMLElement, width: number, height: number, presentation: ReportPresentation, fillable: boolean) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.className = "report-document report-export";
  clone.removeAttribute("contenteditable"); clone.removeAttribute("role"); clone.removeAttribute("aria-label");
  const theme = REPORT_THEMES[presentation.theme || "aqua"];
  Object.assign(clone.style, { width: `${width}px`, position: "relative", margin: "0", background: "transparent", color: theme.ink, padding: "0", minHeight: "0", height: "auto", maxHeight: "none", overflow: "visible", display: "flow-root" });
  clone.querySelectorAll("script,style,link,iframe,object,embed,video,audio,source").forEach(node => node.remove());
  clone.querySelectorAll<HTMLElement>("*").forEach(node => {
    node.classList.remove("ProseMirror-selectednode", "report-object-selected"); node.removeAttribute("contenteditable");
    for (const attr of Array.from(node.attributes)) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    for (const property of Array.from(node.style)) if (/url\s*\(/i.test(node.style.getPropertyValue(property))) node.style.removeProperty(property);
    node.style.backgroundImage = "none";
    if (node.matches("h2")) { node.style.backgroundColor = (presentation as ReportPresentation & { printBackground?: boolean }).printBackground === false ? "transparent" : theme.band; node.style.borderColor = theme.accent; }
    if (node.matches(".report-header,.report-header img")) node.style.borderColor = theme.accent;
    if (node.matches(PAGE_BREAK_SELECTOR)) { node.textContent = ""; Object.assign(node.style, { height: "0", padding: "0", margin: "0", border: "0", minHeight: "0" }); }
    if (node.matches(".report-field-value") && fillable) Object.assign(node.style, { display: "inline-block", minWidth: "48px", minHeight: "1.4em", maxWidth: "100%", verticalAlign: "top" });
    if (node.matches("table")) Object.assign(node.style, { maxWidth: "100%", width: "100%", tableLayout: "fixed", borderCollapse: "collapse" });
    if (node.matches("td,th")) node.style.overflowWrap = "anywhere";
  });
  clone.querySelectorAll<HTMLImageElement>("img").forEach(img => {
    img.removeAttribute("srcset"); img.removeAttribute("loading");
    if (!localPdfImage(img.getAttribute("src") || "")) { const label = document.createElement("span"); label.textContent = img.alt || "Image unavailable"; img.replaceWith(label); }
    else img.style.maxHeight = `${Math.max(30, height - 100)}px`;
  });
  return clone;
}

export function pageDecoration(page: HTMLElement, presentation: ReportPresentation, geometry: ReturnType<typeof reportPageGeometry>, index: number, count: number) {
  const theme = REPORT_THEMES[presentation.theme || "aqua"];
  const add = (text: string, style: Partial<CSSStyleDeclaration>) => {
    const node = document.createElement("div"); node.textContent = text;
    Object.assign(node.style, { position: "absolute", left: `${geometry.margin * PX}px`, width: `${geometry.contentWidth * PX}px`, font: "10pt/1.3 Arial, sans-serif", color: theme.ink, overflowWrap: "anywhere", whiteSpace: "pre-wrap", ...style });
    page.appendChild(node); return node;
  };
  if (presentation.header) add(presentation.header, { top: `${geometry.margin * PX}px`, paddingLeft: presentation.crest ? "48px" : "0", boxSizing: "border-box" }).dataset.pdfDecoration = "header";
  if (presentation.footer) add(presentation.footer, { bottom: `${geometry.margin * PX}px`, paddingRight: presentation.pageNumbers ? "85px" : "0", boxSizing: "border-box" }).dataset.pdfDecoration = "footer";
  if (presentation.pageNumbers) add(`${index + 1} / ${count}`, { bottom: `${geometry.margin * PX}px`, textAlign: "right" });
  if (presentation.watermark && presentation.printBackground !== false) {
    add(presentation.watermark, { top: "45%", textAlign: "center", color: "#d5d5d5", fontSize: "32pt", transform: "rotate(-25deg)", opacity: ".35" }).dataset.pdfSkipText = "true";
  }
  if (presentation.crest && localPdfImage(presentation.crest)) {
    const crest = document.createElement("img"); crest.src = presentation.crest; crest.alt = "";
    Object.assign(crest.style, { position: "absolute", top: `${geometry.margin * PX}px`, left: `${geometry.margin * PX}px`, width: "36px", height: "36px", objectFit: "contain" }); page.appendChild(crest);
  }
}

/** Shared, non-raster layout for PDF export and the editor's paginated preview.
 * Geometry is in points; slices and the unscaled clone use source CSS pixels. */
export async function createReportPdfLayout(element: HTMLElement, format: "a4" | "letter", presentation: ReportPresentation = {}, fillable = false) {
  const geometry = reportPageGeometry(format, presentation);
  const host = document.createElement("div"); host.dataset.reportPdfHost = "true";
  Object.assign(host.style, { position: "fixed", left: "0", top: "0", zIndex: "-2147483647", pointerEvents: "none", width: `${geometry.width * PX}px` });
  document.body.appendChild(host);
  try {
    await document.fonts.ready;
    const sizingPage = document.createElement("section");
    Object.assign(sizingPage.style, { position: "relative", width: `${geometry.width * PX}px`, height: `${geometry.height * PX}px` });
    host.appendChild(sizingPage); pageDecoration(sizingPage, presentation, geometry, 0, 1);
    const headerHeight = sizingPage.querySelector('[data-pdf-decoration="header"]')?.getBoundingClientRect().height || 0;
    const footerHeight = sizingPage.querySelector('[data-pdf-decoration="footer"]')?.getBoundingClientRect().height || 0;
    const topBand = Math.max(geometry.top - geometry.margin, headerHeight ? headerHeight / PX + 8 : 0);
    const bottomBand = Math.max(geometry.height - geometry.top - geometry.contentHeight - geometry.margin, footerHeight ? footerHeight / PX + 8 : 0);
    geometry.top = geometry.margin + topBand;
    geometry.contentHeight = geometry.height - geometry.margin * 2 - topBand - bottomBand;
    if (geometry.contentHeight < 72) throw new Error("The header, footer and margins leave too little space for the report. Shorten the header or footer, or reduce the margins.");
    const options = presentation as ReportPresentation & { layout?: "flow" | "canvas"; canvasWidth?: number };
    const canvas = options.layout === "canvas";
    const sourceWidth = canvas ? Math.max(1, options.canvasWidth || parseFloat(element.style.width) || element.getBoundingClientRect().width) : geometry.contentWidth * PX;
    const scale = geometry.contentWidth * PX / sourceWidth;
    const clone = preparePdfClone(element, sourceWidth, geometry.contentHeight * PX / scale, presentation, fillable);
    if (canvas) {
      clone.dataset.reportLayout = "canvas";
      for (const node of Array.from(clone.children)) if (node instanceof HTMLElement && node.hasAttribute("data-report-x")) {
        Object.assign(node.style, { position: "absolute", left: `${Number(node.dataset.reportX) || 0}px`, top: `${Number(node.dataset.reportY) || 0}px`, width: `${Number(node.dataset.reportWidth) || sourceWidth}px`, zIndex: node.dataset.reportZ || "0", margin: "0", boxSizing: "border-box", maxWidth: "none" });
      }
    }
    host.replaceChildren(clone);
    for (const img of Array.from(clone.querySelectorAll<HTMLImageElement>("img"))) {
      try { await img.decode(); }
      catch {
        const label = document.createElement("span");
        label.textContent = img.alt || "Image unavailable";
        img.replaceWith(label);
        continue;
      }
      if (img.title === "report-chart" && !canvas) {
        const configured = img.dataset.width || img.getAttribute("width") || img.style.width;
        const width = configured && /^\d+(\.\d+)?(px)?$/.test(configured) ? parseFloat(configured) : sourceWidth;
        const imageScale = Math.min(1, width / img.naturalWidth, sourceWidth / img.naturalWidth, (geometry.contentHeight * PX - 100) / img.naturalHeight);
        img.style.width = `${img.naturalWidth * imageScale}px`; img.style.height = `${img.naturalHeight * imageScale}px`;
      }
    }
    if (fillable) for (const value of clone.querySelectorAll<HTMLElement>(".report-field .report-field-value")) {
      const block = value.closest(".report-field")!, label = block.querySelector(".report-field-label");
      value.style.width = `${Math.max(48, block.getBoundingClientRect().width - (label?.getBoundingClientRect().width || 0) - 4)}px`;
    }
    if (canvas) {
      const top = clone.getBoundingClientRect().top;
      const bottom = Math.max(1, ...Array.from(clone.children).map(node => node.getBoundingClientRect().bottom - top));
      clone.style.height = `${Math.max(bottom + 1, parseFloat(element.style.height) || 0)}px`;
    }
    const pages = paginatePdf(clone, geometry.contentHeight * PX / scale, fillable);
    return { host, clone, geometry, scale, pages, dispose: () => host.remove() };
  } catch (error) { host.remove(); throw error; }
}

export function paginatePdf(root: HTMLElement, pageHeight: number, fillable: boolean) {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) throw new Error("The printable page height must be a positive finite number.");
  const origin = root.getBoundingClientRect(), total = Math.max(1, origin.height);
  const protectedRanges: { top: number; bottom: number }[] = [];
  const candidates = new Set<number>([0, total]);
  const forced = new Set<number>();
  for (const run of measurePdfText(root)) {
    protectedRanges.push({ top: run.y, bottom: run.y + run.height }); candidates.add(run.y + run.height + 1);
  }
  root.querySelectorAll<HTMLElement>("*").forEach(node => {
    const rect = node.getBoundingClientRect(), top = rect.top - origin.top, bottom = rect.bottom - origin.top;
    const style = getComputedStyle(node);
    if (node.matches(PAGE_BREAK_SELECTOR) || node.dataset.pageBreakBefore === "true" || /^(page|always|left|right)$/.test(style.breakBefore)) forced.add(Math.max(0, top));
    if (/^(page|always|left|right)$/.test(style.breakAfter)) forced.add(bottom);
    if (node.matches("p,h1,h2,h3,table,tr,.report-field,.report-media,.report-symbol,.report-header,figure,blockquote,li")) { candidates.add(Math.max(0, top)); candidates.add(bottom); }
    const keep = node.matches("img,tr,.report-media,.report-symbol,.report-header,figure") || (fillable && node.matches(".report-field")) || style.breakInside === "avoid";
    if (fillable && node.matches(".report-field") && rect.height > pageHeight) throw new Error("A report field is taller than one page. Shorten that field or use the non-fillable PDF export.");
    if (keep && rect.height <= pageHeight) protectedRanges.push({ top, bottom });
    if (root.dataset.reportLayout !== "canvas" && /^H[123]$/.test(node.tagName) && node.nextElementSibling && !node.nextElementSibling.matches(PAGE_BREAK_SELECTOR)) {
      const next = node.nextElementSibling.getBoundingClientRect();
      protectedRanges.push({ top, bottom: Math.min(next.bottom - origin.top, next.top - origin.top + 32) });
    }
  });
  const safe = [...candidates].filter(y => !protectedRanges.some(r => y > r.top + .1 && y < r.bottom - .1)).sort((a, b) => a - b);
  const hard = [...forced].filter(y => y > .1 && y < total - .1).sort((a, b) => a - b);
  const pages: { start: number; end: number }[] = [];
  let start = 0;
  while (start < total - .1) {
    const stop = hard.find(y => y > start + .1) ?? total;
    const limit = Math.min(start + pageHeight, stop, total);
    let end = limit;
    const canvasGap = root.dataset.reportLayout === "canvas" && !protectedRanges.some(r => limit > r.top && limit < r.bottom);
    if (limit < stop && limit < total && !canvasGap) end = safe.filter(y => y > start + .1 && y <= limit).pop() ?? limit;
    pages.push({ start, end }); start = end;
  }
  return pages;
}

import { REPORT_THEMES, type ReportPresentation } from "./reportOptions";
import { localPdfImage, PAGE_BREAK_SELECTOR, reportPageGeometry } from "./reportPdfLayout";

export const rtfEscape = (text: string) => text.replace(/[\\{}\n\r]|[^\x20-\x7e]/g, c => c === "\n" ? "\\line " : c === "\r" ? "" : "\\{}".includes(c) ? `\\${c}` : `\\u${c.charCodeAt(0) > 32767 ? c.charCodeAt(0) - 65536 : c.charCodeAt(0)}?`);
const colorHex = (color: string) => {
  const rgb = color.match(/\d+/g);
  if (rgb && /^rgb/.test(color)) return `#${rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("")}`;
  if (/^#[a-f\d]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[a-f\d]{3}$/i.test(color)) return `#${color.slice(1).split("").map(c => c + c).join("")}`;
  return "";
};

function rtfImage(node: HTMLElement, maxWidth: number, maxHeight: number) {
  const src = node.getAttribute("src") || "";
  if (/^data:image\/png;base64,/i.test(src)) {
    try {
      const bytes = Uint8Array.from(atob(src.split(",")[1]), c => c.charCodeAt(0));
      if (bytes.length < 24 || new DataView(bytes.buffer).getUint32(0) !== 0x89504e47) throw new Error("Invalid PNG");
      const view = new DataView(bytes.buffer), w = view.getUint32(16), h = view.getUint32(20);
      if (!w || !h) throw new Error("Empty PNG");
      const explicit = parseFloat(node.dataset.width || node.getAttribute("width") || node.style.width);
      const desired = node.title === "report-glyph" ? 21 : node.title === "report-line" ? 48 : Number.isFinite(explicit) ? explicit * .75 : w * .75;
      const width = Math.min(maxWidth, desired, maxHeight * w / h), height = h * width / w;
      return `{\\pict\\pngblip\\picw${w}\\pich${h}\\picwgoal${Math.round(width * 20)}\\pichgoal${Math.round(height * 20)} ${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}}`;
    } catch { /* Preserve an image's caption when its data is damaged. */ }
  }
  return `{\\i ${rtfEscape(node.getAttribute("alt") || "Image unavailable")}}`;
}

export function formattedRtf(html: string, presentation: ReportPresentation = {}) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const theme = REPORT_THEMES[presentation.theme || "aqua"], geometry = reportPageGeometry("a4", presentation);
  const backgrounds = (presentation as ReportPresentation & { printBackground?: boolean }).printBackground !== false;
  const fonts = ["Arial", "Georgia", "Times New Roman", "Verdana"];
  const colors = [theme.ink, theme.band, theme.accent, "#d5d5d5"];
  for (const el of doc.querySelectorAll<HTMLElement>("[style]")) {
    const color = colorHex(el.style.color); if (color && !colors.includes(color)) colors.push(color);
    const background = colorHex(el.style.backgroundColor); if (background && !colors.includes(background)) colors.push(background);
    const family = el.style.fontFamily.split(",")[0].replace(/["']/g, "").trim(); if (family && !fonts.includes(family)) fonts.push(family);
  }
  const style = (node: HTMLElement) => {
    const font = fonts.indexOf(node.style.fontFamily.split(",")[0].replace(/["']/g, "").trim());
    const color = colors.indexOf(colorHex(node.style.color)) + 1;
    const size = parseFloat(node.style.fontSize), unit = node.style.fontSize.endsWith("px") ? 1.5 : 2;
    const bold = ["STRONG", "B"].includes(node.tagName) || node.classList.contains("report-field-label") || /^(bold|[6-9]00)$/.test(node.style.fontWeight);
    return `${bold ? "\\b " : ""}${["EM", "I"].includes(node.tagName) || node.style.fontStyle === "italic" ? "\\i " : ""}${node.tagName === "U" || node.style.textDecoration.includes("underline") ? "\\ul " : ""}${node.tagName === "S" ? "\\strike " : ""}${font >= 0 ? `\\f${font} ` : ""}${Number.isFinite(size) ? `\\fs${Math.round(size * unit)} ` : ""}${color ? `\\cf${color} ` : ""}`;
  };
  const align = (node: HTMLElement) => node.style.textAlign === "center" || node.dataset.alignment === "center" ? "\\qc" : node.style.textAlign === "right" || node.dataset.alignment === "right" ? "\\qr" : node.style.textAlign === "justify" ? "\\qj" : "\\ql";
  const render = (node: Node, inCell = false): string => {
    if (node.nodeType === Node.TEXT_NODE) return rtfEscape(node.textContent || "");
    if (!(node instanceof HTMLElement) || ["SCRIPT", "STYLE", "LINK", "IFRAME", "OBJECT", "EMBED"].includes(node.tagName) || node.hidden) return "";
    if (node.matches(PAGE_BREAK_SELECTOR)) return "\\page\n";
    const before = node.dataset.pageBreakBefore === "true" || /^(page|always)$/.test(node.style.breakBefore || node.style.pageBreakBefore) ? "\\page\n" : "";
    const after = /^(page|always)$/.test(node.style.breakAfter || node.style.pageBreakAfter) ? "\\page\n" : "";
    const tag = node.tagName;
    if (tag === "BR") return "\\line ";
    if (tag === "IMG") return `${before}{\\pard${inCell ? "\\intbl" : ""}${align(node)} ${rtfImage(node, inCell ? geometry.contentWidth / 3 : geometry.contentWidth, geometry.contentHeight - 36)}\\par}\n${after}`;
    if (tag === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr")).filter(row => row.closest("table") === node);
      return `${before}${rows.map(row => {
        const cells = Array.from(row.children).filter(c => /^(TD|TH)$/.test(c.tagName));
        const span = cells.reduce((sum, c) => sum + Number(c.getAttribute("colspan") || 1), 0);
        let right = 0;
        const definitions = cells.map(c => { right += Number(c.getAttribute("colspan") || 1) / span * geometry.contentWidth * 20; return `\\clbrdrt\\brdrs\\brdrw8\\clbrdrl\\brdrs\\brdrw8\\clbrdrb\\brdrs\\brdrw8\\clbrdrr\\brdrs\\brdrw8${c.tagName === "TH" && backgrounds ? "\\clcbpat2" : ""}\\cellx${Math.round(right)}`; }).join("");
        return `{\\trowd\\trgaph80${row.parentElement?.tagName === "THEAD" ? "\\trhdr" : ""}${definitions}\n${cells.map(c => `{\\pard\\intbl ${c.tagName === "TH" ? "\\b " : ""}${Array.from(c.childNodes).map(n => render(n, true)).join("")}\\cell}`).join("")}\\row}\n`;
      }).join("")}${after}`;
    }
    const child = Array.from(node.childNodes).map(n => render(n, inCell)).join("");
    const cell = inCell ? "\\intbl" : "";
    if (["P", "H1", "H2", "H3", "H4", "LI"].includes(tag) || node.classList.contains("report-field")) {
      const heading = /^H[1-4]$/.test(tag), band = tag === "H2" && backgrounds ? "\\cbpat2" : "";
      const indent = tag === "LI" ? `\\li300\\fi-200 ${node.parentElement?.tagName === "OL" ? `${Array.from(node.parentElement.children).indexOf(node) + 1}.` : "\\u8226?"}\\tab ` : "";
      return `${before}{\\pard${cell}${align(node)}\\sa100${heading ? "\\keepn\\b" : ""}${node.classList.contains("report-field") ? "\\keep" : ""}${tag === "H1" ? "\\fs32" : heading ? "\\fs30" : ""}${band} ${indent}${style(node)}${child}\\par}\n${after}`;
    }
    if (tag === "HR") return `${before}{\\pard\\brdrb\\brdrs\\brdrw10 \\par}${after}`;
    return `${before}{${style(node)}${child}}${after}`;
  };
  const title = presentation.header ? `{\\pard\\fs20 ${rtfEscape(presentation.header)}\\par}` : "";
  let crest = "";
  if (presentation.crest && localPdfImage(presentation.crest)) { const img = doc.createElement("img"); img.src = presentation.crest; crest = rtfImage(img, 27, 27); }
  const watermark = presentation.watermark && backgrounds ? `{\\shp{\\*\\shpinst\\shpleft1000\\shptop5000\\shpright14000\\shpbottom7500\\shpwr3\\shpfhdr1\\shpfblwtxt1{\\sp{\\sn shapeType}{\\sv 1}}{\\shptxt\\pard\\qc\\cf4\\fs64 ${rtfEscape(presentation.watermark)}\\par}}}` : "";
  const header = title || crest || watermark ? `{\\header ${crest}${title}${watermark}}` : "";
  const number = presentation.pageNumbers ? "\\tab {\\field{\\*\\fldinst PAGE}{\\fldrslt 1}} / {\\field{\\*\\fldinst NUMPAGES}{\\fldrslt 1}}" : "";
  const footer = presentation.footer || number ? `{\\footer\\pard\\fs20\\tqr\\tx${Math.round(geometry.contentWidth * 20)} ${rtfEscape(presentation.footer || "")}${number}\\par}` : "";
  return `{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0{\\fonttbl ${fonts.map((f, i) => `{\\f${i} ${rtfEscape(f)};}`).join("")}}{\\colortbl;${colors.map(c => `\\red${parseInt(c.slice(1, 3), 16)}\\green${parseInt(c.slice(3, 5), 16)}\\blue${parseInt(c.slice(5, 7), 16)};`).join("")}}\\paperw${Math.round(geometry.width * 20)}\\paperh${Math.round(geometry.height * 20)}${presentation.orientation === "landscape" ? "\\landscape" : ""}\\margl${Math.round(geometry.margin * 20)}\\margr${Math.round(geometry.margin * 20)}\\margt${Math.round(geometry.top * 20)}\\margb${Math.round((geometry.height - geometry.top - geometry.contentHeight) * 20)}\\headery${Math.round(geometry.margin * 20)}\\footery${Math.round(geometry.margin * 20)}${header}${footer}\\f0\\fs30\\cf1 ${Array.from(doc.body.childNodes).map(n => render(n)).join("")}}`;
}

export async function prepareRtfImages(html: string, crest?: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const convert = async (source: string) => {
    if (!localPdfImage(source)) return undefined;
    if (/^data:image\/png;base64,/i.test(source)) return source;
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image conversion is unavailable.");
    context.drawImage(image, 0, 0); return canvas.toDataURL("image/png");
  };
  for (const node of doc.querySelectorAll<HTMLImageElement>("img")) {
    const src = await convert(node.getAttribute("src") || "");
    node.removeAttribute("srcset");
    if (src) node.src = src;
    else { const caption = doc.createElement("em"); caption.textContent = node.alt || "Image unavailable"; node.replaceWith(caption); }
  }
  return { html: doc.body.innerHTML, crest: crest ? await convert(crest) : undefined };
}

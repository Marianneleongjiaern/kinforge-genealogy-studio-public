import { Extension, Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
import { localReportImage } from "./reportDocument";
import { REPORT_THEMES, type ReportPresentation } from "./reportOptions";
import { publicExportNoticeHtml } from "./exportAttribution";

const size = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(2400, Number(value)) : null;
const alignment = (value: unknown) => ["left", "center", "right"].includes(String(value)) ? String(value) : null;
const coordinate = (value: unknown) => value !== null && value !== "" && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100000, Number(value))) : null;
const CanvasAttributes = Extension.create({
  name: "reportCanvasAttributes",
  addGlobalAttributes: () => [{
    types: ["paragraph", "heading", "blockquote", "codeBlock", "bulletList", "orderedList", "horizontalRule", "image", "reportField", "reportPageBreak", "table", ...["Header", "Columns", "Gallery", "Media", "Symbols", "Symbol", "Section"].map(name => `report${name}`)],
    attributes: Object.fromEntries(([ ["layoutX", "x"], ["layoutY", "y"], ["layoutWidth", "width"], ["layoutZ", "z"] ] as const).map(([name, suffix]) => [name, {
      default: null,
      parseHTML: (el: HTMLElement) => coordinate(el.getAttribute(`data-report-${suffix}`)),
      renderHTML: (attrs: Record<string, unknown>) => coordinate(attrs[name]) !== null ? { [`data-report-${suffix}`]: coordinate(attrs[name]), style: `--report-object-${suffix}:${coordinate(attrs[name])}${suffix === "z" ? "" : "px"};` } : {}
    }]))
  }]
});
const layoutAttributes = () => ({
  width: { default: null, parseHTML: (el: HTMLElement) => size(el.getAttribute("data-width") || el.getAttribute("width")), renderHTML: (attrs: Record<string, unknown>) => attrs.width ? { "data-width": size(attrs.width), style: `width:${size(attrs.width)}px;max-width:100%;` } : {} },
  height: { default: null, parseHTML: (el: HTMLElement) => size(el.getAttribute("data-height") || el.getAttribute("height")), renderHTML: (attrs: Record<string, unknown>) => attrs.height ? { "data-height": size(attrs.height), style: `height:${size(attrs.height)}px;max-height:none;` } : {} },
  alignment: { default: null, parseHTML: (el: HTMLElement) => alignment(el.getAttribute("data-alignment")), renderHTML: (attrs: Record<string, unknown>) => alignment(attrs.alignment) ? { "data-alignment": attrs.alignment, style: `float:none;margin-left:${attrs.alignment === "left" ? "0" : "auto"};margin-right:${attrs.alignment === "right" ? "0" : "auto"};` } : {} },
  pageBreakBefore: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute("data-page-break-before") === "true", renderHTML: (attrs: Record<string, unknown>) => attrs.pageBreakBefore ? { "data-page-break-before": "true", style: "break-before:page;page-break-before:always;" } : {} }
});

const groupNode = (name: string, className: string) => Node.create({
  name, group: "block", content: "block+", defining: true,
  addAttributes: layoutAttributes,
  parseHTML: () => [{ tag: `div[data-report-block="${name}"]` }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-report-block": name, class: className }), 0]
});
const ReportImage = Image.extend({
  addAttributes() { return { ...this.parent?.(), ...layoutAttributes() }; },
  parseHTML: () => [{ tag: "img[src]", getAttrs: element => localReportImage(element.getAttribute("src") || "") ? {} : false }]
});
const ReportField = Node.create({
  name: "reportField", group: "block", content: "inline*", defining: true,
  addAttributes: () => ({ label: { default: "Field", parseHTML: element => element.getAttribute("data-label") } }),
  parseHTML: () => [{ tag: "div[data-report-field]", contentElement: ".report-field-value" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-report-field": "", "data-label": node.attrs.label, class: "report-field" }), ["span", { class: "report-field-label", contenteditable: "false" }, `${node.attrs.label}: `], ["span", { class: "report-field-value", tabindex: "0", role: "textbox", "aria-label": `${node.attrs.label} in report` }, 0]],
  renderText: ({ node }) => `${node.attrs.label}: ${node.textContent}`
});
const ReportPageBreak = Node.create({
  name: "reportPageBreak", group: "block", atom: true, selectable: true,
  parseHTML: () => [{ tag: "div[data-report-page-break]" }, { tag: 'div[data-report-block="reportPageBreak"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-report-page-break": "true", "data-report-block": "reportPageBreak", class: "report-page-break", style: "break-after:page;page-break-after:always;", "aria-label": "Page break" })],
  renderText: () => "\n\f\n"
});
const ReportTable = Node.create({ name: "table", group: "block", content: "tableRow+", isolating: true, parseHTML: () => [{ tag: "table" }], renderHTML: ({ HTMLAttributes }) => ["table", mergeAttributes(HTMLAttributes, { class: "report-table" }), ["tbody", 0]] });
const ReportRow = Node.create({ name: "tableRow", content: "(tableCell | tableHeader)+", parseHTML: () => [{ tag: "tr" }], renderHTML: () => ["tr", {}, 0] });
const cell = (name: string, tag: string) => Node.create({ name, content: "block+", isolating: true, parseHTML: () => [{ tag }], renderHTML: () => [tag, {}, 0] });

export const reportSelectionKey = new PluginKey<number[]>("reportObjectSelection");
const ObjectSelection = Extension.create({
  name: "reportObjectSelection",
  addProseMirrorPlugins: () => [new Plugin<number[]>({
    key: reportSelectionKey,
    state: {
      init: () => [],
      apply: (tr, current) => tr.getMeta(reportSelectionKey) ?? current.flatMap(pos => {
        const mapped = tr.mapping.mapResult(pos);
        return mapped.deleted ? [] : [mapped.pos];
      })
    },
    props: { decorations: state => DecorationSet.create(state.doc, (reportSelectionKey.getState(state) || []).flatMap(pos => {
      const node = state.doc.nodeAt(pos);
      return node ? [Decoration.node(pos, pos + node.nodeSize, { class: "report-object-selected" })] : [];
    })) }
  })]
});

export const reportExtensions = () => [
  StarterKit.configure({ link: false }), TextStyleKit, TextAlign.configure({ types: ["heading", "paragraph", "reportField"] }),
  ReportImage.configure({ allowBase64: true }), ReportField, ReportPageBreak, ReportTable, ReportRow, cell("tableCell", "td"), cell("tableHeader", "th"), ObjectSelection, CanvasAttributes,
  ...["Header", "Columns", "Gallery", "Media", "Symbols", "Symbol", "Section"].map(name => groupNode(`report${name}`, `report-${name.toLowerCase()}`))
];

export function selectReportObject(editor: Editor, position: number, additive = false) {
  const current = reportSelectionKey.getState(editor.state) || [];
  const next = additive ? current.includes(position) ? current.filter(p => p !== position) : [...current, position] : [position];
  editor.view.dispatch(editor.state.tr.setMeta(reportSelectionKey, next.sort((a, b) => a - b)));
}

export function reportBlocks(editor: Editor) {
  const blocks: { position: number; size: number; label: string }[] = [];
  editor.state.doc.forEach((node, position) => blocks.push({ position, size: node.nodeSize, label: node.type.name === "reportPageBreak" ? "Page break" : node.textContent.slice(0, 80) || node.attrs.alt || node.type.name }));
  return blocks;
}

export function changeReportObjects(editor: Editor, action: "up" | "down" | "delete") {
  const selected = new Set(reportSelectionKey.getState(editor.state) || []);
  if (!selected.size) return;
  const blocks: { node: import("@tiptap/pm/model").Node; selected: boolean }[] = [];
  editor.state.doc.forEach((node, pos) => blocks.push({ node, selected: selected.has(pos) }));
  if (action === "up") for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].selected && !blocks[i - 1].selected) [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
  }
  if (action === "down") for (let i = blocks.length - 2; i >= 0; i--) {
    if (blocks[i].selected && !blocks[i + 1].selected) [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]];
  }
  const kept = action === "delete" ? blocks.filter(block => !block.selected) : blocks;
  if (!kept.length) kept.push({ node: editor.schema.nodes.paragraph.create(), selected: false });
  let position = 0;
  const next: number[] = [];
  kept.forEach(block => { if (block.selected) next.push(position); position += block.node.nodeSize; });
  const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, Fragment.fromArray(kept.map(block => block.node)));
  editor.view.dispatch(closeHistory(tr).setMeta(reportSelectionKey, next));
}

export function insertReportBlock(editor: Editor, node: JSONContent | JSONContent[]) {
  const { $from } = editor.state.selection;
  const selected = reportSelectionKey.getState(editor.state) || [];
  const last = selected.length ? Math.max(...selected) : null;
  const position = last !== null ? last + (editor.state.doc.nodeAt(last)?.nodeSize || 0) : $from.depth ? $from.after(1) : editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(position, node).run();
  editor.view.dispatch(editor.state.tr.setMeta(reportSelectionKey, []));
}

export function formatReportObjects(editor: Editor, value: "left" | "center" | "right") {
  const selected = new Set(reportSelectionKey.getState(editor.state) || []);
  const tr = editor.state.tr;
  editor.state.doc.descendants((node, pos) => {
    const top = editor.state.doc.resolve(pos).depth ? editor.state.doc.resolve(pos).before(1) : pos;
    if (!selected.has(top)) return;
    if ("alignment" in node.attrs || "textAlign" in node.attrs) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...("alignment" in node.attrs ? { alignment: value } : {}), ...("textAlign" in node.attrs ? { textAlign: value } : {}) });
  });
  editor.view.dispatch(closeHistory(tr).setMeta(reportSelectionKey, [...selected]));
}

export function clearReportObjectSelection(editor: Editor) {
  const tr = editor.state.tr.setMeta(reportSelectionKey, []);
  editor.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(editor.state.selection.from, tr.doc.content.size)))));
}

export type CanvasObject = { position: number; index: number; x: number; y: number; width: number; height: number; z: number };
export function reportCanvasObjects(editor: Editor): CanvasObject[] {
  const root = editor.view.dom, origin = root.getBoundingClientRect();
  return reportBlocks(editor).map((block, index) => {
    const node = editor.state.doc.nodeAt(block.position)!;
    const element = root.children[index] as HTMLElement;
    const rect = element.getBoundingClientRect();
    return { position: block.position, index, x: node.attrs.layoutX ?? rect.left - origin.left, y: node.attrs.layoutY ?? rect.top - origin.top, width: node.attrs.layoutWidth ?? rect.width, height: rect.height, z: node.attrs.layoutZ ?? index };
  });
}

export function setCanvasObjects(editor: Editor, patches: { position: number; x?: number; y?: number; width?: number; z?: number }[], history = true) {
  const tr = editor.state.tr;
  const canvasWidth = editor.view.dom.getBoundingClientRect().width;
  for (const patch of patches) {
    const node = tr.doc.nodeAt(patch.position); if (!node) continue;
    const width = Math.min(canvasWidth, Math.max(24, patch.width ?? node.attrs.layoutWidth ?? canvasWidth));
    const x = Math.min(Math.max(0, patch.x ?? node.attrs.layoutX ?? 0), Math.max(0, canvasWidth - width));
    tr.setNodeMarkup(patch.position, undefined, { ...node.attrs, layoutX: x, layoutY: Math.max(0, Math.min(100000, patch.y ?? node.attrs.layoutY ?? 0)), layoutWidth: width, layoutZ: Math.max(0, Math.min(10000, patch.z ?? node.attrs.layoutZ ?? 0)) });
  }
  if (tr.docChanged) editor.view.dispatch((history ? closeHistory(tr) : tr.setMeta("addToHistory", false)).setMeta(reportSelectionKey, reportSelectionKey.getState(editor.state) || []));
}

export function captureReportCanvas(editor: Editor) {
  const root = editor.view.dom, origin = root.getBoundingClientRect();
  const patches = reportBlocks(editor).map((block, index) => {
    const rect = root.children[index].getBoundingClientRect();
    return { position: block.position, x: Math.max(0, rect.left - origin.left), y: Math.max(0, rect.top - origin.top), width: rect.width, z: index };
  });
  setCanvasObjects(editor, patches);
  return origin.width;
}

export function syncReportCanvas(editor: Editor, canvas: boolean, width?: number) {
  const root = editor.view.dom;
  root.dataset.reportLayout = canvas ? "canvas" : "flow";
  if (!canvas) { root.style.removeProperty("width"); root.style.removeProperty("height"); return; }
  if (width) root.style.width = `${width}px`;
  let bottom = 0;
  const missing: { position: number; x: number; y: number; width: number; z: number }[] = [];
  editor.state.doc.forEach((node, pos, index) => {
    const el = root.children[index] as HTMLElement;
    if (node.attrs.layoutX !== null && node.attrs.layoutY !== null) bottom = Math.max(bottom, Number(node.attrs.layoutY) + el.getBoundingClientRect().height);
    else missing.push({ position: pos, x: 0, y: 0, width: root.getBoundingClientRect().width, z: index });
  });
  for (const item of missing) {
    item.y = bottom + 16;
    const index = reportBlocks(editor).findIndex(block => block.position === item.position);
    bottom = item.y + Math.max(24, root.children[index].getBoundingClientRect().height);
  }
  if (missing.length) setCanvasObjects(editor, missing, false);
  const height = `${Math.ceil(Math.max(32, bottom))}px`;
  if (root.style.height !== height) root.style.height = height;
}

export function stackReportCanvas(editor: Editor, front: boolean) {
  const selected = new Set(reportSelectionKey.getState(editor.state) || []);
  const items = reportCanvasObjects(editor).sort((a, b) => a.z - b.z || a.index - b.index);
  const chosen = items.filter(item => selected.has(item.position)), rest = items.filter(item => !selected.has(item.position));
  setCanvasObjects(editor, (front ? [...rest, ...chosen] : [...chosen, ...rest]).map((item, z) => ({ position: item.position, z })));
}

export function reportPresentation(presentation: ReportPresentation = {}) {
  return { theme: "aqua", orientation: "portrait", margin: 21, layout: "flow", canvasWidth: 0, pageNumbers: false, printBackground: true, header: "", footer: "", watermark: "", crest: "", ...presentation } as Required<ReportPresentation>;
}

export function reportHtmlDocument(html: string, title: string, paper: "a4" | "letter", presentation: ReportPresentation, canvasHeight = 0) {
  const p = reportPresentation(presentation), colors = REPORT_THEMES[p.theme];
  const doc = new DOMParser().parseFromString("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>", "text/html");
  doc.title = title;
  const style = doc.createElement("style");
  // Copy report-specific styles so offline HTML keeps figures, captions, and editable field labels.
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const reportRules = Array.from(sheet.cssRules).filter(rule => rule.cssText.includes("report-")).map(rule => rule.cssText).join("\n");
      if (reportRules) rules.push(sheet.media.mediaText ? `@media ${sheet.media.mediaText}{${reportRules}}` : reportRules);
    } catch { /* External fonts are optional in the standalone file. */ }
  }
  style.textContent = `${rules.join("\n")}\nbody{margin:0;background:#eee;color:${colors.ink}}.report-html-paper{--report-ink:${colors.ink};--report-accent:${colors.accent};--report-band:${colors.band};position:relative;box-sizing:border-box;background:white;margin:20px auto;padding:${p.margin}pt;max-width:${p.orientation === "landscape" ? 1123 : 816}px}.report-page-header,.report-page-footer{white-space:pre-wrap}.report-page-watermark{pointer-events:none}.report-page-break{break-after:page;page-break-after:always}.kinforge-public-export-credit{margin:32px 0 0;padding-top:14px;border-top:1px solid #d7e0e3;color:#526369;font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}@page{size:${paper === "a4" ? "A4" : "letter"} ${p.orientation};margin:${p.margin}pt}@media print{body{background:white}.report-html-paper{margin:0;padding:0;max-width:none}.report-page-footer{position:fixed;bottom:0}.report-page-number{display:none}}`;
  doc.head.append(style);
  const page = doc.createElement("article"); page.className = "report-html-paper";
  const addText = (className: string, text: string) => { if (!text) return; const el = doc.createElement("div"); el.className = className; el.textContent = text; page.append(el); };
  addText("report-page-header", p.header);
  if (p.crest && localReportImage(p.crest)) { const img = doc.createElement("img"); img.className = "report-crest"; img.src = p.crest; img.alt = "Family crest"; page.append(img); }
  addText("report-page-watermark", p.watermark);
  const body = doc.createElement("div"); body.className = "report-document report-export"; body.innerHTML = html; page.append(body);
  body.dataset.reportLayout = p.layout;
  if (p.layout === "canvas") {
    body.style.width = `${p.canvasWidth}px`; body.style.height = `${canvasHeight}px`;
    page.style.width = `${p.canvasWidth + p.margin * 8 / 3}px`; page.style.maxWidth = "none";
  }
  addText("report-page-footer", p.footer);
  page.insertAdjacentHTML("beforeend", publicExportNoticeHtml());
  doc.body.append(page);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

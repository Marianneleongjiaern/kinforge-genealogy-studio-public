import type { JSONContent } from "@tiptap/core";
import type { Diagram } from "./reportCatalog";
import { NODE_HEIGHT, NODE_WIDTH } from "./treeGraph";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlyphArtwork } from "./GlyphArtwork";
import { glyphById } from "./glyphs";
import { LINE_STYLES, LineKind, statusMark, UnionStatus } from "./familyLines";
import { drawReportMap, ReportMapModel } from "./reportMap";

export function drawReportChart(model: Diagram, glyphs = new Map<string, HTMLImageElement>()): string {
  const canvas = document.createElement("canvas");
  const scale = Math.min(2, 4096 / Math.max(model.width + 80, model.height + 100));
  canvas.width = Math.ceil((model.width + 80) * scale); canvas.height = Math.ceil((model.height + 100) * scale);
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Chart drawing is not available in this browser.");
  c.scale(scale, scale); c.fillStyle = "#ffffff"; c.fillRect(0, 0, model.width + 80, model.height + 100);
  c.fillStyle = "#24383b"; c.font = "bold 22px Arial"; c.fillText(model.title, 25, 32); c.translate(40, 65);
  const wrap = (value: string, x: number, y: number, width: number, lineHeight = 18, maxLines = 3) => {
    let line = ""; const lines = [];
    for (const word of value.split(/\s+/)) { if (line && c.measureText(`${line} ${word}`).width > width) { lines.push(line); line = word; } else line += `${line ? " " : ""}${word}`; }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((line, row) => c.fillText(row === maxLines - 1 && lines.length > maxLines ? `${line}...` : line, x, y + row * lineHeight, width));
  };
  if (model.kind === "network") {
    const minX = Math.min(0, ...model.nodes.map(n => n.x)), minY = Math.min(0, ...model.nodes.map(n => n.y)) - 50;
    c.translate(-minX, -minY);
    for (const path of model.paths) { c.strokeStyle = path.color; c.lineWidth = 2; c.setLineDash(path.dash?.split(" ").map(Number) || []); c.stroke(new Path2D(path.d)); }
    c.setLineDash([]);
    for (const n of model.nodes) {
      c.fillStyle = "#f6fbfb"; c.strokeStyle = "#6e989c"; c.lineWidth = 1.5;
      c.fillRect(n.x, n.y, NODE_WIDTH, NODE_HEIGHT); c.strokeRect(n.x, n.y, NODE_WIDTH, NODE_HEIGHT);
      c.fillStyle = "#24383b"; c.font = "bold 16px Arial"; wrap(n.label, n.x + 12, n.y + 30, NODE_WIDTH - 24);
      if (n.detail) { c.font = "12px Arial"; wrap(n.detail, n.x + 12, n.y + 88, NODE_WIDTH - 24); }
      if (n.shape) { const x = n.x + NODE_WIDTH - 25, y = n.y + 58; c.beginPath(); if (n.shape === "female") c.arc(x, y, 8, 0, Math.PI * 2); else if (n.shape === "male") c.rect(x - 8, y - 8, 16, 16); else if (n.shape === "nonbinary") { c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.closePath(); } else c.fillText("?", x - 4, y + 5); c.stroke(); c.font = "10px Arial"; c.textAlign = "center"; c.fillText(n.shape === "unknown" ? "Unknown" : n.shape, x, y + 22, 48); c.textAlign = "left"; }
      (n.symbols || []).slice(0, 3).forEach((symbol, i) => {
        const x = n.x + 9 + i * 70, y = n.y + 108;
        const glyph = glyphs.get(symbol.glyphId);
        if (glyph) c.drawImage(glyph, x + 20, y, 24, 24);
        c.font = "11px Arial"; wrap(symbol.label, x, y + 36, 64, 12, 4);
      });
      if ((n.symbols?.length || 0) > 3) { c.font = "10px Arial"; c.fillText("More symbols in person's key below", n.x + 9, n.y + NODE_HEIGHT - 9, NODE_WIDTH - 18); }
    }
  } else if (model.kind === "bars") {
    const max = Math.max(1, ...(model.bars || []).map(b => b.value));
    (model.bars || []).forEach((b, i) => { const y = i * 35; c.fillStyle = "#24383b"; c.font = "15px Arial"; c.fillText(b.label, 0, y + 19, 230); c.fillStyle = i % 2 ? "#8b6c8e" : "#3a8790"; c.fillRect(250, y, b.value / max * 550, 25); c.fillStyle = "#24383b"; c.fillText(String(b.value), 810, y + 19); });
  } else if (model.kind === "timeline") {
    const rows = model.entries || [], min = Math.min(...rows.map(r => r.year)), max = Math.max(...rows.map(r => r.year));
    c.strokeStyle = "#86b5bb"; c.beginPath(); c.moveTo(30, 12); c.lineTo(980, 12); c.stroke();
    rows.forEach((row, i) => { const x = 30 + (max === min ? .5 : (row.year - min) / (max - min)) * 950, y = i * 55 + 40; c.strokeStyle = "#c7dbdd"; c.beginPath(); c.moveTo(x, 12); c.lineTo(x, y); c.stroke(); c.fillStyle = "#327a83"; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = "#24383b"; c.font = "13px Arial"; c.fillText(row.label, 10, y + 19, 1030); });
  } else {
    const slots = model.slots || [], levels = Math.max(0, ...slots.map(s => Math.floor(Math.log2(s.number))));
    const cx = 500, cy = 515, ring = 460 / (levels + 1);
    for (let level = levels; level >= 0; level--) {
      const count = 2 ** level;
      for (let index = 0; index < count; index++) {
        const number = count + index, start = Math.PI + index / count * Math.PI, end = Math.PI + (index + 1) / count * Math.PI;
        const outer = (level + 1) * ring, inner = level * ring;
        c.beginPath(); c.arc(cx, cy, outer, start, end); c.arc(cx, cy, inner, end, start, true); c.closePath(); c.fillStyle = level % 2 ? "#e1eff0" : "#eee5ef"; c.fill(); c.strokeStyle = "white"; c.lineWidth = 2; c.stroke();
        const mid = (start + end) / 2, radius = (outer + inner) / 2, label = slots.find(s => s.number === number)?.label || "Not recorded";
        c.save(); c.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius); c.rotate(mid + Math.PI / 2); c.fillStyle = "#24383b"; c.font = `${level > 3 ? 9 : 13}px Arial`; c.textAlign = "center"; c.fillText(`${number}. ${label}`, 0, 0, Math.max(22, radius * Math.PI / count - 6)); c.restore();
      }
    }
  }
  return canvas.toDataURL("image/png");
}

const glyphImages = new Map<string, HTMLImageElement>();
async function bitmapGlyph(id: string) {
  const cached = glyphImages.get(id);
  if (cached) return cached;
  const svg = renderToStaticMarkup(createElement(GlyphArtwork, { glyph: glyphById(id) || glyphById("other-support")!, size: 96, color: "#436f76" }));
  const source = new window.Image();
  source.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await source.decode();
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Symbol drawing is unavailable.");
  c.drawImage(source, 0, 0, 96, 96);
  const bitmap = new window.Image(); bitmap.src = canvas.toDataURL("image/png"); await bitmap.decode();
  glyphImages.set(id, bitmap); return bitmap;
}

export async function materializeReportCharts(doc: JSONContent): Promise<JSONContent> {
  if (doc.type === "reportMap") {
    const model = doc.attrs?.map as ReportMapModel;
    return { type: "image", attrs: { src: drawReportMap(model), alt: model.title, title: "report-map" } };
  }
  if (doc.type === "reportLine") {
    const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 84;
    const c = canvas.getContext("2d")!; c.scale(3, 3); c.lineWidth = 2;
    const style = LINE_STYLES[(doc.attrs?.kind || "married") as LineKind];
    c.strokeStyle = style.color; c.setLineDash(style.dash?.split(" ").map(Number) || []);
    c.stroke(new Path2D(doc.attrs?.status ? `M4 14H60 ${statusMark(doc.attrs.status as UnionStatus, { x: 32, y: 14 })}` : style.sample));
    return { type: "image", attrs: { src: canvas.toDataURL("image/png"), alt: doc.attrs?.label, title: "report-line" } };
  }
  if (doc.type === "reportGlyph") { const image = await bitmapGlyph(doc.attrs!.glyphId); return { type: "image", attrs: { src: image.src, alt: doc.attrs!.label, title: "report-glyph" } }; }
  if (doc.type === "reportChart") {
    const model = doc.attrs?.diagram as Diagram;
    for (const id of new Set(model.nodes.flatMap(n => (n.symbols || []).map(s => s.glyphId)))) await bitmapGlyph(id);
    return { type: "image", attrs: { src: drawReportChart(model, glyphImages), alt: model.title, title: "report-chart" } };
  }
  if (!doc.content) return doc;
  const content = []; for (const node of doc.content) content.push(await materializeReportCharts(node));
  return { ...doc, content };
}

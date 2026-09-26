import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public/glyphs");
const temporary = await mkdtemp(path.join(tmpdir(), "kinforge-glyphs-"));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

try {
  await build({ stdin: { contents: 'export { GLYPHS } from "./src/glyphs"; export { GlyphArtwork } from "./src/GlyphArtwork";', resolveDir: root, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: path.join(temporary, "glyphs.cjs"), logLevel: "silent" });
  const { GLYPHS, GlyphArtwork } = createRequire(import.meta.url)(path.join(temporary, "glyphs.cjs"));
  await mkdir(target, { recursive: true });
  const assets = GLYPHS.map(glyph => {
    const { icon, modifier, ...definition } = glyph;
    return { ...definition, svg: renderToStaticMarkup(createElement(GlyphArtwork, { glyph, size: 24, role: "img", "aria-label": definition.label }, createElement("title", null, definition.label))) };
  });
  for (const asset of assets) await writeFile(path.join(target, `${asset.id}.svg`), asset.svg);
  await writeFile(path.join(target, "manifest.json"), JSON.stringify(assets.map(({ svg, ...asset }) => ({ ...asset, file: `${asset.id}.svg` })), null, 2));
  await copyFile(path.join(root, "node_modules/lucide-react/LICENSE"), path.join(target, "LUCIDE-LICENSE.txt"));
  const groups = [...new Set(assets.map(asset => asset.group))];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KinForge glyph library</title><style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#263336;background:#f5f7f8;font-size:14px;letter-spacing:0;--line:#dce3e6;--surface:#fff;--muted:#596b73}*{box-sizing:border-box}body{margin:0}body[data-theme=dark]{color:#edf1f3;background:#202426;--surface:#2b3033;--line:#495359;--muted:#bfccd0}header,main,footer{max-width:1152px;margin:auto;padding:28px}header{border-bottom:1px solid var(--line)}h1{font-size:28px;margin:0 0 8px;font-weight:650}header p{color:var(--muted);margin:0}nav{display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin-top:24px}label{display:flex;align-items:center;gap:8px;font-size:12px}input,select{font:inherit;color:inherit;background:var(--surface);border:1px solid var(--line);padding:9px;border-radius:4px;max-width:100%}input[type=search]{width:250px}input[type=range]{padding:0;width:100px}h2{font-size:16px;font-weight:650;margin:10px 0 18px}.group{padding:20px 0;border-bottom:1px solid var(--line)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}.glyph{min-height:138px;background:var(--surface);padding:18px;display:flex;flex-direction:column;gap:12px;min-width:0}.frame>svg{width:var(--size,28px);height:var(--size,28px);flex:none}.glyph a{color:inherit;font-size:13px;font-weight:550;text-decoration:none;overflow-wrap:anywhere}.glyph a:hover{text-decoration:underline}.glyph small{font-size:11px;color:var(--muted);line-height:1.5;overflow-wrap:anywhere}.frame{height:40px;display:flex;align-items:center}.glyph[hidden],section[hidden]{display:none}footer{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;color:var(--muted);font-size:11px}footer a{color:inherit}a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #459eaa;outline-offset:3px}#empty{padding:24px 0;color:var(--muted)}@media(max-width:800px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){header,main,footer{padding:20px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.glyph{padding:15px}nav{align-items:stretch}nav>label:first-child{flex-basis:100%}input[type=search]{flex:1;min-width:0;width:auto}h1{font-size:25px}}@media print{nav{display:none}.grid{grid-template-columns:repeat(4,minmax(0,1fr))}.glyph{break-inside:avoid}}
</style></head><body><header><h1>KinForge glyph library</h1><p>${assets.length} glyphs · Relationships, life events, disabilities and access needs</p><nav><label>Search<input id="search" type="search" placeholder="Find a symbol"></label><label>Category<select id="group"><option value="">All categories</option>${groups.map(group => `<option>${escape(group)}</option>`).join("")}</select></label><label>Appearance<select id="theme"><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Size<input id="size" type="range" min="16" max="40" value="28" step="4"><output id="size-value">28 px</output></label></nav></header><main>
${groups.map(group => `<section class="group" data-group="${escape(group)}"><h2>${escape(group)}</h2><div class="grid">${assets.filter(asset => asset.group === group).map(asset => `<article class="glyph" data-search="${escape([asset.label, asset.group, asset.meaning, ...(asset.aliases ?? [])].join(" ").toLowerCase())}"><div class="frame">${asset.svg}</div><a href="./${asset.id}.svg" download>${escape(asset.label)}</a><small>${escape(asset.meaning)}</small></article>`).join("")}</div></section>`).join("")}
<p id="empty" hidden>No matching symbols.</p></main><footer><span>Product of Dreams of Serene Landscapes</span><span>Lucide-based glyphs · <a href="./LUCIDE-LICENSE.txt">Icon licence</a> · <a href="./manifest.json" download>Manifest</a></span></footer><script>
const search=document.querySelector('#search'),category=document.querySelector('#group');function filter(){const query=search.value.trim().toLowerCase();document.querySelectorAll('.glyph').forEach(item=>item.hidden=!item.dataset.search.includes(query));document.querySelectorAll('.group').forEach(group=>group.hidden=(category.value&&group.dataset.group!==category.value)||!group.querySelector('.glyph:not([hidden])'));document.querySelector('#empty').hidden=!!document.querySelector('.group:not([hidden])')};const initialGroup=new URL(location.href).searchParams.get('group');if([...category.options].some(option=>option.value===initialGroup))category.value=initialGroup;filter();search.addEventListener('input',filter);category.addEventListener('change',filter);document.querySelector('#theme').addEventListener('change',event=>document.body.dataset.theme=event.target.value);document.querySelector('#size').addEventListener('input',event=>{document.body.style.setProperty('--size',event.target.value+'px');document.querySelector('#size-value').value=event.target.value+' px'});
</script></body></html>`;
  await writeFile(path.join(target, "index.html"), html);
  console.log(`Exported ${assets.length} labelled SVG glyphs and preview to public/glyphs.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

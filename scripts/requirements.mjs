import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';

const project = fileURLToPath(new URL('../', import.meta.url));
const outputs = path.dirname(project);
const generated = path.join(project, 'src/requirements.generated.json');
const snapshots = path.join(project, 'public/requirements/sources');
const originalIdeas = process.env.KINFORGE_IDEAS_FILE || '/Users/marianneleonghost/Downloads/Coding Ideas/Family Tree, Heritage, and Geneology App for Macbook/Ideas.md';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const text = node => node.value ?? node.alt ?? (node.children || []).map(text).join('');

function fragments(raw, sourceId, baseline) {
  const result = [], headings = [], occurrences = new Map();
  function visit(node) {
    if (node.type === 'heading') { headings.length = node.depth - 1; headings[node.depth - 1] = text(node); return; }
    if (['paragraph', 'code', 'html'].includes(node.type)) {
      const content = raw.slice(node.position.start.offset, node.position.end.offset);
      const fingerprint = hash(content).slice(0, 12);
      const occurrence = (occurrences.get(fingerprint) || 0) + 1; occurrences.set(fingerprint, occurrence);
      result.push({ id: `${sourceId}-${fingerprint}-${occurrence}`, sourceId, section: headings.filter(Boolean).join(' / '), line: node.position.start.line, endLine: node.position.end.line, text: content, kind: baseline ? 'original-scope' : 'supplemental-reference', status: 'unverified', delivery: 'built-in' });
      return;
    }
    for (const child of node.children || []) visit(child);
  }
  visit(fromMarkdown(raw));
  return result;
}

const excluded = new Set(['node_modules', 'dist', 'dist-website', 'release', '.git', 'verification', 'test-results', 'playwright-report', 'public']);
function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (excluded.has(entry.name) || entry.name === 'KinForge-Requirements-Register.md') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(full) : entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

if (process.argv.includes('--check')) {
  const catalog = JSON.parse(fs.readFileSync(generated, 'utf8'));
  const ids = new Set();
  if (process.argv.includes('--originals')) {
    const current = ['Ideas.md (original attachment)', ...markdownFiles(outputs).map(file => path.relative(outputs, file))].sort();
    assert.deepEqual(catalog.sources.map(source => source.path).sort(), current, 'Markdown source inventory changed; refresh the register.');
  }
  for (const source of catalog.sources) {
    const bytes = fs.readFileSync(path.join(snapshots, `${source.id}.md`));
    assert.equal(hash(bytes), source.sha256, `Snapshot changed: ${source.path}`);
    const expected = fragments(bytes.toString('utf8'), source.id, source.path === 'Ideas.md (original attachment)');
    assert.deepEqual(catalog.entries.filter(e => e.sourceId === source.id), expected, `Index incomplete: ${source.path}`);
    if (process.argv.includes('--originals')) {
      const original = source.path === 'Ideas.md (original attachment)' ? originalIdeas : path.join(outputs, source.path);
      assert.equal(hash(fs.readFileSync(original)), source.sha256, `Source changed: ${source.path}`);
    }
  }
  for (const e of catalog.entries) { assert(!ids.has(e.id)); ids.add(e.id); assert.equal(e.status, 'unverified'); assert.equal(e.delivery, 'built-in'); }
  console.log(`Requirements preservation PASS: ${catalog.sources.length} documents, ${catalog.entries.length} indexed blocks. This is not feature-completion testing.`);
} else {
  fs.mkdirSync(snapshots, { recursive: true });
  const files = [originalIdeas, ...markdownFiles(outputs).sort()];
  const sources = [], entries = [];
  for (const file of files) {
    const relative = file === originalIdeas ? 'Ideas.md (original attachment)' : path.relative(outputs, file);
    const id = `doc-${hash(relative).slice(0, 12)}`;
    const bytes = fs.readFileSync(file);
    const blocks = fragments(bytes.toString('utf8'), id, file === originalIdeas);
    fs.writeFileSync(path.join(snapshots, `${id}.md`), bytes);
    sources.push({ id, path: relative, sha256: hash(bytes), bytes: bytes.length, blocks: blocks.length });
    entries.push(...blocks);
  }
  const catalog = { schemaVersion: 1, policy: 'Built-in implementations required. Source preservation is not implementation or verification.', sources, entries };
  fs.writeFileSync(generated, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(outputs, 'KinForge-Requirements-Register.md'), [
    '# KinForge Requirements Source Register', '',
    `Preserved ${sources.length} Markdown documents and ${entries.length} content blocks. Every block is unverified; these are not completed-feature counts.`, '',
    'Original wording is retained, including duplicated requirements and older evidence/limitations. Supplemental tables remain complete Markdown blocks and still need atomic requirement review. Old implementation declarations are not promoted to passed tests.', '',
    'The user\'s newest no-connector/no-external-service instruction governs delivery. See [the independent feature contract](KinForge-Independent-Feature-Contract.md).', '',
    '| Source | Indexed blocks | SHA-256 |', '| --- | --- | --- |',
    ...sources.map(s => `| ${s.path} | ${s.blocks} | ${s.sha256} |`), '',
    'Sources are searchable in the local app under Feature Coverage. The complete machine-readable register is [requirements.generated.json](kinforge-genealogy-studio/src/requirements.generated.json). Snapshots are in the app\'s public/requirements/sources directory.', '',
    'The register is not a completion certificate. Real features, models, datasets, privacy, persistence and platform validation remain separate acceptance gates.', '',
  ].join('\n'));
  console.log(`Preserved ${sources.length} documents and ${entries.length} blocks.`);
}

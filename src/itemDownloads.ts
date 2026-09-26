import { AppState } from "./domain";
import { DeleteTarget, deletionSnapshot, planDeletion } from "./deletion";
import { buildBackup } from "./exporters";
import { PUBLIC_EXPORT_NOTICE } from "./exportAttribution";

export type ItemDownload = { name: string; content: string | Uint8Array; type: string };
const safeName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 120).trim() || "KinForge-item";

export function buildItemDownload(state: AppState, target: DeleteTarget): ItemDownload {
  const plan = planDeletion(state, target);
  if (!plan.exists) throw new Error("This item was removed on another device. Refresh the list and try again.");
  const name = safeName(plan.title);
  if (target.kind === "media") {
    const item = state.media.find(m => m.id === target.id)!;
    if (item.dataUrl) {
      const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(item.dataUrl);
      if (!match) throw new Error("The attached file is not available on this device yet. Wait for sync and try again.");
      const type = match[1] || "application/octet-stream";
      let content: Uint8Array;
      try { content = match[2] ? Uint8Array.from(atob(match[3]), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(match[3])); }
      catch { throw new Error("This stored file is damaged. Reattach the original file before downloading it."); }
      const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf", "text/plain": "txt", "video/mp4": "mp4", "audio/mpeg": "mp3" } as Record<string, string>)[type] || "bin";
      return { name: /\.[a-z0-9]{1,8}$/i.test(name) ? name : `${name}.${extension}`, content, type };
    }
  }
  if (plan.container) {
    const subset = structuredClone(state);
    for (const key of ["books", "collections", "trees", "people", "families", "relationships", "events", "places", "sources", "media", "todos", "dnaMatches", "records", "ideasJournal", "userFeedback", "protectionRecords", "medicalRecords", "reportDrafts", "changes"] as const) subset[key] = [];
    Object.assign(subset, deletionSnapshot(state, target));
    const collections = new Set(subset.collections.map(c => c.id));
    for (const tree of subset.trees) if (tree.collectionId) collections.add(tree.collectionId);
    let changed = true;
    while (changed) { changed = false; for (const c of state.collections) if (collections.has(c.id) && c.parentId && !collections.has(c.parentId)) { collections.add(c.parentId); changed = true; } }
    subset.collections = state.collections.filter(c => collections.has(c.id));
    const books = new Set([...subset.books.map(b => b.id), ...subset.trees.map(t => t.bookId), ...subset.collections.map(c => c.bookId)]);
    subset.books = state.books.filter(b => books.has(b.id));
    const events = new Set([...subset.people, ...subset.families].flatMap(p => p.eventIds));
    subset.events = state.events.filter(e => events.has(e.id));
    return { name: `${name}.kinforge.json`, content: buildBackup(subset), type: "application/json" };
  }
  const owner = target.ownerId ? state.people.find(p => p.id === target.ownerId) : undefined;
  const data = target.kind === "facts" || target.kind === "accessNeeds" ? owner?.[target.kind]?.find(f => f.id === target.id)
    : ((state[target.kind] ?? []) as unknown[]).find(item => typeof item === "string" ? item === target.id : (item as { id: string }).id === target.id);
  const related = deletionSnapshot(state, target);
  // Include cited records and attached files, without exporting unrelated people.
  const eventIds = new Set<string>(), sourceIds = new Set<string>(), mediaIds = new Set<string>(), placeIds = new Set<string>();
  function refs(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const set = key === "eventIds" ? eventIds : key === "sourceIds" || key === "sourceId" ? sourceIds : key === "mediaIds" || key === "profileMediaId" ? mediaIds : key === "placeId" ? placeIds : undefined;
      if (set) for (const id of Array.isArray(entry) ? entry : [entry]) if (typeof id === "string") set.add(id);
      if (typeof entry === "object") refs(entry);
    }
  }
  refs(data); refs(related);
  const events = state.events.filter(e => eventIds.has(e.id)); refs(events);
  const sources = state.sources.filter(s => sourceIds.has(s.id)); refs(sources);
  const places = state.places.filter(p => placeIds.has(p.id)); refs(places);
  return { name: `${name}.kinforge.json`, type: "application/json", content: JSON.stringify({ app: "KinForge Genealogy Studio", copyright: PUBLIC_EXPORT_NOTICE, format: "saved-item", version: 1, exportedAt: new Date().toISOString(), kind: target.kind, ownerId: target.ownerId, data, related: { ...related, events, sources, places, media: state.media.filter(m => mediaIds.has(m.id)) } }, null, 2) };
}

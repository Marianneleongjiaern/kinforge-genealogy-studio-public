export type SyncConflict = { path: string; local: unknown; remote: unknown; base: unknown };
export type ConflictChoices = Record<string, "local" | "remote">;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const entities = (v: unknown[]): v is (Record<string, unknown> & { id: string })[] => v.every(row => object(row) && typeof row.id === "string");

// Compare each edit with the last acknowledged server version, including deletions.
export function mergeCloudState<T>(base: T, local: T, remote: T, choices: ConflictChoices = {}): { state: T; conflicts: SyncConflict[] } {
  const conflicts: SyncConflict[] = [];
  const isLibrary = (value: unknown): value is AppState => object(value) && ["books", "collections", "trees", "people", "families", "events", "reportDrafts", "media", "records", "ideasJournal", "userFeedback", "todos", "dnaMatches", "sources", "places", "relationships"].every(key => Array.isArray(value[key]));
  if (isLibrary(base) && isLibrary(local) && isLibrary(remote)) {
    let b: AppState = base, l: AppState = local, r: AppState = remote;
    for (const kind of ["books", "collections", "trees"] as const) {
      for (const row of b[kind]) {
        const hasLocal = l[kind].some(item => item.id === row.id), hasRemote = r[kind].some(item => item.id === row.id);
        if (hasLocal === hasRemote) continue;
        const target: DeleteTarget = { kind, id: row.id };
        const survivor = hasLocal ? l : r;
        if (same(deletionSnapshot(b, target), deletionSnapshot(survivor, target))) continue;
        const path = `${kind}[${row.id}] deletion`;
        const plan = planDeletion(survivor, target);
        const describe = (present: boolean) => present ? `Keep ${plan.title} with its edited records` : `Delete ${plan.title} and its contents`;
        if (!choices[path]) conflicts.push({ path, base: plan.title, local: describe(hasLocal), remote: describe(hasRemote) });
        const chosen = choices[path] === "remote" ? r : l;
        b = alignDeletionScope(b, chosen, target); l = alignDeletionScope(l, chosen, target); r = alignDeletionScope(r, chosen, target);
      }
    }
    base = b as T; local = l as T; remote = r as T;
  }
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (same(l, r)) return l;
    if (same(l, b)) return r;
    if (same(r, b)) return l;
    if (Array.isArray(l) && Array.isArray(r) && (b === undefined || Array.isArray(b))) {
      const before = Array.isArray(b) ? b : [];
      if (entities(l) && entities(r) && entities(before)) {
        const bm = new Map(before.map(row => [row.id, row])); const lm = new Map(l.map(row => [row.id, row])); const rm = new Map(r.map(row => [row.id, row]));
        return [...new Set([...r.map(row => row.id), ...l.map(row => row.id)])].map(id => merge(bm.get(id), lm.get(id), rm.get(id), `${path}[${id}]`)).filter(row => row !== undefined);
      }
      if ([...l, ...r, ...before].every(row => typeof row === "string")) {
        return [...new Set([...r, ...l])].filter(row => !before.includes(row) || (l.includes(row) && r.includes(row)));
      }
    }
    if (object(l) && object(r) && (b === undefined || object(b))) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(b || {}), ...Object.keys(l), ...Object.keys(r)])) {
        if (["__proto__", "constructor", "prototype"].includes(key)) continue;
        const value = merge(object(b) ? b[key] : undefined, l[key], r[key], path ? `${path}.${key}` : key);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (!choices[path]) conflicts.push({ path, local: l, remote: r, base: b });
    return choices[path] === "remote" ? r : l;
  }
  return { state: merge(base, local, remote, "") as T, conflicts };
}

export function mergeDeviceLibrary<T extends Record<string, any>>(device: T, cloud: T) {
  const empty = Object.fromEntries(Object.entries(cloud).map(([key, value]) => [key, Array.isArray(value) ? [] : {}])) as T;
  return mergeCloudState(empty, device, cloud);
}
import { AppState } from "./domain";
import { alignDeletionScope, deletionSnapshot, DeleteTarget, planDeletion } from "./deletion";

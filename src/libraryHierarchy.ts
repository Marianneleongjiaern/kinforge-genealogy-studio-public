import { makeId, type AppState, type Collection } from "./domain";

export type CollectionBranch = { collection: Collection; children: CollectionBranch[] };

export function collectionDescendants(collections: Collection[], id: string): Set<string> {
  const descendants = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const parentId = pending.pop();
    for (const child of collections) {
      if (child.parentId === parentId && child.id !== id && !descendants.has(child.id)) {
        descendants.add(child.id);
        pending.push(child.id);
      }
    }
  }
  return descendants;
}

export function collectionHierarchy(collections: Collection[], bookId: string): CollectionBranch[] {
  const entries = collections.filter(collection => collection.bookId === bookId);
  const ids = new Set(entries.map(collection => collection.id));
  const visited = new Set<string>();
  const branch = (collection: Collection): CollectionBranch => {
    visited.add(collection.id);
    return { collection, children: entries.filter(child => child.parentId === collection.id && !visited.has(child.id)).map(branch) };
  };
  const roots = entries.filter(collection => !collection.parentId || !ids.has(collection.parentId));
  const result = roots.map(branch);
  // Keep malformed legacy branches visible instead of losing them to an orphan or cycle.
  for (const collection of entries) if (!visited.has(collection.id)) result.push(branch(collection));
  return result;
}

export function collectionOptions(collections: Collection[], bookId: string): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  const visit = (branch: CollectionBranch, path: string[]) => {
    const names = [...path, branch.collection.name];
    options.push({ id: branch.collection.id, label: names.join(" / ") });
    branch.children.forEach(child => visit(child, names));
  };
  collectionHierarchy(collections, bookId).forEach(branch => visit(branch, []));
  return options;
}

export function subcollectionOptions(collections: Collection[], bookId: string): Array<{ id: string; label: string }> {
  const byId = new Map(collections.map(collection => [collection.id, collection]));
  return collectionOptions(collections, bookId).filter(option => !!byId.get(option.id)?.parentId);
}

export function addLibraryCollection(state: AppState, bookId: string, parentId?: string): Collection | undefined {
  if (!state.books.some(book => book.id === bookId)) return;
  if (parentId && !state.collections.some(collection => collection.id === parentId && collection.bookId === bookId)) return;
  const base = parentId ? "New subcollection" : "New collection";
  const names = new Set(state.collections.filter(collection => collection.bookId === bookId && collection.parentId === parentId).map(collection => collection.name));
  let name = base, suffix = 2;
  while (names.has(name)) name = `${base} ${suffix++}`;
  const collection = { id: makeId("collection"), bookId, parentId, name };
  state.collections.push(collection);
  return collection;
}

export function ensureTreeSubcollection(state: AppState, bookId: string, parentId?: string): Collection | undefined {
  if (!state.books.some(book => book.id === bookId)) return;
  let parent = parentId ? state.collections.find(collection => collection.id === parentId && collection.bookId === bookId) : undefined;
  if (parent?.parentId) parent = state.collections.find(collection => collection.id === parent?.parentId && collection.bookId === bookId);
  if (!parent) parent = state.collections.find(collection => collection.bookId === bookId && !collection.parentId) || addLibraryCollection(state, bookId);
  if (!parent) return;
  return state.collections.find(collection => collection.bookId === bookId && collection.parentId === parent.id) || addLibraryCollection(state, bookId, parent.id);
}

export function normalizeTreeSubcollectionPlacements(state: AppState): AppState {
  const collections = new Map(state.collections.map(collection => [collection.id, collection]));
  for (const tree of state.trees) {
    const collection = tree.collectionId ? collections.get(tree.collectionId) : undefined;
    if (collection?.bookId === tree.bookId && collection.parentId) continue;
    const subcollection = ensureTreeSubcollection(state, tree.bookId, collection?.bookId === tree.bookId ? collection.id : undefined);
    if (subcollection) {
      tree.bookId = subcollection.bookId;
      tree.collectionId = subcollection.id;
    }
  }
  return state;
}

export function moveLibraryCollection(state: AppState, id: string, bookId: string, parentId?: string): boolean {
  const collection = state.collections.find(entry => entry.id === id);
  if (!collection || !state.books.some(book => book.id === bookId)) return false;
  const descendants = collectionDescendants(state.collections, id);
  if (parentId && (parentId === id || descendants.has(parentId) || !state.collections.some(entry => entry.id === parentId && entry.bookId === bookId))) return false;
  collection.parentId = parentId || undefined;
  const moved = new Set([id, ...descendants]);
  for (const entry of state.collections) if (moved.has(entry.id)) entry.bookId = bookId;
  // Contents travel with their collection; never clear their placement during a move.
  for (const tree of state.trees) if (tree.collectionId && moved.has(tree.collectionId)) tree.bookId = bookId;
  for (const report of state.reportDrafts) if (report.collectionId && moved.has(report.collectionId)) report.bookId = bookId;
  return true;
}

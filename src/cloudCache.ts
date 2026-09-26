import type { AppState } from "./domain";
import { writeLibraryPreview } from "./cloudPreview";
export type CachedLibrary = { base: AppState | null; draft: AppState; revision: number; dirty: boolean };
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("kinforge-cloud-cache-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("libraries");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function readCache(userId: string, libraryId: string): Promise<CachedLibrary | undefined> {
  const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction("libraries").objectStore("libraries").get(`${userId}:${libraryId}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function writeCache(userId: string, libraryId: string, value: CachedLibrary) {
  const db = await open(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction("libraries", "readwrite"); transaction.objectStore("libraries").put(value, `${userId}:${libraryId}`); transaction.oncomplete = () => { writeLibraryPreview(userId, libraryId, value.draft); resolve(); }; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}

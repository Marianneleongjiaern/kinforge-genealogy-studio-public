import { cloudRequest } from "./cloudApi";
import { registerExportCapture } from "./exportCapture";
import { categoryForFileName, sanitizeNativeFileName, type NativeStorageCategory } from "./nativeStorage";

type ExportJob = { id: string; userId: string; libraryId: string; name: string; category: NativeStorageCategory; blob: Blob };
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("kinforge-export-outbox-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("exports", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result); request.onerror = () => { database = undefined; reject(request.error); };
  });
}
async function jobs() { const db = await open(); return new Promise<ExportJob[]>((resolve, reject) => { const request = db.transaction("exports").objectStore("exports").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function edit(job: ExportJob | string) {
  const db = await open(); return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("exports", "readwrite"); const store = tx.objectStore("exports");
    if (typeof job === "string") store.delete(job); else store.put(job);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
const announce = (message: string) => window.dispatchEvent(new CustomEvent("kinforge-export-status", { detail: message }));
export const blobDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob.type ? blob : new Blob([blob], { type: "application/octet-stream" }));
});
export function exportDataUrlBlob(dataUrl: string) {
  const match = /^data:([\w.+/-]+)(?:;charset=[\w-]+)?;base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("The saved export could not be read.");
  return new Blob([Uint8Array.from(atob(match[2]), c => c.charCodeAt(0))], { type: match[1] });
}

export function startCloudExports(userId: string, libraryId: string) {
  let active = true, busy = false;
  async function flush() {
    if (!active || busy || !navigator.onLine) return;
    busy = true;
    try {
      const pending = (await jobs()).filter(job => job.userId === userId && job.libraryId === libraryId);
      for (const job of pending) {
        if (!active) break;
        const dataUrl = await blobDataUrl(job.blob);
        if (!active) break;
        await cloudRequest(`/api/libraries/${libraryId}/exports/${job.id}`, "PUT", { name: job.name, category: job.category, dataUrl });
        await edit(job.id);
      }
      if (active && pending.length) announce("Export saved to your cloud library.");
    } catch { if (active) announce("Export waiting to sync. It is kept on this device and will retry when your account reconnects."); }
    finally { busy = false; }
  }
  const unregister = registerExportCapture(async (name, blob, category) => {
    // The closure binds the originating account even when report generation finishes after a switch.
    if (blob.size > 36 * 1024 * 1024) { if (active) announce("This export was downloaded locally. Files above 36 MB cannot be added to cloud exports yet."); return; }
    await edit({ id: crypto.randomUUID(), userId, libraryId, name: sanitizeNativeFileName(name), category: category || categoryForFileName(name), blob });
    if (active) { announce("Export queued for cloud sync."); void flush(); }
  });
  const timer = window.setInterval(() => void flush(), 15000);
  const wake = () => void flush(); window.addEventListener("online", wake); window.addEventListener("focus", wake);
  void flush();
  return () => { active = false; unregister(); clearInterval(timer); window.removeEventListener("online", wake); window.removeEventListener("focus", wake); };
}

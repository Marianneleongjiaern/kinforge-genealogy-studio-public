import type { AppState } from "./domain";
const key = (userId: string, libraryId: string) => `kinforge-library-preview-v1:${encodeURIComponent(userId)}:${encodeURIComponent(libraryId)}`;
const maximumBytes = 512 * 1024;

// Read-only startup acceleration, never a sync base or a replacement for the durable draft.
export function readLibraryPreview(userId: string, libraryId: string): AppState | undefined {
  try {
    const text = localStorage.getItem(key(userId, libraryId));
    if (!text || text.length > maximumBytes) return;
    const value = JSON.parse(text);
    if (value.userId !== userId || value.libraryId !== libraryId || !Array.isArray(value.state?.people) || !Array.isArray(value.state?.trees)) return;
    return value.state;
  } catch { return; }
}
export function writeLibraryPreview(userId: string, libraryId: string, state: AppState) {
  try {
    // Attachment bytes are loaded from the full draft; keep genealogy and report text intact.
    const text = JSON.stringify({ userId, libraryId, state }, (_name, value) => typeof value === "string" && value.startsWith("data:") ? "" : value);
    if (text.length <= maximumBytes) localStorage.setItem(key(userId, libraryId), text);
    else localStorage.removeItem(key(userId, libraryId));
  } catch { /* The full IndexedDB draft is authoritative when preview storage is unavailable. */ }
}

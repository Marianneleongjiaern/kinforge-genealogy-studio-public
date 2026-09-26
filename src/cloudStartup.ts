import type { CloudLibrary, CloudUser } from "./cloudApi";

export type CloudStartup = {
  user: CloudUser;
  libraries: CloudLibrary[];
  libraryId: string;
};

const KEY = "kinforge-cloud-startup-v1";

function isUser(value: unknown): value is CloudUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<CloudUser>;
  return typeof user.id === "string" && typeof user.name === "string" && typeof user.email === "string";
}

function isLibrary(value: unknown): value is CloudLibrary {
  if (!value || typeof value !== "object") return false;
  const library = value as Partial<CloudLibrary>;
  return typeof library.id === "string" && typeof library.name === "string"
    && (library.role === "owner" || library.role === "editor" || library.role === "viewer")
    && typeof library.revision === "number" && typeof library.owner_email === "string";
}

export function readCloudStartup(): CloudStartup | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CloudStartup>;
    if (!isUser(value.user) || !Array.isArray(value.libraries) || !value.libraries.every(isLibrary)) return null;
    const libraryId = typeof value.libraryId === "string" && value.libraries.some(library => library.id === value.libraryId)
      ? value.libraryId
      : value.libraries[0]?.id || "";
    return { user: value.user, libraries: value.libraries, libraryId };
  } catch {
    return null;
  }
}

export function writeCloudStartup(user: CloudUser, libraries: CloudLibrary[], libraryId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ user, libraries, libraryId } satisfies CloudStartup));
  } catch {
    // Startup metadata is an acceleration only; cloud auth remains authoritative.
  }
}

export function clearCloudStartup() {
  try { localStorage.removeItem(KEY); } catch { /* Storage may be unavailable in a restricted browser. */ }
}

export type DriveProvider = "google" | "onedrive";
export type DriveEnv = {
  DB: D1Database; BUCKET: R2Bucket;
  DRIVE_TOKEN_KEY?: string; DRIVE_PUBLIC_ORIGIN?: string;
  GOOGLE_DRIVE_CLIENT_ID?: string; GOOGLE_DRIVE_CLIENT_SECRET?: string;
  ONEDRIVE_CLIENT_ID?: string; ONEDRIVE_CLIENT_SECRET?: string;
};
export class DriveError extends Error {
  constructor(public status: number, message: string, public retryAfter = 60000) { super(message); }
}
export const providerName = (provider: DriveProvider) => provider === "google" ? "Google Drive" : "OneDrive";
export const sha256 = async (value: string | Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : value))].map(n => n.toString(16).padStart(2, "0")).join("");
export const randomSecret = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, "0")).join("");
export function providerConfig(env: DriveEnv, provider: DriveProvider) {
  return provider === "google" ? {
    clientId: env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file"
  } : {
    clientId: env.ONEDRIVE_CLIENT_ID, clientSecret: env.ONEDRIVE_CLIENT_SECRET,
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder"
  };
}
export function configured(env: DriveEnv, provider: DriveProvider) {
  const config = providerConfig(env, provider);
  return !!(config.clientId && config.clientSecret && /^[a-f0-9]{64}$/i.test(env.DRIVE_TOKEN_KEY || "") && /^https:\/\/[^/?#]+$/.test(env.DRIVE_PUBLIC_ORIGIN || ""));
}
export function callbackUrl(env: DriveEnv, provider: DriveProvider) { return `${env.DRIVE_PUBLIC_ORIGIN}/api/drive-oauth/${provider}/callback`; }
async function encryptionKey(env: DriveEnv) {
  if (!/^[a-f0-9]{64}$/i.test(env.DRIVE_TOKEN_KEY || "")) throw new DriveError(503, "Cloud drive connections need the app owner's setup.");
  return crypto.subtle.importKey("raw", new Uint8Array(env.DRIVE_TOKEN_KEY!.match(/../g)!.map(n => parseInt(n, 16))), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(env: DriveEnv, value: unknown, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, await encryptionKey(env), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ iv: [...iv], data: [...new Uint8Array(data)] });
}
export async function unseal<T>(env: DriveEnv, text: string, context: string): Promise<T> {
  const value = JSON.parse(text);
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(value.iv), additionalData: new TextEncoder().encode(context) }, await encryptionKey(env), new Uint8Array(value.data));
  return JSON.parse(new TextDecoder().decode(data));
}
export type DriveTokens = { accessToken: string; refreshToken: string; expiresAt: number };
export async function exchangeTokens(env: DriveEnv, provider: DriveProvider, params: Record<string, string>, previous?: DriveTokens): Promise<DriveTokens> {
  const config = providerConfig(env, provider);
  const response = await fetch(config.token, { method: "POST", redirect: "manual", body: new URLSearchParams({ client_id: config.clientId!, client_secret: config.clientSecret!, ...params }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new DriveError(response.status === 400 ? 401 : 503, "Reconnect this drive to renew access.");
  const tokens = await response.json<any>();
  if (typeof tokens.access_token !== "string" || !(tokens.refresh_token || previous?.refreshToken)) throw new DriveError(401, "Offline drive access was not granted. Reconnect and allow access.");
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || previous!.refreshToken, expiresAt: Date.now() + Math.max(60, Number(tokens.expires_in) || 3600) * 1000 };
}
type RemoteFile = { id: string; name: string; etag?: string; version?: string };
const google = "https://www.googleapis.com/drive/v3";
const graph = "https://graph.microsoft.com/v1.0/me/drive";
const quoted = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const pathPart = (value: string) => encodeURIComponent(value);
export class DriveClient {
  beforeWrite?: () => Promise<void>;
  constructor(readonly provider: DriveProvider, private token: string) {}
  private async request(url: string, init: RequestInit = {}, allowMissing = false): Promise<Response> {
    if (init.method && !["GET", "HEAD"].includes(init.method)) await this.beforeWrite?.();
    const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...init.headers }, redirect: "manual", signal: AbortSignal.timeout(12000) });
    if (allowMissing && response.status === 404) return response;
    if (response.ok || response.status === 302) return response;
    if (response.status === 412 || response.status === 409) throw new DriveError(409, "The drive copy changed during sync. Retry to check both versions.");
    if (response.status === 401 || response.status === 403) throw new DriveError(401, "Drive access has expired or was denied. Reconnect this drive.");
    const delay = Math.min(3600000, Math.max(30000, Number(response.headers.get("retry-after")) * 1000 || 60000));
    throw new DriveError(response.status, response.status === 429 ? "The drive is busy. Sync will retry automatically." : response.status === 507 ? "This drive has no space left. Free some space and retry." : "The drive could not be reached. Your KinForge library is saved; sync will retry.", delay);
  }
  async find(parent: string, name: string): Promise<RemoteFile | null> {
    if (this.provider === "google") {
      const query = new URLSearchParams({ q: `'${quoted(parent)}' in parents and name='${quoted(name)}' and trashed=false`, fields: "files(id,name)", pageSize: "2" });
      const value = await (await this.request(`${google}/files?${query}`)).json<any>();
      if (value.files?.length > 1) throw new DriveError(409, "This drive has duplicate KinForge files. Resolve the duplicate before syncing.");
      return value.files?.[0] || null;
    }
    const response = await this.request(`${graph}/items/${pathPart(parent)}:/${pathPart(name)}?$select=id,name,eTag`, {}, true);
    if (response.status === 404) return null;
    const value = await response.json<any>(); return { id: value.id, name: value.name, etag: value.eTag };
  }
  async folder(parent: string, name: string): Promise<string> {
    const existing = await this.find(parent, name); if (existing) return existing.id;
    const response = await this.request(this.provider === "google" ? `${google}/files` : `${graph}/items/${pathPart(parent)}/children`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(this.provider === "google"
        ? { name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }
        : { name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" })
    });
    return (await response.json<any>()).id;
  }
  async root(libraryId: string) {
    const parent = this.provider === "google" ? "root" : (await (await this.request(`${graph}/special/approot`)).json<any>()).id;
    return this.folder(parent, `KinForge-${libraryId}`);
  }
  async metadata(id: string): Promise<RemoteFile | null> {
    const response = await this.request(this.provider === "google" ? `${google}/files/${pathPart(id)}?fields=id,name,version,trashed` : `${graph}/items/${pathPart(id)}?$select=id,name,eTag,deleted`, {}, true);
    if (response.status === 404) return null;
    const item = await response.json<any>(); if (item.trashed || item.deleted) return null;
    return { id: item.id, name: item.name, version: String(item.version || item.eTag || ""), etag: item.eTag || response.headers.get("etag") || "" };
  }
  async list(parent: string): Promise<Map<string, RemoteFile>> {
    const files = new Map<string, RemoteFile>();
    let url = this.provider === "google" ? `${google}/files?${new URLSearchParams({ q: `'${quoted(parent)}' in parents and trashed=false`, fields: "files(id,name,version),nextPageToken", pageSize: "1000" })}` : `${graph}/items/${pathPart(parent)}/children?$select=id,name,eTag&$top=200`;
    for (let page = 0; url; page++) {
      if (page >= 50) throw new DriveError(413, "This drive folder is too large to verify in one pass.");
      const data = await (await this.request(url)).json<any>();
      for (const file of data.files || data.value || []) files.set(file.id, { id: file.id, name: file.name, version: String(file.version || file.eTag || "") });
      if (this.provider === "google") {
        if (data.nextPageToken) { const next = new URL(url); next.searchParams.set("pageToken", data.nextPageToken); url = next.href; } else url = "";
      } else {
        url = data["@odata.nextLink"] || "";
        if (url && (new URL(url).origin !== "https://graph.microsoft.com" || !new URL(url).pathname.startsWith("/v1.0/"))) throw new DriveError(502, "The drive returned an unsupported listing address.");
      }
    }
    return files;
  }
  async read(id: string, limit = 20 * 1024 * 1024): Promise<{ text: string; etag: string }> {
    const metadata = await this.metadata(id);
    if (!metadata) throw new DriveError(404, "The drive copy was removed. Reconnect to create a fresh copy.");
    let response = await this.request(this.provider === "google" ? `${google}/files/${pathPart(id)}?alt=media` : `${graph}/items/${pathPart(id)}/content`);
    const etag = metadata.etag || response.headers.get("etag") || "";
    if (response.status === 302) {
      const target = new URL(response.headers.get("location") || "");
      if (target.protocol !== "https:" || !["1drv.com", "sharepoint.com", "storage.live.com", "sharepoint-df.com"].some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) throw new DriveError(502, "The drive returned an unsupported download address.");
      // Preauthenticated downloads must not receive the Graph access token.
      response = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new DriveError(503, "The drive download is unavailable. Retry shortly.");
    }
    if (Number(response.headers.get("content-length")) > limit) throw new DriveError(413, "The drive file exceeds this library's size limit.");
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let text = "", size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new DriveError(413, "The drive file exceeds this library's size limit."); } text += decoder.decode(value, { stream: true }); }
    return { text: text + decoder.decode(), etag: etag || response.headers.get("etag") || "" };
  }
  async put(parent: string, name: string, content: Uint8Array | string, mime: string, existingId?: string, etag?: string): Promise<string> {
    if (existingId && name === "Library.json" && !etag) throw new DriveError(409, "The drive did not provide a file version. Sync paused to protect changes; reconnect and retry.");
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    if (this.provider === "onedrive") {
      const url = existingId ? `${graph}/items/${pathPart(existingId)}/content` : `${graph}/items/${pathPart(parent)}:/${pathPart(name)}:/content?@microsoft.graph.conflictBehavior=fail`;
      const response = await this.request(url, { method: "PUT", headers: { "Content-Type": mime, ...(etag ? { "If-Match": etag } : {}) }, body: bytes });
      return (await response.json<any>()).id;
    }
    const start = await this.request(`https://www.googleapis.com/upload/drive/v3/files${existingId ? `/${pathPart(existingId)}` : ""}?uploadType=resumable`, {
      method: existingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(bytes.length), ...(etag ? { "If-Match": etag } : {}) },
      body: JSON.stringify(existingId ? { name } : { name, parents: [parent] })
    });
    const upload = new URL(start.headers.get("location") || "");
    if (upload.protocol !== "https:" || upload.hostname !== "www.googleapis.com") throw new DriveError(502, "The drive returned an unsupported upload address.");
    const response = await this.request(upload.href, { method: "PUT", headers: { "Content-Type": mime }, body: bytes });
    return (await response.json<any>()).id;
  }
  async remove(id: string) { await this.request(this.provider === "google" ? `${google}/files/${pathPart(id)}` : `${graph}/items/${pathPart(id)}`, { method: "DELETE" }, true); }
}

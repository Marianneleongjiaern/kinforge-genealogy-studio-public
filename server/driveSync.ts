import { libraryAssetHashes, sanitizeLibraryVisibility } from "./libraryPrivacy";
import { DriveClient, DriveError, callbackUrl, configured, exchangeTokens, providerConfig, providerName, randomSecret, seal, sha256, unseal, type DriveEnv, type DriveProvider, type DriveTokens } from "./driveProviders";

type Connection = { id: string; library_id: string; provider: DriveProvider; credentials: string; folder_id: string | null; manifest_id: string | null; manifest_hash: string | null; synced_revision: number; enabled: number; status: string; error: string | null; last_sync: number | null; retry_at: number; lease_until: number };
type Library = { id: string; owner_id: string; revision: number; object_key: string | null; name: string };
type ExportFile = { id: string; name: string; category: string; mime: string; object_key: string; hash: string; size: number; created_at: number };
const providers: DriveProvider[] = ["google", "onedrive"];
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const categories = ["Reports", "Backups", "Websites", "Exports", "Media", "GEDCOM", "Charts"];
const connection = (env: DriveEnv, id: string, provider: DriveProvider) => env.DB.prepare("SELECT * FROM drive_connections WHERE library_id=? AND provider=?").bind(id, provider).first<Connection>();
const oauthContext = (id: string, provider: DriveProvider) => `${id}:${provider}`;
function providerValue(value: string): DriveProvider { if (!providers.includes(value as DriveProvider)) throw new DriveError(404, "This cloud drive is unavailable."); return value as DriveProvider; }
const safeName = (name: unknown) => String(name || "KinForge-export").replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g, "-").slice(0, 140);
export function decodeExport(data: unknown): { bytes: Uint8Array; mime: string } {
  if (typeof data !== "string" || !/^data:[\w.+/-]+(?:;charset=[\w-]+)?;base64,[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new DriveError(400, "The export file could not be read.");
  const comma = data.indexOf(",");
  try { return { bytes: Uint8Array.from(atob(data.slice(comma + 1)), c => c.charCodeAt(0)), mime: data.slice(5, data.indexOf(";")) }; }
  catch { throw new DriveError(400, "The export file could not be read."); }
}
async function clientFor(env: DriveEnv, row: Connection) {
  let tokens = await unseal<DriveTokens>(env, row.credentials, row.id);
  if (tokens.expiresAt < Date.now() + 60000) {
    tokens = await exchangeTokens(env, row.provider, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens);
    await env.DB.prepare("UPDATE drive_connections SET credentials=? WHERE id=?").bind(await seal(env, tokens, row.id), row.id).run();
  }
  return new DriveClient(row.provider, tokens.accessToken);
}
async function recordFile(env: DriveEnv, row: Connection, path: string, remoteId: string, hash: string, version = "") {
  await env.DB.prepare("INSERT INTO drive_files (connection_id,path,remote_id,hash,remote_version) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM drive_connections WHERE id=?) ON CONFLICT(connection_id,path) DO UPDATE SET remote_id=excluded.remote_id,hash=excluded.hash,remote_version=excluded.remote_version").bind(row.id, path, remoteId, hash, version, row.id).run();
}
async function fileFor(env: DriveEnv, row: Connection, path: string) { return env.DB.prepare("SELECT remote_id,hash FROM drive_files WHERE connection_id=? AND path=?").bind(row.id, path).first<{ remote_id: string; hash: string }>(); }
async function folderFor(env: DriveEnv, client: DriveClient, row: Connection, name: string) {
  const existing = await fileFor(env, row, `${name}/`); if (existing && await client.metadata(existing.remote_id)) return existing.remote_id;
  const id = await client.folder(row.folder_id!, name); await recordFile(env, row, `${name}/`, id, "folder"); return id;
}
async function uploadFile(env: DriveEnv, client: DriveClient, row: Connection, folder: string, path: string, name: string, text: string, mime: string, raw = false) {
  const hash = await sha256(text);
  const existing = await client.find(folder, name);
  // Preserve an externally edited file and create a fresh canonical copy with a distinct name.
  if (existing) name = `${crypto.randomUUID()}-${name}`;
  const content = raw ? decodeExport(text).bytes : text;
  const id = await client.put(folder, name, content, mime);
  const metadata = await client.metadata(id);
  if (!metadata?.version) throw new DriveError(503, "The drive file could not be verified. Sync will retry.");
  await recordFile(env, row, path, id, hash, metadata.version); return id;
}
async function stillEnabled(env: DriveEnv, row: Connection, lease: string) {
  if (!await env.DB.prepare("SELECT id FROM drive_connections WHERE id=? AND enabled=1 AND lease=? AND lease_until>?").bind(row.id, lease, Date.now()).first()) throw new DriveError(409, "Drive sync was paused or disconnected.");
}
async function claimOperation(env: DriveEnv, id: string, lease: string) {
  const claimed = await env.DB.prepare("UPDATE drive_connections SET lease=?,lease_until=? WHERE id=? AND lease_until<=?").bind(lease, Date.now() + 90000, id, Date.now()).run();
  if (claimed.meta.changes !== 1) throw new DriveError(409, "Wait for the current drive operation to finish, then try again.");
}
async function releaseOperation(env: DriveEnv, id: string, lease: string) {
  await env.DB.prepare("UPDATE drive_connections SET lease=NULL,lease_until=0 WHERE id=? AND lease=?").bind(id, lease).run();
}

// Work is bounded and progress is durable. Later saves or the active app resume large libraries.
export async function syncDrive(env: DriveEnv, libraryId: string, provider: DriveProvider, deadline = Date.now() + 22000) {
  let row = await connection(env, libraryId, provider);
  if (!row || !row.enabled || row.status === "conflict" || row.status === "reconnect" || row.retry_at > Date.now()) return;
  const lease = randomSecret(), now = Date.now();
  const claimed = await env.DB.prepare("UPDATE drive_connections SET lease=?,lease_until=?,status='syncing',error=NULL WHERE id=? AND enabled=1 AND lease_until<?").bind(lease, now + 90000, row.id, now).run();
  if (claimed.meta.changes !== 1) return;
  try {
    const client = await clientFor(env, row);
    client.beforeWrite = () => stillEnabled(env, row!, lease);
    if (row.folder_id && !await client.metadata(row.folder_id)) {
      row.folder_id = null; row.manifest_id = null; row.manifest_hash = null;
      await env.DB.prepare("DELETE FROM drive_files WHERE connection_id=?").bind(row.id).run();
      await env.DB.prepare("UPDATE drive_connections SET folder_id=NULL,manifest_id=NULL,manifest_hash=NULL WHERE id=? AND lease=?").bind(row.id, lease).run();
    }
    if (!row.folder_id) { row.folder_id = await client.root(libraryId); await env.DB.prepare("UPDATE drive_connections SET folder_id=? WHERE id=? AND lease=?").bind(row.folder_id, row.id, lease).run(); }
    const item = await env.DB.prepare("SELECT * FROM libraries WHERE id=?").bind(libraryId).first<Library>();
    if (!item) return;
    const saved = item.object_key ? await env.BUCKET.get(item.object_key) : null;
    if (!saved) { await env.DB.prepare("UPDATE drive_connections SET status='pending',error='Waiting for the first saved library.' WHERE id=? AND lease=?").bind(row.id, lease).run(); return; }
    const state = await saved.json<any>();
    const remoteFile = row.manifest_id ? await client.metadata(row.manifest_id) : await client.find(row.folder_id, "Library.json");
    let remoteText = "", remoteEtag = "";
    if (remoteFile) {
      const remote = await client.read(remoteFile.id); remoteText = remote.text; remoteEtag = remote.etag;
      // Never replace an independently changed file without a visible owner decision.
      if (await sha256(remoteText) !== row.manifest_hash) {
        await env.DB.prepare("UPDATE drive_connections SET manifest_id=?,status='conflict',error=? WHERE id=? AND lease=?").bind(remoteFile.id, "The drive library differs from the last synced copy. Review both versions before continuing.", row.id, lease).run(); return;
      }
    }
    const assets: Record<string, string> = {};
    const knownFiles = new Map((await env.DB.prepare("SELECT path,remote_id,hash,remote_version FROM drive_files WHERE connection_id=?").bind(row.id).all<{ path: string; remote_id: string; hash: string; remote_version: string }>()).results.map(file => [file.path, file]));
    const assetFolder = await folderFor(env, client, row, "Library media");
    const assetFiles = await client.list(assetFolder);
    const exportFolders = new Map<string, { id: string; files: Awaited<ReturnType<DriveClient["list"]>> }>();
    let repaired = false;
    let uploaded = 0;
    for (const hash of libraryAssetHashes(state)) {
      const path = `assets/${hash}`; const cached = knownFiles.get(path);
      if (cached && assetFiles.get(cached.remote_id)?.version === cached.remote_version) { assets[hash] = cached.remote_id; continue; }
      if (uploaded >= 4 || Date.now() - now > 15000 || Date.now() > deadline - 4000) return;
      await stillEnabled(env, row, lease);
      const data = await env.BUCKET.get(`libraries/${libraryId}/assets/${hash}`);
      if (!data) throw new DriveError(503, "An attachment is still uploading. Drive sync will resume shortly.");
      // Data URLs retain the original file type and bytes for lossless library recovery.
      assets[hash] = await uploadFile(env, client, row, assetFolder, path, `${hash}.data-url`, await data.text(), "text/plain"); uploaded++;
      if (cached) repaired = true;
    }
    const files = (await env.DB.prepare("SELECT * FROM library_exports WHERE library_id=? ORDER BY created_at,id").bind(libraryId).all<ExportFile>()).results;
    const exports: { id: string; name: string; category: string; remoteId: string; hash: string }[] = [];
    for (const file of files) {
      if (!exportFolders.has(file.category)) { const id = await folderFor(env, client, row, file.category); exportFolders.set(file.category, { id, files: await client.list(id) }); }
      const folder = exportFolders.get(file.category)!;
      const path = `exports/${file.id}`; const cached = knownFiles.get(path);
      if (cached?.hash === file.hash && folder.files.get(cached.remote_id)?.version === cached.remote_version) { exports.push({ id: file.id, name: file.name, category: file.category, remoteId: cached.remote_id, hash: file.hash }); continue; }
      if (uploaded >= 4 || Date.now() - now > 15000 || Date.now() > deadline - 4000) return;
      await stillEnabled(env, row, lease);
      const data = await env.BUCKET.get(file.object_key); if (!data) throw new DriveError(503, "A saved export is unavailable. Retry shortly.");
      const remoteId = await uploadFile(env, client, row, folder.id, path, `${file.id}-${file.name}`, await data.text(), file.mime, true);
      exports.push({ id: file.id, name: file.name, category: file.category, remoteId, hash: file.hash }); uploaded++;
      if (cached) repaired = true;
    }
    if (Date.now() - now > 18000 || Date.now() > deadline - 4000) return;
    await stillEnabled(env, row, lease);
    // Recheck the pointer before committing a complete snapshot with all referenced files.
    if (remoteFile && await sha256((await client.read(remoteFile.id)).text) !== row.manifest_hash) throw new DriveError(409, "The drive copy changed during sync. Retry to review the changes.");
    const manifest = JSON.stringify({ format: "kinforge-drive-v1", libraryId, revision: item.revision, state, assets, exports });
    const hash = await sha256(manifest);
    let manifestId = remoteFile?.id;
    if (hash !== row.manifest_hash || !manifestId) manifestId = await client.put(row.folder_id, "Library.json", manifest, "application/json", manifestId, remoteEtag);
    await env.DB.prepare("UPDATE drive_connections SET manifest_id=?,manifest_hash=?,synced_revision=?,status=CASE WHEN (SELECT revision FROM libraries WHERE id=library_id)=? THEN 'synced' ELSE 'pending' END,last_sync=?,retry_at=0,error=? WHERE id=? AND lease=?").bind(manifestId, hash, item.revision, item.revision, Date.now(), repaired ? "Missing or changed drive files were repaired. Any independently edited files were kept as separate copies." : null, row.id, lease).run();
  } catch (error) {
    const detail = error instanceof DriveError ? error : new DriveError(503, "The drive connection was interrupted. Sync will retry automatically.");
    await env.DB.prepare("UPDATE drive_connections SET status=?,error=?,retry_at=? WHERE id=? AND lease=?").bind(detail.status === 401 ? "reconnect" : "error", detail.message, Date.now() + detail.retryAfter, row.id, lease).run();
  } finally {
    await env.DB.prepare("UPDATE drive_connections SET lease=NULL,lease_until=0,status=CASE WHEN status='syncing' THEN 'pending' ELSE status END WHERE id=? AND lease=?").bind(row.id, lease).run();
  }
}
export async function syncLibraryDrives(env: DriveEnv, libraryId: string) {
  const deadline = Date.now() + 22000;
  await Promise.all(providers.map(async provider => {
    for (let pass = 0; pass < 8 && Date.now() < deadline - 4000; pass++) {
      await syncDrive(env, libraryId, provider, deadline);
      const row = await connection(env, libraryId, provider);
      if (!row?.enabled || row.status !== "pending" || row.error || row.lease_until > Date.now()) return;
    }
  }));
}

export async function driveOAuth(request: Request, env: DriveEnv, ctx: ExecutionContext): Promise<Response | null> {
  const url = new URL(request.url); const match = /^\/api\/drive-oauth\/(google|onedrive)\/(start|callback)$/.exec(url.pathname);
  if (!match || request.method !== "GET") return null;
  const provider = providerValue(match[1]);
  if (!configured(env, provider)) throw new DriveError(503, "This drive connection needs the app owner's setup.");
  const token = url.searchParams.get(match[2] === "start" ? "ticket" : "state") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) throw new DriveError(400, "This connection link is invalid or expired. Connect again from KinForge.");
  const hash = await sha256(token);
  const auth = await env.DB.prepare("SELECT d.* FROM drive_authorizations d JOIN sessions s ON s.hash=d.session_hash JOIN libraries l ON l.id=d.library_id WHERE d.hash=? AND d.provider=? AND d.expires_at>? AND s.expires_at>? AND s.user_id=l.owner_id").bind(hash, provider, Date.now(), Date.now()).first<any>();
  if (!auth) throw new DriveError(400, "This connection link expired. Connect again from KinForge.");
  const cookieName = `kinforge_drive_${provider}`;
  if (match[2] === "start") {
    const nonce = randomSecret();
    const claimed = await env.DB.prepare("UPDATE drive_authorizations SET phase='callback',browser_hash=? WHERE hash=? AND phase='start'").bind(await sha256(nonce), hash).run();
    if (claimed.meta.changes !== 1) throw new DriveError(400, "This connection link was already opened. Connect again from KinForge.");
    const verifier = await unseal<string>(env, auth.verifier, oauthContext(auth.library_id, provider));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const config = providerConfig(env, provider); const authorize = new URL(config.authorize);
    authorize.search = new URLSearchParams({ client_id: config.clientId!, redirect_uri: callbackUrl(env, provider), response_type: "code", scope: config.scope, state: token, code_challenge: challenge, code_challenge_method: "S256", ...(provider === "google" ? { access_type: "offline", prompt: "consent" } : { prompt: "select_account", response_mode: "query" }) }).toString();
    return new Response(null, { status: 302, headers: { Location: authorize.href, "Set-Cookie": `${cookieName}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/drive-oauth/${provider}; Max-Age=600`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  const nonce = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
  if (auth.phase !== "callback" || await sha256(nonce) !== auth.browser_hash) throw new DriveError(403, "Complete the connection in the browser where it was started.");
  const consumed = await env.DB.prepare("UPDATE drive_authorizations SET phase='exchanging' WHERE hash=? AND phase='callback' RETURNING hash").bind(hash).first();
  if (!consumed) throw new DriveError(400, "This connection was already completed.");
  let message = `${providerName(provider)} was not connected. Return to KinForge to try again.`;
  if (!url.searchParams.has("error") && url.searchParams.get("code")) {
    const verifier = await unseal<string>(env, auth.verifier, oauthContext(auth.library_id, provider));
    const tokens = await exchangeTokens(env, provider, { grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: callbackUrl(env, provider), code_verifier: verifier });
    const id = crypto.randomUUID();
    // A reconnect uses a fresh connection and rediscovers that account's folder before writing.
    const allowed = "SELECT d.hash FROM drive_authorizations d JOIN sessions s ON s.hash=d.session_hash JOIN libraries l ON l.id=d.library_id WHERE d.hash=? AND d.phase='exchanging' AND d.expires_at>? AND s.expires_at>? AND s.user_id=l.owner_id";
    const finished = await env.DB.batch([
      env.DB.prepare(`DELETE FROM drive_connections WHERE library_id=? AND provider=? AND EXISTS (${allowed})`).bind(auth.library_id, provider, hash, Date.now(), Date.now()),
      env.DB.prepare(`INSERT INTO drive_connections (id,library_id,provider,credentials,created_at) SELECT ?,?,?,?,? WHERE EXISTS (${allowed})`).bind(id, auth.library_id, provider, await seal(env, tokens, id), Date.now(), hash, Date.now(), Date.now()),
      env.DB.prepare("DELETE FROM drive_authorizations WHERE hash=?").bind(hash)
    ]);
    if (finished[1].meta.changes !== 1) throw new DriveError(409, "This drive connection was canceled. Return to KinForge to connect again.");
    ctx.waitUntil(syncDrive(env, auth.library_id, provider));
    message = `${providerName(provider)} is connected. Return to KinForge to see sync progress.`;
  }
  await env.DB.prepare("DELETE FROM drive_authorizations WHERE hash=?").bind(hash).run();
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KinForge drive connection</title><body><main><h1>KinForge</h1><p>${message}</p><a href="/app/">Return to KinForge</a></main></body></html>`, { headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'", "Set-Cookie": `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/api/drive-oauth/${provider}; Max-Age=0` } });
}

export async function driveRoutes(request: Request, env: DriveEnv, ctx: ExecutionContext, item: Library, action: string, sessionHash: string, readBody: (limit?: number) => Promise<any>, validateDocument: (data: any) => void): Promise<Response> {
  const method = request.method;
  if (action === "drives" && method === "GET") {
    const rows = (await env.DB.prepare("SELECT provider,enabled,status,error,last_sync,synced_revision,manifest_id FROM drive_connections WHERE library_id=?").bind(item.id).all<any>()).results;
    return json({ providers: providers.map(provider => ({ provider, name: providerName(provider), configured: configured(env, provider), connected: rows.some(row => row.provider === provider), ...rows.find(row => row.provider === provider), callbackUrl: env.DRIVE_PUBLIC_ORIGIN ? callbackUrl(env, provider) : null })), revision: item.revision });
  }
  if (action === "drives/sync" && method === "POST") { ctx.waitUntil(syncLibraryDrives(env, item.id)); return json({ queued: true }, 202); }
  const route = /^drives\/(google|onedrive)(?:\/(connect|resolve))?$/.exec(action);
  if (route) {
    const provider = providerValue(route[1]); const row = await connection(env, item.id, provider);
    if (route[2] === "connect" && method === "POST") {
      if (!configured(env, provider)) throw new DriveError(503, `${providerName(provider)} needs the app owner's connection setup before you can sign in.`);
      const ticket = randomSecret();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM drive_authorizations WHERE library_id=? AND provider=?").bind(item.id, provider),
        env.DB.prepare("INSERT INTO drive_authorizations (hash,library_id,session_hash,provider,verifier,expires_at) VALUES (?,?,?,?,?,?)").bind(await sha256(ticket), item.id, sessionHash, provider, await seal(env, randomSecret(), oauthContext(item.id, provider)), Date.now() + 600000)
      ]);
      return json({ url: `${env.DRIVE_PUBLIC_ORIGIN}/api/drive-oauth/${provider}/start?ticket=${ticket}` });
    }
    if (!route[2] && method === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM drive_connections WHERE library_id=? AND provider=?").bind(item.id, provider), env.DB.prepare("DELETE FROM drive_authorizations WHERE library_id=? AND provider=?").bind(item.id, provider)]);
      return json({ disconnected: true });
    }
    if (!row) throw new DriveError(404, "Connect this drive first.");
    if (!route[2] && method === "POST") {
      const data = await readBody(); if (typeof data.enabled !== "boolean") throw new DriveError(400, "Choose whether to sync this drive.");
      await env.DB.prepare("UPDATE drive_connections SET enabled=?,retry_at=0,lease=NULL,lease_until=0,status=CASE WHEN status='syncing' THEN 'pending' ELSE status END WHERE id=?").bind(data.enabled ? 1 : 0, row.id).run();
      if (data.enabled) ctx.waitUntil(syncDrive(env, item.id, provider)); return json({ ok: true });
    }
    if (route[2] === "resolve" && (method === "GET" || method === "POST")) {
      if (!row.manifest_id) throw new DriveError(409, "There is no drive copy to compare yet.");
      const operation = method === "POST" ? randomSecret() : null;
      let resolved = false;
      if (operation) await claimOperation(env, row.id, operation);
      try {
      const client = await clientFor(env, row); const remote = await client.read(row.manifest_id); const hash = await sha256(remote.text);
      let copy: any; try { copy = JSON.parse(remote.text); } catch { throw new DriveError(400, "The drive copy is not a readable KinForge library."); }
      if (copy.format !== "kinforge-drive-v1" || copy.libraryId !== item.id) throw new DriveError(400, "This drive copy belongs to a different library or has an unsupported format.");
      validateDocument(copy.state);
      if (method === "GET") return json({ hash, revision: item.revision, driveRevision: copy.revision, people: copy.state.people.length, trees: copy.state.trees.length, books: copy.state.books.length });
      const data = await readBody();
      if (data.hash !== hash || data.revision !== item.revision) throw new DriveError(409, "A copy changed since you reviewed it. Review the latest copies again.");
      if (!["kinforge", "drive"].includes(data.choice)) throw new DriveError(400, "Choose the KinForge copy or the drive copy.");
      // Retain both the current KinForge snapshot and the external copy before a decision.
      await env.BUCKET.put(`libraries/${item.id}/drive-recovery/${hash}.json`, remote.text);
      if (data.choice === "drive") {
        for (const asset of libraryAssetHashes(copy.state)) if (!await env.BUCKET.head(`libraries/${item.id}/assets/${asset}`)) throw new DriveError(400, "This copy references unfamiliar media. Its original library files must be recovered before restoring it.");
        const key = `libraries/${item.id}/snapshots/${crypto.randomUUID()}.json`;
        await env.BUCKET.put(key, JSON.stringify(sanitizeLibraryVisibility(copy.state)));
        const result = await env.DB.prepare("UPDATE libraries SET revision=revision+1,object_key=?,updated_at=? WHERE id=? AND revision=?").bind(key, Date.now(), item.id, data.revision).run();
        if (result.meta.changes !== 1) throw new DriveError(409, "Another device changed the library. Review both copies again.");
      }
      await env.DB.prepare("UPDATE drive_connections SET manifest_hash=?,status='pending',error=NULL,retry_at=0 WHERE id=?").bind(hash, row.id).run();
      resolved = true;
      return json({ ok: true });
      } finally { if (operation) { await releaseOperation(env, row.id, operation); if (resolved) ctx.waitUntil(syncLibraryDrives(env, item.id)); } }
    }
  }
  if (action === "exports" && method === "GET") return json({ files: (await env.DB.prepare("SELECT id,name,category,mime,size,created_at FROM library_exports WHERE library_id=? ORDER BY created_at DESC LIMIT 500").bind(item.id).all()).results });
  const exportMatch = /^exports\/([a-f0-9-]{36})$/.exec(action);
  if (exportMatch) {
    const id = exportMatch[1];
    if (method === "PUT") {
      const data = await readBody(50 * 1024 * 1024); const file = decodeExport(data.dataUrl); const hash = await sha256(data.dataUrl);
      const existing = await env.DB.prepare("SELECT library_id,hash FROM library_exports WHERE id=?").bind(id).first<any>();
      if (existing && (existing.library_id !== item.id || existing.hash !== hash)) throw new DriveError(409, "This export identifier is already in use.");
      if (!existing) {
        const key = `libraries/${item.id}/exports/${id}/${hash}`; await env.BUCKET.put(key, data.dataUrl);
        await env.DB.prepare("INSERT INTO library_exports (id,library_id,name,category,mime,object_key,hash,size,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id, item.id, safeName(data.name), categories.includes(data.category) ? data.category : "Exports", file.mime, key, hash, file.bytes.length, Date.now()).run();
      }
      ctx.waitUntil(syncLibraryDrives(env, item.id)); return json({ id, saved: true });
    }
    const file = await env.DB.prepare("SELECT * FROM library_exports WHERE id=? AND library_id=?").bind(id, item.id).first<ExportFile>();
    if (!file) throw new DriveError(404, "This saved export is unavailable.");
    if (method === "GET") { const data = await env.BUCKET.get(file.object_key); if (!data) throw new DriveError(404, "This saved export is unavailable."); return json({ name: file.name, dataUrl: await data.text(), category: file.category }); }
    if (method === "DELETE") {
      const connected = (await env.DB.prepare("SELECT * FROM drive_connections WHERE library_id=?").bind(item.id).all<Connection>()).results;
      const operation = randomSecret(), acquired: string[] = [];
      try {
      for (const drive of connected) { await claimOperation(env, drive.id, operation); acquired.push(drive.id); }
      for (const drive of connected) {
        const remote = await fileFor(env, drive, `exports/${id}`); if (remote) {
          const client = await clientFor(env, drive);
          client.beforeWrite = async () => { if (!await env.DB.prepare("SELECT id FROM drive_connections WHERE id=? AND lease=? AND lease_until>?").bind(drive.id, operation, Date.now()).first()) throw new DriveError(409, "The drive connection changed. Retry this deletion."); };
          await client.remove(remote.remote_id); await env.DB.prepare("DELETE FROM drive_files WHERE connection_id=? AND path=?").bind(drive.id, `exports/${id}`).run();
        }
      }
      await env.DB.prepare("DELETE FROM library_exports WHERE id=? AND library_id=?").bind(id, item.id).run(); await env.BUCKET.delete(file.object_key);
      return json({ deleted: true });
      } finally { for (const id of acquired) await releaseOperation(env, id, operation); ctx.waitUntil(syncLibraryDrives(env, item.id)); }
    }
  }
  throw new DriveError(405, "This drive action is not supported.");
}

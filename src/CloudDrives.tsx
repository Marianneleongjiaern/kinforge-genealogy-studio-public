import { useEffect, useRef, useState } from "react";
import { Cloud, Download, ExternalLink, Pause, Play, RefreshCw, Trash2, Unplug, X } from "lucide-react";
import { cloudRequest, type CloudLibrary } from "./cloudApi";
import { downloadBlob } from "./exporters";
import { exportDataUrlBlob } from "./cloudExports";

type Provider = "google" | "onedrive";
type Drive = { provider: Provider; name: string; configured: boolean; connected: boolean; enabled?: number; status?: string; error?: string; last_sync?: number; synced_revision?: number; callbackUrl?: string };
type SavedExport = { id: string; name: string; category: string; mime: string; size: number; created_at: number };
type Review = { provider: Provider; hash: string; revision: number; driveRevision: number; people: number; trees: number; books: number };
const statusLabel: Record<string, string> = { synced: "Up to date", syncing: "Syncing", pending: "Waiting to sync", conflict: "Review needed", error: "Will retry", reconnect: "Reconnect needed" };

export default function CloudDrives({ library, onClose }: { library: CloudLibrary; onClose: () => void }) {
  const [drives, setDrives] = useState<Drive[]>([]), [files, setFiles] = useState<SavedExport[]>([]);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [setup, setSetup] = useState<Provider | null>(null);
  const [review, setReview] = useState<Review | null>(null); const [confirm, setConfirm] = useState<{ kind: "disconnect" | "delete"; id: string; name: string } | null>(null);
  const dialog = useRef<HTMLElement>(null);
  async function refresh() {
    const [connections, exports] = await Promise.all([cloudRequest<{ providers: Drive[] }>(`/api/libraries/${library.id}/drives`), cloudRequest<{ files: SavedExport[] }>(`/api/libraries/${library.id}/exports`)]);
    setDrives(connections.providers); setFiles(exports.files);
  }
  useEffect(() => {
    void refresh().catch(error => setMessage(error.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 5000);
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)')].filter(el => el.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { clearInterval(timer); document.removeEventListener("keydown", key); previous?.focus(); };
  }, [library.id]);
  async function act(work: () => Promise<void>) { setBusy(true); setMessage(""); try { await work(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Please retry."); } finally { setBusy(false); } }
  async function connect(drive: Drive) {
    if (!drive.configured) { setSetup(drive.provider); return; }
    // Reserve a tab while still in the click event so Safari permits the sign-in window.
    const popup = window.kinforgeNative ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    await act(async () => {
      try {
        const result = await cloudRequest<{ url: string }>(`/api/libraries/${library.id}/drives/${drive.provider}/connect`, "POST", {});
        if (window.kinforgeNative?.openDriveAuth) await window.kinforgeNative.openDriveAuth(result.url);
        else if (window.kinforgeNative) throw new Error("Install the latest KinForge desktop app to connect a drive.");
        else if (popup) popup.location.replace(result.url);
        else window.location.assign(result.url);
        setMessage(`Finish signing in to ${drive.name} in the browser. This panel will update when you return.`);
      } catch (error) { popup?.close(); throw error; }
    });
  }
  return <div className="cloud-scrim"><section ref={dialog} className="cloud-dialog wide drive-dialog" role="dialog" aria-modal="true" aria-labelledby="drive-title">
    <button className="cloud-close" aria-label="Close cloud drives" onClick={onClose}><X size={20} /></button>
    <h2 id="drive-title">Cloud drives</h2>
    <p>{library.name}</p>
    <p className="quiet">Connected drives receive your full private library: trees, books, collections, subcollections, media, and report drafts. Downloaded reports and backups are also saved. Copies in a drive follow that drive's sharing settings.</p>
    {!drives.length && !message && <p role="status">Loading drive connections...</p>}
    {drives.map(drive => <section className="drive-provider" key={drive.provider} aria-label={drive.name}>
      <div className="drive-heading"><Cloud size={22} /><h3>{drive.name}</h3><span className={`drive-state ${drive.status === "synced" ? "ready" : ""}`}>{!drive.configured ? "Setup needed" : !drive.connected ? "Not connected" : !drive.enabled ? "Paused" : statusLabel[drive.status || "pending"] || "Waiting to sync"}</span></div>
      {drive.error && <p role="status">{drive.error}</p>}
      {drive.last_sync && <p className="quiet">Last synced {new Date(drive.last_sync).toLocaleString()}</p>}
      <div className="button-row">
        {(!drive.connected || drive.status === "reconnect") && <button className="button secondary" disabled={busy} onClick={() => void connect(drive)}><ExternalLink size={16} />{!drive.configured ? "View setup requirements" : drive.connected ? "Reconnect" : `Connect ${drive.name}`}</button>}
        {drive.connected && <><button className="button secondary" disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${library.id}/drives/${drive.provider}`, "POST", { enabled: !drive.enabled }); })}>{drive.enabled ? <Pause size={16} /> : <Play size={16} />}{drive.enabled ? "Pause" : "Resume"}</button><button className="button ghost" disabled={busy} onClick={() => setConfirm({ kind: "disconnect", id: drive.provider, name: drive.name })}><Unplug size={16} />Disconnect</button></>}
        {drive.status === "conflict" && <button className="button" disabled={busy} onClick={() => void act(async () => { const data = await cloudRequest<Omit<Review, "provider">>(`/api/libraries/${library.id}/drives/${drive.provider}/resolve`); setReview({ ...data, provider: drive.provider }); })}>Review copies</button>}
      </div>
      {setup === drive.provider && <div className="drive-setup"><p>The app owner needs to register KinForge with {drive.name === "OneDrive" ? "Microsoft" : "Google"} and configure its connection keys. After that, each person signs in to their own drive.</p><p>Access is limited to KinForge-created files in Google Drive, or KinForge's app folder in OneDrive.</p><a href={drive.provider === "google" ? "https://console.cloud.google.com/auth/clients" : "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"} target="_blank" rel="noopener noreferrer">{drive.provider === "google" ? "Google app registration" : "Microsoft app registration"}<ExternalLink size={14} /></a>{drive.callbackUrl && <label className="field"><span>Return address for app registration</span><input className="control" value={drive.callbackUrl} readOnly onFocus={e => e.currentTarget.select()} /></label>}</div>}
    </section>)}
    {review && <section className="drive-review"><h3>Choose the library copy</h3><p>The drive copy contains {review.trees} trees, {review.people} people and {review.books} books. Restoring replaces the current library; existing KinForge snapshots are retained for recovery.</p><div className="button-row">{(["kinforge", "drive"] as const).map(choice => <button key={choice} className={`button ${choice === "drive" ? "secondary" : ""}`} disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${library.id}/drives/${review.provider}/resolve`, "POST", { hash: review.hash, revision: review.revision, choice }); setReview(null); setMessage(choice === "drive" ? "The drive copy was restored. Your tree will refresh automatically." : "The KinForge copy was selected. Drive sync will resume."); })}>{choice === "kinforge" ? "Keep current KinForge library" : "Restore drive library"}</button>)}<button className="button ghost" onClick={() => setReview(null)}>Cancel</button></div></section>}
    <div className="drive-heading"><h3>Saved exports</h3><button className="button secondary" disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${library.id}/drives/sync`, "POST", {}); setMessage("Drive sync queued. Larger libraries continue syncing while KinForge is open."); })}><RefreshCw size={16} />Sync now</button></div>
    {!files.length && <p className="quiet">Your downloaded reports, charts and backups will appear here.</p>}
    <div className="drive-exports">{files.map(file => <div className="cloud-member" key={file.id}><span><strong>{file.name}</strong><small>{file.category} · {Math.max(1, Math.round(file.size / 1024))} KB · {new Date(file.created_at).toLocaleDateString()}</small></span><div className="drive-file-actions"><button title={`Download ${file.name}`} aria-label={`Download ${file.name}`} disabled={busy} onClick={() => void act(async () => { const data = await cloudRequest<{ name: string; dataUrl: string }>(`/api/libraries/${library.id}/exports/${file.id}`); const blob = exportDataUrlBlob(data.dataUrl); await downloadBlob(data.name, blob, file.mime, undefined, { localOnly: true }); })}><Download size={17} /></button><button title={`Delete ${file.name}`} aria-label={`Delete ${file.name}`} disabled={busy} onClick={() => setConfirm({ kind: "delete", id: file.id, name: file.name })}><Trash2 size={17} /></button></div></div>)}</div>
    {confirm && <div className="drive-review" role="alert"><p>{confirm.kind === "disconnect" ? `Disconnect ${confirm.name}? Existing drive files will remain there.` : `Delete ${confirm.name} from the cloud library and connected drives? Local downloads will remain on your devices.`}</p><div className="button-row"><button className="button" disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${library.id}/${confirm.kind === "disconnect" ? "drives" : "exports"}/${confirm.id}`, "DELETE"); setConfirm(null); })}>Confirm {confirm.kind === "disconnect" ? "disconnect" : "deletion"}</button><button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></div>}
    {message && <p role="status" className="drive-message">{message}</p>}
  </section></div>;
}

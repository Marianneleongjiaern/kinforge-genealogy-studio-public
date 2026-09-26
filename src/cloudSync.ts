import { AppState, createSeedState } from "./domain";
import { hydrateLibrary } from "./libraryState";
import { readLibraryPreview } from "./cloudPreview";
import { CachedLibrary, readCache, writeCache } from "./cloudCache";
import { CloudError, CloudLibrary, CloudUser, cloudRequest, decodeCloudAssets, encodeCloudAssets } from "./cloudApi";
import { ConflictChoices, SyncConflict, mergeCloudState, mergeDeviceLibrary } from "./cloudMerge";

export type SyncView = { state: AppState; status: string; error: string; conflicts: SyncConflict[]; dirty: boolean; lastSaved: number | null; locked: boolean; preview?: boolean };
const LEGACY_KEY = "kinforge-genealogy-studio-v1";
const MIGRATED_KEY = "kinforge-cloud-device-owner-v1";
export function emptyCloudLibrary(): AppState {
  const state = createSeedState();
  for (const key of Object.keys(state) as (keyof AppState)[]) if (Array.isArray(state[key])) (state as any)[key] = [];
  const bookId = `book_${crypto.randomUUID()}`, treeId = `tree_${crypto.randomUUID()}`;
  state.books = [{ id: bookId, title: "My genealogy book", description: "" }];
  state.trees = [{ ...createSeedState().trees[0], id: treeId, bookId, collectionId: undefined, title: "My relationship tree", author: "", authorContact: "" }];
  return state;
}
export class CloudSync {
  private cache!: CachedLibrary;
  private stopped = false;
  private busy = false;
  private again = false;
  private timer?: ReturnType<typeof setTimeout>;
  private writes = Promise.resolve();
  private conflictBase?: { base: AppState; local: AppState; remote: AppState };
  private view!: SyncView;
  private releaseLock?: () => void;
  private lockReady = false;
  private startReady = false;
  private privacyRejectedDraft?: AppState;
  constructor(public user: CloudUser, public library: CloudLibrary, private onUpdate: (view: SyncView) => void) {}
  private show(change: Partial<SyncView>) {
    this.view = { ...this.view, ...change, state: this.cache.draft, dirty: this.cache.dirty };
    if (!this.stopped) this.onUpdate(this.view);
  }
  private persist() {
    const snapshot = structuredClone(this.cache);
    this.writes = this.writes.catch(() => undefined).then(() => writeCache(this.user.id, this.library.id, snapshot));
    this.writes.catch(() => this.show({ error: "Device storage is full or unavailable. Keep this window open until cloud sync completes, or download a backup." }));
    return this.writes;
  }
  private async acquireLock() {
    if (!navigator.locks) return;
    await new Promise<void>((resolve, reject) => {
      void navigator.locks.request(`kinforge-library-${this.user.id}-${this.library.id}`, { ifAvailable: true }, async lock => {
        if (this.stopped) { resolve(); return; }
        if (!lock) { reject(new Error("This library is open in another tab on this device. Close that tab, then select Retry.")); return; }
        await new Promise<void>(release => { this.releaseLock = release; resolve(); });
      }).catch(reject);
    });
  }
  async start() {
    const preview = readLibraryPreview(this.user.id, this.library.id);
    if (preview) {
      const state = hydrateLibrary(preview);
      this.cache = { base: null, draft: state, revision: -1, dirty: false };
      this.view = { state, status: "Opening saved library", error: "", conflicts: [], dirty: false, lastSaved: null, locked: true, preview: true };
      this.onUpdate(this.view);
    }
    performance.mark?.("kinforge-cache-read-start");
    let cached: CachedLibrary | undefined;
    try { cached = await readCache(this.user.id, this.library.id); } catch { /* The cloud remains authoritative if device storage is unavailable. */ }
    performance.mark?.("kinforge-cache-read-end");
    if (cached && !this.stopped) {
      const base = cached.base ? hydrateLibrary(cached.base) : null;
      const draft = hydrateLibrary(cached.draft);
      cached = { ...cached, base, draft };
      this.cache = { ...cached, base, draft };
      this.view = { state: draft, status: "Checking cloud connection", error: "", conflicts: [], dirty: this.cache.dirty, lastSaved: null, locked: true };
      this.onUpdate(this.view);
      performance.mark?.("kinforge-cache-ready");
    }
    const openingDraft = this.cache?.draft;
    const openingDirty = this.cache?.dirty;
    let lockFailure = "";
    const lock = this.acquireLock().then(() => {
      if (this.stopped) return;
      this.lockReady = true;
      if (this.startReady && this.cache && this.view) {
        this.show({ error: "", locked: false });
        void this.sync();
      }
    }).catch(error => {
      lockFailure = error instanceof Error ? error.message : "Cloud access is waiting for another open tab.";
      if (!this.stopped && this.view) this.show({ status: "Cloud access needs attention", error: lockFailure });
    });
    // A verified matching revision needs no full document or media download.
    // A dirty cache can retain a pre-conflict base even at the newest revision.
    const suffix = cached?.base && !cached.dirty ? `?since=${cached.revision}` : "";
    const data = await cloudRequest<{ unchanged?: boolean; state: AppState | null; revision: number; updatedAt?: number }>(`/api/libraries/${this.library.id}${suffix}`);
    performance.mark?.("kinforge-cloud-checked");
    const remote = data.unchanged && cached?.base ? cached.base : data.state ? hydrateLibrary(await decodeCloudAssets(this.library.id, data.state)) : null;
    if (this.stopped) return;
    const pendingLocal = Boolean(this.cache && (this.cache.draft !== openingDraft || this.cache.dirty !== openingDirty));
    const draft = pendingLocal ? this.cache.draft : cached?.draft || remote || emptyCloudLibrary();
    this.cache = { base: remote, draft, revision: data.revision, dirty: pendingLocal ? this.cache.dirty : cached?.dirty || !remote };
    this.view = { state: draft, status: "Connecting", error: "", conflicts: [], dirty: this.cache.dirty, lastSaved: data.updatedAt || null, locked: !this.lockReady };
    if (cached && (cached.dirty || pendingLocal) && remote) this.combine(cached.base || emptyBase(remote), this.cache.draft, remote);
    else if (remote && !cached?.dirty && !pendingLocal) this.cache.draft = remote;
    if (this.library.role === "owner") {
      const owner = localStorage.getItem(MIGRATED_KEY);
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (!owner && legacy) {
        let device: AppState;
        try { device = JSON.parse(legacy); if (!Array.isArray(device.people) || !Array.isArray(device.trees)) throw new Error(); }
        catch { throw new Error("The previous device library could not be read. It has been kept untouched."); }
        // Bind the previous device library once; a different login must never claim it again.
        const next = hydrateLibrary(device);
        if (!remote) { this.cache.draft = next; this.cache.dirty = true; }
        else { const merged = mergeDeviceLibrary(next, this.cache.draft); this.cache.draft = merged.state; this.cache.dirty = true; if (merged.conflicts.length) { this.cache.base = emptyBase(remote); this.conflictBase = { base: emptyBase(remote), local: next, remote }; this.view.conflicts = merged.conflicts; } }
        await this.persist();
        localStorage.setItem(MIGRATED_KEY, this.user.id);
      }
    }
    if (this.library.role === "viewer") this.cache = { base: remote, draft: remote || draft, revision: data.revision, dirty: false };
    void this.persist();
    this.startReady = true;
    if (lockFailure) this.show({ status: "Cloud access needs attention", error: lockFailure });
    else if (this.lockReady) {
      this.show({ status: this.view.conflicts.length ? "Review conflicting changes" : this.cache.dirty ? "Saving to cloud" : "Synced", error: "", locked: false });
      this.schedule(this.cache.dirty ? 0 : 5000);
    } else this.show({ status: "Waiting for library access", error: "", locked: true });
    void lock;
  }
  change(state: AppState) {
    if (this.stopped || this.library.role === "viewer" || this.view.locked || this.view.conflicts.length || state === this.cache.draft) return;
    this.cache.draft = state; this.cache.dirty = true;
    this.privacyRejectedDraft = undefined;
    void this.persist(); this.show({ status: "Saving to cloud", error: "" }); this.schedule(700);
  }
  private combine(base: AppState, local: AppState, remote: AppState) {
    const merged = mergeCloudState(base, local, remote);
    this.cache.draft = merged.state; this.cache.base = merged.conflicts.length ? base : remote;
    this.cache.dirty = JSON.stringify(merged.state) !== JSON.stringify(remote);
    this.view.conflicts = merged.conflicts;
    this.conflictBase = merged.conflicts.length ? { base, local, remote } : undefined;
  }
  async resolve(choices: ConflictChoices) {
    if (!this.conflictBase) return;
    const { base, local, remote } = this.conflictBase; const merged = mergeCloudState(base, local, remote, choices);
    if (merged.conflicts.length) throw new Error("Choose a value for every conflicting change.");
    this.cache.draft = merged.state; this.cache.base = remote; this.cache.dirty = true; this.conflictBase = undefined;
    this.show({ conflicts: [], error: "", status: "Saving resolved changes" }); await this.persist(); this.schedule(0);
  }
  private schedule(ms = 5000) { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => void this.sync(false), ms); }
  async sync(retryReview = true) {
    if (this.stopped || !this.startReady || !this.lockReady || !this.cache || this.view?.conflicts.length) return;
    // Keep the rejected draft and Undo usable; retry it only after an edit or explicit Retry.
    if (!retryReview && this.privacyRejectedDraft === this.cache.draft) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    let sent: AppState | undefined;
    try {
      const data = await cloudRequest<{ unchanged?: boolean; state: AppState | null; revision: number; updatedAt: number }>(`/api/libraries/${this.library.id}?since=${this.cache.revision}`);
      if (this.stopped) return;
      if (!data.unchanged) {
        const remote = data.state ? hydrateLibrary(await decodeCloudAssets(this.library.id, data.state)) : emptyCloudLibrary();
        if (this.stopped) return;
        this.combine(this.cache.base || emptyBase(remote), this.cache.draft, remote); this.cache.revision = data.revision;
        await this.persist(); this.show({ status: this.view.conflicts.length ? "Review conflicting changes" : "Synced", lastSaved: data.updatedAt, error: "", locked: false });
        if (this.view.conflicts.length) return;
      }
      if (this.cache.dirty && this.library.role !== "viewer") {
        this.show({ status: "Saving to cloud", error: "" });
        sent = this.cache.draft;
        const encoded = await encodeCloudAssets(this.library.id, sent);
        if (this.stopped) return;
        const result = await cloudRequest<{ revision: number; updatedAt: number }>(`/api/libraries/${this.library.id}`, "PUT", { revision: this.cache.revision, state: encoded });
        this.cache.base = sent; this.cache.revision = result.revision;
        this.privacyRejectedDraft = undefined;
        this.cache.dirty = this.cache.draft !== sent;
        await this.persist(); this.show({ lastSaved: result.updatedAt, status: this.cache.dirty ? "Saving to cloud" : "Synced", error: "", locked: false });
        if (this.cache.dirty) this.again = true;
      } else this.show({ status: "Synced", error: "", locked: false });
    } catch (error) {
      if (error instanceof CloudError && error.status === 409) { this.again = true; this.show({ status: "Merging changes from another device" }); }
      else if (error instanceof CloudError && error.status === 403 && error.code === "LIBRARY_PRIVACY_REVIEW" && sent) {
        this.privacyRejectedDraft = sent;
        const changed = this.cache.draft !== sent;
        this.again = changed;
        this.show({ status: changed ? "Saving to cloud" : "Changes need review", locked: false, error: changed ? "" : error.message });
        await this.persist();
      }
      else {
        const locked = error instanceof CloudError && [401, 403, 404].includes(error.status);
        this.show({ status: locked ? "Sign-in or access needs attention" : "Waiting for connection", locked, error: error instanceof Error ? error.message : "Cloud sync is unavailable. Your changes are kept on this device." });
      }
    } finally { this.busy = false; this.schedule(this.again ? 400 : 5000); this.again = false; }
  }
  async stop() {
    this.stopped = true; this.lockReady = false; this.startReady = false; clearTimeout(this.timer);
    const release = this.releaseLock; this.releaseLock = undefined; release?.();
    await this.writes.catch(() => undefined);
  }
}
function emptyBase(state: AppState): AppState { return Object.fromEntries(Object.entries(state).map(([k, v]) => [k, Array.isArray(v) ? [] : {}])) as AppState; }

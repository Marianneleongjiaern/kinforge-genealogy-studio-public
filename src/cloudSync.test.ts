import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedState } from "./domain";
import { CloudSync, type SyncView } from "./cloudSync";
import { readCache, writeCache } from "./cloudCache";
import { cloudRequest, decodeCloudAssets, CloudError } from "./cloudApi";
import { writeLibraryPreview } from "./cloudPreview";
vi.mock("./cloudCache", () => ({ readCache: vi.fn(), writeCache: vi.fn() }));
vi.mock("./cloudApi", async importOriginal => ({ ...await importOriginal<object>(), cloudRequest: vi.fn(), decodeCloudAssets: vi.fn(async (_id, state) => state) }));
const user = { id: "test-owner", email: "owner@example.test", name: "Owner" };
const library = { id: "test-library", name: "Family", owner_email: user.email, role: "owner" as const, revision: 8 };
let controller: CloudSync;
let views: SyncView[];
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); localStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  vi.mocked(writeCache).mockResolvedValue(undefined);
  views = []; controller = new CloudSync(user, library, view => views.push(view));
});
afterEach(async () => { await controller.stop(); vi.useRealTimers(); });
const latest = () => views.at(-1)!;

describe("returning-user startup", () => {
  it("shows an account-scoped preview while the full device database is delayed", async () => {
    const state = createSeedState(); writeLibraryPreview(user.id, library.id, state);
    let finish!: (value: any) => void;
    vi.mocked(readCache).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(cloudRequest).mockResolvedValue({ unchanged: true, revision: 8 });
    const pending = controller.start();
    expect(latest().status).toBe("Opening saved library");
    expect(latest().state.people).toHaveLength(4); expect(latest().locked).toBe(true);
    await controller.sync(); expect(cloudRequest).not.toHaveBeenCalled();
    finish({ base: state, draft: state, revision: 8, dirty: false }); await pending;
    expect(latest().status).toBe("Synced");
    expect(latest().state.media[0].dataUrl).toBe(state.media[0].dataUrl);
  });
  it("renders an upgraded older cache while its remote revision is delayed", async () => {
    const old = createSeedState(); delete (old as any).customFactTerms;
    vi.mocked(readCache).mockResolvedValue({ base: old, draft: old, revision: 8, dirty: false });
    let finish!: (value: any) => void;
    vi.mocked(cloudRequest).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = controller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(latest().state.customFactTerms).toEqual([]);
    expect(latest().state.people).toHaveLength(4);
    expect(latest().locked).toBe(true);
    controller.change({ ...latest().state, people: [] });
    expect(latest().state.people).toHaveLength(4);
    finish({ unchanged: true, revision: 8 }); await pending;
    expect(latest().status).toBe("Synced"); expect(latest().locked).toBe(false);
    expect(decodeCloudAssets).not.toHaveBeenCalled();
    expect(cloudRequest).toHaveBeenCalledTimes(1);
    expect(cloudRequest).toHaveBeenCalledWith("/api/libraries/test-library?since=8");
    expect((old as any).customFactTerms).toBeUndefined();
  });
  it("upgrades an older remote library on a device without a cache", async () => {
    const old = createSeedState(); delete (old as any).customFactTerms;
    vi.mocked(readCache).mockResolvedValue(undefined);
    vi.mocked(cloudRequest).mockResolvedValue({ state: old, revision: 8 });
    await controller.start();
    expect(latest().state.customFactTerms).toEqual([]);
    expect(latest().state.people).toHaveLength(4);
    expect(latest().locked).toBe(false);
    expect(cloudRequest).toHaveBeenCalledTimes(1);
    expect(cloudRequest).toHaveBeenCalledWith("/api/libraries/test-library");
  });
  it("keeps the cached library read-only when another window holds its editing lock", async () => {
    const state = createSeedState();
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, callback: any) => callback(null) } });
    vi.mocked(readCache).mockResolvedValue({ base: state, draft: state, revision: 8, dirty: false });
    vi.mocked(cloudRequest).mockResolvedValue({ unchanged: true, revision: 8 });
    await controller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(latest().error).toContain("another tab"); expect(latest().locked).toBe(true);
    controller.change({ ...latest().state, people: [] }); expect(latest().state.people).toHaveLength(4);
  });
  it("never uploads a cached draft before remote access is verified", async () => {
    const state = createSeedState();
    vi.mocked(readCache).mockResolvedValue({ base: state, draft: state, revision: 8, dirty: true });
    vi.mocked(cloudRequest).mockRejectedValue(new CloudError(403, "Access revoked"));
    await expect(controller.start()).rejects.toThrow("Access revoked");
    await controller.sync();
    expect(latest().locked).toBe(true); expect(cloudRequest).toHaveBeenCalledTimes(1);
  });
  it("does not wait for disk persistence before showing a verified library", async () => {
    const state = createSeedState();
    vi.mocked(readCache).mockResolvedValue({ base: state, draft: state, revision: 8, dirty: false });
    vi.mocked(cloudRequest).mockResolvedValue({ unchanged: true, revision: 8 });
    let finish!: () => void;
    vi.mocked(writeCache).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await controller.start(); await vi.advanceTimersByTimeAsync(0);
    expect(latest().status).toBe("Synced"); expect(latest().locked).toBe(false);
    finish();
  });
  it("refetches a dirty conflict cache even when its revision matches the server", async () => {
    const base = createSeedState(), draft = structuredClone(base), remote = structuredClone(base);
    draft.people[0].givenName = "Local choice"; remote.people[0].givenName = "Remote choice";
    vi.mocked(readCache).mockResolvedValue({ base, draft, revision: 8, dirty: true });
    vi.mocked(cloudRequest).mockResolvedValue({ state: remote, revision: 8 });
    await controller.start();
    expect(cloudRequest).toHaveBeenCalledWith("/api/libraries/test-library");
    expect(latest().conflicts.length).toBeGreaterThan(0);
    expect(latest().state.people[0].givenName).toBe("Local choice");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./exporters";
import { hasNativeStorage, saveBlobToNative } from "./nativeStorage";
import { captureExportContext, registerExportCapture } from "./exportCapture";

vi.mock("jspdf", () => ({ default: vi.fn() }));
vi.mock("./nativeStorage", () => ({ hasNativeStorage: vi.fn(), saveBlobToNative: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.mocked(hasNativeStorage).mockReturnValue(false);
  vi.mocked(saveBlobToNative).mockResolvedValue(null);
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => "blob:synthetic-export"),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("download result contract", () => {
  it.each([false, true])("captures one export for browser/native=%s", async native => {
    vi.mocked(hasNativeStorage).mockReturnValue(native);
    const capture = vi.fn().mockResolvedValue(undefined); const stop = registerExportCapture(capture);
    try {
      await downloadBlob("report.pdf", "report bytes", "application/pdf", "Reports");
      expect(capture).toHaveBeenCalledOnce(); expect(capture.mock.calls[0][0]).toBe("report.pdf");
      expect(capture.mock.calls[0][1].type).toBe("application/pdf"); expect(capture.mock.calls[0][2]).toBe("Reports");
    } finally { stop(); }
  });
  it("keeps recovery details local and preserves the initiating account across delayed generation", async () => {
    const first = vi.fn().mockResolvedValue(undefined), second = vi.fn().mockResolvedValue(undefined);
    const stopFirst = registerExportCapture(first); const bound = captureExportContext(); stopFirst();
    const stopSecond = registerExportCapture(second);
    try {
      await downloadBlob("recovery.txt", "synthetic secret", "text/plain", undefined, { localOnly: true });
      expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
      await downloadBlob("report.pdf", "first account", "application/pdf", "Reports", { capture: bound });
      expect(first).toHaveBeenCalledOnce(); expect(second).not.toHaveBeenCalled();
      await downloadBlob("guest.pdf", "guest", "application/pdf", undefined, { capture: null });
      expect(second).not.toHaveBeenCalled();
    } finally { stopSecond(); }
  });
  it("still downloads locally when cloud queue storage fails", async () => {
    const stop = registerExportCapture(vi.fn().mockRejectedValue(new Error("Full device")));
    try { expect(await downloadBlob("report.pdf", "bytes")).toEqual({ status: "browser-initiated" }); } finally { stop(); }
  });
  it("reports browser initiation without claiming a saved path", async () => {
    const result = await downloadBlob("synthetic.txt", "Synthetic non-credential content");
    expect(result).toEqual({ status: "browser-initiated" });
    expect(saveBlobToNative).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("returns the confirmed native path without starting a browser download", async () => {
    vi.mocked(hasNativeStorage).mockReturnValue(true);
    vi.mocked(saveBlobToNative).mockResolvedValue({ ok: true, path: "/synthetic-downloads/synthetic.txt", category: "Exports" });

    const result = await downloadBlob("synthetic.txt", "Synthetic non-credential content");
    expect(result).toEqual({ status: "native-saved", path: "/synthetic-downloads/synthetic.txt" });
    expect(saveBlobToNative).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it.each(["not-ok", "rejected"])("reports only browser initiation when native storage is %s", async failure => {
    vi.mocked(hasNativeStorage).mockReturnValue(true);
    if (failure === "rejected") vi.mocked(saveBlobToNative).mockRejectedValue(new Error("Synthetic save failure"));
    else vi.mocked(saveBlobToNative).mockResolvedValue({ ok: false, path: "/synthetic-downloads/not-saved.txt", category: "Exports" });

    const result = await downloadBlob("synthetic.txt", "Synthetic non-credential content");
    expect(result).toEqual({ status: "browser-initiated" });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });
});

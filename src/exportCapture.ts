import type { NativeStorageCategory } from "./nativeStorage";

export type ExportCapture = (fileName: string, blob: Blob, category?: NativeStorageCategory) => Promise<void>;
let activeCapture: ExportCapture | null = null;
export const captureExportContext = () => activeCapture;
export function registerExportCapture(capture: ExportCapture) {
  activeCapture = capture;
  return () => { if (activeCapture === capture) activeCapture = null; };
}

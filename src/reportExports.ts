import { downloadBlob } from "./exporters";
import type { ReportPresentation } from "./reportOptions";
import { buildFormattedPdf } from "./reportPdf";
import { formattedRtf, prepareRtfImages } from "./reportPdfRtf";
import { captureExportContext } from "./exportCapture";

export { formattedRtf } from "./reportPdfRtf";

export async function exportFormattedPdf(element: HTMLElement, format: "a4" | "letter", presentation?: ReportPresentation, fillable = false) {
  const capture = captureExportContext();
  const pdf = await buildFormattedPdf(element, format, presentation, fillable);
  await downloadBlob(fillable ? "KinForge-report-fillable.pdf" : "KinForge-report.pdf", pdf.output("blob"), "application/pdf", "Reports", { capture });
}

export async function exportFormattedRtf(html: string, presentation?: ReportPresentation) {
  const capture = captureExportContext();
  const { html: localHtml, crest } = await prepareRtfImages(html, presentation?.crest);
  await downloadBlob("KinForge-report.rtf", formattedRtf(localHtml, { ...presentation, crest }), "application/rtf", "Reports", { capture });
}

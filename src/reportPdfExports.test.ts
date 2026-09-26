import { describe, expect, it } from "vitest";
import { formattedRtf } from "./reportExports";
import { paginatePdf, preparePdfClone, reportPageGeometry } from "./reportPdfLayout";
import { pdfUnicode } from "./reportPdfText";

describe("report export contracts", () => {
  it("uses point margins, real landscape dimensions, and space for running furniture", () => {
    const page = reportPageGeometry("letter", { orientation: "landscape", margin: 36, header: "Family", footer: "Archive", pageNumbers: true });
    expect(page).toEqual({ width: 792, height: 612, margin: 36, top: 76, contentWidth: 720, contentHeight: 474 });
    expect(reportPageGeometry("a4").margin).toBe(21);
    expect(reportPageGeometry("a4", { margin: NaN }).margin).toBe(21);
    expect(reportPageGeometry("a4", { header: "Header\n".repeat(8), footer: "Archive ".repeat(80) }).contentHeight).toBeLessThan(600);
  });
  it("strips active and external content before attaching an export clone", () => {
    const element = document.createElement("div");
    element.innerHTML = '<p onclick="alert(1)" style="background-image:url(https://example.test/a)">Family</p><img src="https://example.test/private" srcset="https://example.test/private2 2x" alt="Family portrait"><iframe src="https://example.test/frame"></iframe><div data-report-page-break="true">Page break</div>';
    const clone = preparePdfClone(element, 600, 900, { theme: "forest" }, true);
    expect(clone.innerHTML).not.toMatch(/https:|onclick|iframe|Page break/);
    expect(clone.textContent).toContain("Family portrait");
    expect(element.innerHTML).toContain("https://example.test/private");
  });
  it("rejects excessive page furniture and invalid pagination heights without looping", () => {
    expect(() => reportPageGeometry("a4", { header: "Large heading\n".repeat(200) })).toThrow(/Shorten the header or footer/);
    for (const height of [0, -1, Infinity, NaN]) expect(() => paginatePdf(document.createElement("div"), height, false)).toThrow(/positive finite/);
  });
  it("encodes exact canonical PDF values including non-BMP characters", () => {
    expect(pdfUnicode("\u00c9\u5f20\ud83c\udf33")).toBe("FEFF00c95f20d83cdf33");
  });
  it("keeps the old RTF API while adding margins, orientation, page breaks and Unicode", () => {
    expect(formattedRtf("<p>Family</p>")).toContain("Family");
    const rtf = formattedRtf('<h2>Names</h2><div data-report-page-break="true"></div><p style="font-family:Georgia;font-size:18pt;color:#123456">\u00c9lodie \u5f20\u4f1f</p><p data-page-break-before="true">Next</p>', { orientation: "landscape", margin: 36, theme: "forest", header: "Family archive", footer: "Reviewed", pageNumbers: true });
    expect(rtf).toContain("\\landscape"); expect(rtf).toContain("\\margl720");
    expect(rtf.match(/\\page\n/g)).toHaveLength(2);
    expect(rtf).toContain("\\u24352?"); expect(rtf).toContain("\\u20255?");
    expect(rtf).toContain("\\header"); expect(rtf).toContain("Family archive");
    expect(rtf).toContain("\\fldinst PAGE"); expect(rtf).toContain("\\fldinst NUMPAGES");
    expect(rtf).toContain("\\f1 \\fs36"); expect(rtf).toContain("\\red230\\green239\\blue232");
  });
  it("writes actual RTF table cells and omits disabled background decoration", () => {
    const rtf = formattedRtf('<h2>Family</h2><table><thead><tr><th>Name</th><th>Birth</th></tr></thead><tbody><tr><td>Ana</td><td>1900</td></tr></tbody></table>', { printBackground: false, watermark: "DRAFT" });
    expect(rtf).toContain("\\trowd"); expect(rtf).toContain("\\trhdr");
    expect(rtf.match(/\\cellx/g)).toHaveLength(4); expect(rtf).not.toContain("\\cbpat2"); expect(rtf).not.toContain("DRAFT");
  });
});

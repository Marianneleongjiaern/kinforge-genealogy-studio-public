import jsPDF from "jspdf";
import { AppState, emptyDeathDetails, fullName, Person } from "./domain";
import { hasNativeStorage, saveBlobToNative, type NativeStorageCategory } from "./nativeStorage";
import { captureExportContext, type ExportCapture } from "./exportCapture";

export type DownloadResult =
  | { status: "native-saved"; path?: string }
  | { status: "browser-initiated" };

export const COPYRIGHT_NOTICE = "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.";
const COPYRIGHT_HTML = `<footer class="kinforge-export-copyright">${COPYRIGHT_NOTICE}</footer>`;

const hasCopyright = (value: string) => value.includes(COPYRIGHT_NOTICE);
const withTextCopyright = (body: string) => hasCopyright(body) ? body : `${body.replace(/\s+$/g, "")}\n\n${COPYRIGHT_NOTICE}\n`;
const withHtmlCopyright = (html: string) => {
  if (hasCopyright(html)) return html;
  const footer = `\n${COPYRIGHT_HTML}\n`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}${footer}`;
};

const browserDownload = (fileName: string, blob: Blob): DownloadResult => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  const cleanup = () => { link.remove(); URL.revokeObjectURL(url); };
  try {
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    cleanup();
    throw error;
  }
  // Embedded browsers can consume the URL after the click handler has returned.
  window.setTimeout(cleanup, 60_000);
  return { status: "browser-initiated" };
};

export const downloadBlob = async (fileName: string, content: BlobPart, type = "text/plain;charset=utf-8", category?: NativeStorageCategory, options: { localOnly?: boolean; capture?: ExportCapture | null } = {}): Promise<DownloadResult> => {
  const shouldMarkHtml = typeof content === "string" && /text\/html/i.test(type);
  const finalContent = shouldMarkHtml ? withHtmlCopyright(content) : content;
  const blob = finalContent instanceof Blob ? finalContent : new Blob([finalContent], { type });
  const capture = options.capture === undefined ? captureExportContext() : options.capture;
  if (!options.localOnly && capture) void capture(fileName, blob, category).catch(() => {
    window.dispatchEvent(new CustomEvent("kinforge-export-status", { detail: "The local download is ready, but this device could not queue its cloud copy. Free device storage and export again." }));
  });
  if (!hasNativeStorage()) {
    return browserDownload(fileName, blob);
  }
  try {
    const saved = await saveBlobToNative(fileName, blob, category, type);
    if (saved?.ok) return { status: "native-saved", path: saved.path || undefined };
  } catch {
    // Fall back to the normal browser download path if the native bridge is unavailable or interrupted.
  }
  return browserDownload(fileName, blob);
};

export const exportText = (fileName: string, body: string) => downloadBlob(fileName, /\.ged$/i.test(fileName) ? body : withTextCopyright(body));

export const exportRtf = (fileName: string, body: string) => {
  const escaped = withTextCopyright(body).replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}").replace(/\n/g, "\\par\n");
  downloadBlob(fileName, `{\\rtf1\\ansi\\deff0\n${escaped}\n}`, "application/rtf");
};

export const exportCsv = (fileName: string, rows: string[][]) => {
  const csvRows = [...rows, [], ["Copyright", COPYRIGHT_NOTICE]];
  const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(fileName, csv, "text/csv;charset=utf-8");
};

export const exportPdf = (fileName: string, title: string, body: string) => {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  let y = 48;
  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.text(title, 48, y);
  y += 28;
  pdf.setFont("times", "normal");
  pdf.setFontSize(10);
  const lines = pdf.splitTextToSize(body, 516);
  lines.forEach((line: string) => {
    if (y > 740) {
      pdf.addPage();
      y = 48;
    }
    pdf.text(line, 48, y);
    y += 14;
  });
  pdf.setFont("times", "normal");
  pdf.setFontSize(8);
  pdf.text(COPYRIGHT_NOTICE, 48, 764);
  void downloadBlob(fileName, pdf.output("blob"), "application/pdf");
};

export const buildWebsiteExport = (state: AppState, treeId: string) => {
  const tree = state.trees.find((item) => item.id === treeId);
  const people = state.people.filter((person) => person.treeId === treeId && !person.private);
  const peopleHtml = people.map((person) => {
    const deathDetails = { ...emptyDeathDetails(), ...(person.deathDetails || {}) };
    const memorial = [deathDetails.deathPlace && `Death place: ${deathDetails.deathPlace}`, deathDetails.deathHospital && `Hospital/facility: ${deathDetails.deathHospital}`, deathDetails.burialSite && `Burial site: ${deathDetails.burialSite}`, deathDetails.cemeteryName && `Cemetery: ${deathDetails.cemeteryName}`, deathDetails.hasGravestone ? "Gravestone recorded" : ""].filter(Boolean).join(" · ");
    return `
    <article>
      <h2>${escapeHtml(fullName(person))}</h2>
      <p><strong>Birth:</strong> ${escapeHtml(person.birthDate || "Unknown")} <strong>Death:</strong> ${escapeHtml(person.deathDate || (person.living ? "Living" : "Unknown"))}</p>
      ${memorial ? `<p><strong>Memorial:</strong> ${escapeHtml(memorial)}</p>` : ""}
      <p>${escapeHtml(person.biography || "No biography entered.")}</p>
    </article>
  `;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(tree?.title ?? "KinForge family site")}</title>
  <style>
    body{font-family:Georgia,serif;background:#faf6f8;color:#312932;margin:0;line-height:1.6}
    header{padding:48px 8vw;background:#9f6f7d;color:white}
    main{max-width:960px;margin:auto;padding:32px}
    article{border-bottom:1px solid #e5d6dd;padding:24px 0}
    .kinforge-export-copyright{max-width:960px;margin:16px auto 40px;padding:0 32px;color:#715967;font-size:13px}
  </style>
</head>
<body>
  <header><h1>${escapeHtml(tree?.title ?? "KinForge family site")}</h1><p>Private export generated by KinForge Genealogy Studio.</p></header>
  <main>${peopleHtml}</main>
  ${COPYRIGHT_HTML}
</body>
</html>`;
};

export const buildBackup = (state: AppState) => JSON.stringify({ app: "KinForge Genealogy Studio", copyright: "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.", version: 1, exportedAt: new Date().toISOString(), state }, null, 2);

export const personCsvRows = (people: Person[]) => [
  ["Given name", "Family name", "Birth", "Death", "Living", "Labels"],
  ...people.map((person) => [person.givenName, person.familyName, person.birthDate, person.deathDate, person.living ? "yes" : "no", person.labels.join("; ")])
];

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char] ?? char));

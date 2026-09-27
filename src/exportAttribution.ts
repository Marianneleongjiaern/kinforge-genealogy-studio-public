export const PUBLIC_EXPORT_COPYRIGHT = "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.";
export const PUBLIC_EXPORT_CREDIT = "Created with KinForge Genealogy Studio, a product of Dreams of Serene Landscapes.";
export const PUBLIC_EXPORT_PERMISSION = "Copyright-free exports require written permission through the KinForge support form before account creation or use. Close or special users must provide real, non-AI proof such as photos together or other digital or physical records. Approved users may place their own copyright on their books, but should credit Dreams of Serene Landscapes when asked.";
export const PUBLIC_EXPORT_NOTICE = `${PUBLIC_EXPORT_COPYRIGHT} ${PUBLIC_EXPORT_CREDIT} ${PUBLIC_EXPORT_PERMISSION}`;
export const PUBLIC_EXPORT_TERMS_STORAGE_KEY = "kinforge-public-export-terms-v1";

export function publicExportsRequireAttribution() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (!host) return window.location.protocol === "file:" || window.location.protocol.startsWith("app");
  return true;
}

export function recordPublicExportAgreement() {
  if (typeof window !== "undefined") localStorage.setItem(PUBLIC_EXPORT_TERMS_STORAGE_KEY, new Date().toISOString());
}

export function publicExportAgreementAccepted() {
  return typeof window !== "undefined" && !!localStorage.getItem(PUBLIC_EXPORT_TERMS_STORAGE_KEY);
}

export function isRecoveryDownload(fileName: string) {
  return /recovery/i.test(fileName);
}

export function ensurePublicExportAgreement(fileName: string) {
  if (!publicExportsRequireAttribution() || isRecoveryDownload(fileName) || publicExportAgreementAccepted()) return true;
  const accepted = window.confirm([
    "KinForge export and download terms",
    "",
    PUBLIC_EXPORT_NOTICE,
    "",
    "Select OK only if you agree to keep the required copyright/credit on exported or downloaded files, unless Dreams of Serene Landscapes has given written permission through support for a copyright-free version."
  ].join("\n"));
  if (accepted) recordPublicExportAgreement();
  return accepted;
}

export function publicExportNoticeHtml() {
  return `<footer class="kinforge-public-export-credit"><p><strong>${PUBLIC_EXPORT_COPYRIGHT}</strong></p><p>${PUBLIC_EXPORT_CREDIT}</p><p>${PUBLIC_EXPORT_PERMISSION}</p></footer>`;
}

function rtfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}").replace(/\n/g, "\\par\n");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function isBlob(value: BlobPart): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function shouldTreatAsText(fileName: string, type: string) {
  const name = fileName.toLowerCase();
  const mime = type.toLowerCase();
  return mime.startsWith("text/")
    || mime.includes("json")
    || mime.includes("rtf")
    || name.endsWith(".ged")
    || name.endsWith(".gedcom")
    || name.endsWith(".json")
    || name.endsWith(".csv")
    || name.endsWith(".rtf")
    || name.endsWith(".html")
    || name.endsWith(".htm");
}

async function readTextContent(content: BlobPart, fileName: string, type: string) {
  if (!shouldTreatAsText(fileName, type)) return undefined;
  if (typeof content === "string") return content;
  if (isBlob(content)) return content.text();
  if (content instanceof ArrayBuffer) return new TextDecoder().decode(content);
  if (ArrayBuffer.isView(content)) return new TextDecoder().decode(content as BufferSource);
  return undefined;
}

export async function withPublicExportAttribution(fileName: string, content: BlobPart, type: string) {
  const effectiveType = isBlob(content) && content.type ? content.type : type;
  if (!publicExportsRequireAttribution() || isRecoveryDownload(fileName)) return { content, type: effectiveType };
  const text = await readTextContent(content, fileName, effectiveType);
  if (text === undefined || text.includes(PUBLIC_EXPORT_CREDIT)) return { content, type: effectiveType };
  const name = fileName.toLowerCase();
  const mime = effectiveType.toLowerCase();

  if (name.endsWith(".ged") || name.endsWith(".gedcom")) {
    const notices = [PUBLIC_EXPORT_COPYRIGHT, PUBLIC_EXPORT_CREDIT, PUBLIC_EXPORT_PERMISSION].map(line => `1 NOTE ${line}`).join("\n");
    return { content: text.replace(/(1 CHAR [^\r\n]+)(\r?\n)/, `$1$2${notices}\n`), type: effectiveType };
  }
  if (mime.includes("json") || name.endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return { content: JSON.stringify({ ...data, copyright: PUBLIC_EXPORT_COPYRIGHT, publicExportCredit: PUBLIC_EXPORT_CREDIT, publicExportPermission: PUBLIC_EXPORT_PERMISSION }, null, 2), type: effectiveType };
      }
    } catch {
      return { content: `${text}\n\n${PUBLIC_EXPORT_NOTICE}\n`, type: effectiveType };
    }
  }
  if (mime.includes("csv") || name.endsWith(".csv")) {
    return { content: `${text}\n${[csvCell("KinForge public export credit"), csvCell(PUBLIC_EXPORT_NOTICE)].join(",")}\n`, type: effectiveType };
  }
  if (mime.includes("rtf") || name.endsWith(".rtf")) {
    const insertion = `\\par\\pard ${rtfEscape(PUBLIC_EXPORT_NOTICE)}\\par\n`;
    return { content: text.replace(/\}\s*$/, `${insertion}}`), type: effectiveType };
  }
  if (mime.includes("html") || name.endsWith(".html") || name.endsWith(".htm")) {
    const style = `<style>.kinforge-public-export-credit{margin:32px auto 0;padding:16px;border-top:1px solid #d7e0e3;max-width:920px;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#526369}</style>`;
    const footer = `${style}${publicExportNoticeHtml()}`;
    return { content: text.includes("</body>") ? text.replace("</body>", `${footer}</body>`) : `${text}\n${footer}`, type: effectiveType };
  }
  return { content: `${text}\n\n${PUBLIC_EXPORT_NOTICE}\n`, type: effectiveType };
}

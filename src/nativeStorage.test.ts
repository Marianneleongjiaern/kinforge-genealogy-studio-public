import { describe, expect, it } from "vitest";
import { categoryForFileName, NATIVE_EXPORT_FOLDER, sanitizeNativeFileName } from "./nativeStorage";

describe("native export storage", () => {
  it("uses the KinForge export folder name", () => {
    expect(NATIVE_EXPORT_FOLDER).toBe("KinForge Genealogy Studio");
  });

  it("keeps unsafe file names inside the KinForge folders", () => {
    expect(sanitizeNativeFileName("../Reports/../../KinForge:report?.pdf")).toBe("KinForge-report-.pdf");
    expect(sanitizeNativeFileName("")).toBe("KinForge-export");
    expect(sanitizeNativeFileName("CON.json")).toBe("KinForge-CON.json");
  });

  it("routes reports and family exports into the correct folder categories", () => {
    expect(categoryForFileName("KinForge-report.pdf")).toBe("Reports");
    expect(categoryForFileName("KinForge-report.html")).toBe("Reports");
    expect(categoryForFileName("KinForge-backup.json")).toBe("Backups");
    expect(categoryForFileName("KinForge-tree.ged")).toBe("GEDCOM");
    expect(categoryForFileName("KinForge-family-site.html")).toBe("Websites");
    expect(categoryForFileName("portrait.png")).toBe("Media");
  });
});

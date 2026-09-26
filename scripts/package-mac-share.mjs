import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { signAsync } from "@electron/osx-sign";

const project = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
const version = pkg.version;
const appName = `${pkg.build.productName}.app`;
const builtApp = path.join(project, "release", version, "mac-universal", appName);
const downloads = path.join(os.homedir(), "Downloads");
const stem = `KinForge-${version}-Mac`;
const destination = path.join(downloads, stem);
const bundle = path.join(downloads, `${stem}-Share.zip`);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "kinforge-package-"));
const app = path.join(scratch, appName);
const output = path.join(scratch, stem);
const env = { ...process.env, COPYFILE_DISABLE: "1" };
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const parsePlist = xml => JSON.parse(run("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], { input: xml, stdio: ["pipe", "pipe", "pipe"] }));
const artifacts = [];
let mounted;

function assertClean(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    assert(!entry.name.startsWith("._") && entry.name !== "__MACOSX", `Unexpected metadata file: ${path.join(dir, entry.name)}`);
    if (entry.isDirectory()) assertClean(path.join(dir, entry.name));
  }
}

function validateApp(dir) {
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", dir]);
  assertClean(dir);
  const main = path.join(dir, "Contents", "MacOS", pkg.build.productName);
  const framework = path.join(dir, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A", "Electron Framework");
  const architectures = [main, framework].map(file => run("/usr/bin/lipo", ["-archs", file]).trim());
  for (const arch of architectures) assert(arch.includes("arm64") && arch.includes("x86_64"), `Not universal: ${arch}`);
  const foundVersion = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", path.join(dir, "Contents", "Info.plist")]).trim();
  assert.equal(foundVersion, version);
  assert.equal(hash(path.join(dir, "Contents", "Resources", "app.asar")), hash(path.join(app, "Contents", "Resources", "app.asar")));
  return { version: foundVersion, architectures, strictCodeSignature: "passed", appleDoubleFiles: 0 };
}

function nativeSmoke(dir, name) {
  return JSON.parse(run(process.execPath, ["tests/native-smoke.mjs", path.join(dir, "Contents", "MacOS", pkg.build.productName)], {
    env: { ...env, KINFORGE_NATIVE_SCREENSHOT: path.join(project, "verification", `${name}-${version}.png`) },
    timeout: 180000
  }).trim());
}

function findPayloadApp(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === appName) return full;
    const found = findPayloadApp(full);
    if (found) return found;
  }
}

try {
  assert(fs.existsSync(builtApp), `Build the universal app first: ${builtApp}`);
  assert(!fs.existsSync(destination) && !fs.existsSync(bundle), "Release destination already exists; refusing to overwrite it.");
  run("/usr/bin/ditto", ["--norsrc", "--noextattr", "--noqtn", builtApp, app]);
  run("/usr/bin/xattr", ["-cr", app]);
  await signAsync({
    app, identity: "-", identityValidation: false, platform: "darwin", type: "distribution",
    gatekeeperAssess: false, preAutoEntitlements: false, preEmbedProvisioningProfile: false,
    optionsForFile: () => ({
      entitlements: path.join(project, "node_modules/app-builder-lib/templates/entitlements.mac.plist"),
      hardenedRuntime: false, timestamp: "none"
    })
  });
  run("/usr/bin/xattr", ["-cr", app]);
  const sourceValidation = validateApp(app);
  if (process.argv.includes("--smoke-only")) {
    console.log(JSON.stringify({ sourceValidation, nativeSmoke: nativeSmoke(app, "native-universal") }));
  } else {
  fs.mkdirSync(output);
  const readme = [
    `KinForge Genealogy Studio ${version} - Mac preview`,
    "Product of Dreams of Serene Landscapes", "",
    "Universal application: Apple Silicon and Intel binaries are included.",
    "This is the current development preview, not the completed feature set.", "",
    "INSTALL USING ONE METHOD", "",
    `1. Open KinForge-${version}-universal.dmg and drag KinForge Genealogy Studio to Applications.`,
    `2. Or open KinForge-${version}-Installer.pkg and follow macOS Installer.`,
    "The package targets /Applications. You do not need to install both.",
    "Quit an older KinForge copy before replacing it. Back up your family data first.", "",
    "SIGNING", "",
    "The app is ad-hoc signed. The installer has no Developer ID signature.",
    "Neither is Apple-notarized. macOS may warn about or block these preview files.",
    "Only open a copy from a source you trust. No security settings were disabled to create this release.", "",
    "RELEASE CONTENTS", "",
    "This build includes the dynamic tree workspace, the local archive search and reviewed evidence links,",
    "the searchable Markdown source register, and native blocking of HTTP(S)/WebSocket service requests.",
    "Maintenance now previews changes in the selected tree and supports apply, cancel, undo and redo.",
    "Siblings sit beside one another and descendants appear below their parents in the Family Tree workspace.",
    "Older saved chart positions are recalculated to respect generations; family records are preserved.",
    "Couples are grouped together. Shared children branch from their couple line, with siblings on a shared child bar.",
    "The downward stem meets the centre of the child bar, which branches left and right to the children.",
    "Relationship words no longer appear between chart cards. A visible legend explains each line pattern.",
    "Add relative offers Spouse and Other parent choices. A partner is not automatically treated as a parent.",
    "Advanced AI/OCR, record datasets, DNA analysis, comprehensive reports and production account security remain unfinished.",
    "It opens its bundled application locally; a web server or third-party account is not required.", "",
    "VALIDATION", "",
    "See Verification.json for the actual tests performed. Intel hardware has not been tested.",
    "Installer payload verification is not the same as an administrator-authorized system installation.",
    "SHA256SUMS.txt identifies the files in this release.", "",
    "SHARING", "",
    "Send the DMG for drag-and-drop installation, or the PKG for macOS Installer.",
    "The separate Mac-Share.zip contains both plus these notes and verification results.", "",
  ].join("\n");
  fs.writeFileSync(path.join(output, "Read Me.txt"), readme);

  console.log("Creating the installer package...");
  const root = path.join(scratch, "pkg-root");
  const stagedApp = path.join(root, "Applications", appName);
  fs.mkdirSync(path.dirname(stagedApp), { recursive: true });
  run("/usr/bin/ditto", ["--noextattr", "--noqtn", app, stagedApp]);
  const components = path.join(scratch, "components.plist");
  run("/usr/bin/pkgbuild", ["--analyze", "--root", root, components]);
  const componentData = parsePlist(fs.readFileSync(components));
  for (const entry of componentData) { entry.BundleIsRelocatable = false; entry.BundleIsVersionChecked = true; entry.BundleOverwriteAction = "upgrade"; }
  fs.writeFileSync(components, JSON.stringify(componentData));
  run("/usr/bin/plutil", ["-convert", "xml1", components]);
  const installer = path.join(output, `KinForge-${version}-Installer.pkg`);
  run("/usr/bin/pkgbuild", ["--root", root, "--component-plist", components, "--install-location", "/", "--identifier", pkg.build.appId, "--version", version, "--ownership", "recommended", installer]);
  artifacts.push(installer);

  console.log("Creating the disk image...");
  const dmgRoot = path.join(scratch, "dmg-root");
  fs.mkdirSync(dmgRoot);
  run("/usr/bin/ditto", ["--noextattr", "--noqtn", app, path.join(dmgRoot, appName)]);
  fs.symlinkSync("/Applications", path.join(dmgRoot, "Applications"));
  fs.writeFileSync(path.join(dmgRoot, "Read Me.txt"), readme);
  const dmg = path.join(output, `KinForge-${version}-universal.dmg`);
  run("/usr/bin/hdiutil", ["create", "-volname", `KinForge ${version}`, "-srcfolder", dmgRoot, "-fs", "HFS+", "-format", "UDZO", dmg]);
  artifacts.push(dmg);
  run("/usr/bin/hdiutil", ["verify", dmg]);

  console.log("Opening and testing the app inside the disk image...");
  const mountedInfo = parsePlist(run("/usr/bin/hdiutil", ["attach", "-readonly", "-nobrowse", "-plist", dmg]));
  mounted = mountedInfo["system-entities"].find(e => e["mount-point"])["mount-point"];
  const mountedApp = path.join(mounted, appName);
  const dmgValidation = { ...validateApp(mountedApp), nativeSmoke: nativeSmoke(mountedApp, "native-dmg") };
  run("/usr/bin/hdiutil", ["detach", mounted]);
  mounted = undefined;

  console.log("Extracting and testing the installer payload...");
  const expanded = path.join(scratch, "expanded");
  run("/usr/sbin/pkgutil", ["--expand-full", installer, expanded]);
  const payloadApp = findPayloadApp(expanded);
  assert(payloadApp, "Installer payload did not contain the app.");
  const pkgValidation = { ...validateApp(payloadApp), nativeSmoke: nativeSmoke(payloadApp, "native-pkg"), systemInstallation: "not performed; existing applications and family data left unchanged" };
  run("/usr/sbin/installer", ["-pkg", installer, "-target", "/", "-showChoicesXML"]);
  const verification = { version, checkedAt: new Date().toISOString(), platform: process.platform, hostArchitecture: process.arch, sourceValidation, dmgValidation, pkgValidation, signing: "App ad-hoc signed; PKG unsigned; not Apple-notarized", intelHardwareTest: "not performed" };
  fs.writeFileSync(path.join(output, "Verification.json"), JSON.stringify(verification, null, 2) + "\n");
  fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), fs.readdirSync(output).sort().map(name => `${hash(path.join(output, name))}  ${name}`).join("\n") + "\n");
  assert(!fs.existsSync(destination), "Release destination appeared during validation; refusing to overwrite it.");
  fs.renameSync(output, destination);
  console.log("Creating the shareable ZIP...");
  run("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--noextattr", "--noqtn", "--keepParent", destination, bundle]);
  const zipEntries = run("/usr/bin/zipinfo", ["-1", bundle]).split("\n");
  assert(!zipEntries.some(name => name.split("/").some(part => part.startsWith("._") || part === "__MACOSX")));
  run("/usr/bin/unzip", ["-t", bundle]);
  for (let i = 0; i < artifacts.length; i++) artifacts[i] = path.join(destination, path.basename(artifacts[i]));
  artifacts.push(bundle);
  console.log(JSON.stringify({ passed: true, output: destination, artifacts: artifacts.map(file => ({ path: file, bytes: fs.statSync(file).size, sha256: hash(file) })) }, null, 2));
  }
} finally {
  if (mounted) run("/usr/bin/hdiutil", ["detach", mounted]);
  fs.rmSync(scratch, { recursive: true, force: true });
}

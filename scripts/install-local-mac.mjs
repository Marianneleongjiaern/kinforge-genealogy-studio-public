import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

if (!process.argv[2]) throw new Error("Pass the verified Apple Silicon app bundle.");
const source = resolve(process.argv[2]);
const downloadsRoot = join(process.env.HOME || "/Users/marianneleonghost", "Downloads", "KinForge Genealogy Studio");
const backup = join(downloadsRoot, "Previous Applications");
const target = "/Applications/KinForge Genealogy Studio.app";
const legacyFolder = "/Applications/KinForge Genealogy Studio";
const run = (name, args) => execFileSync(name, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
run("codesign", ["--verify", "--deep", "--strict", source]);
const version = run("/usr/libexec/PlistBuddy", ["-c", "Print CFBundleShortVersionString", join(source, "Contents/Info.plist")]);
mkdirSync(backup, { recursive: true });
if (existsSync(legacyFolder)) rmSync(legacyFolder, { recursive: true, force: true });
const stage = `/Applications/.KinForge-${version}-${Date.now()}.app`;
run("ditto", ["--noextattr", "--noqtn", source, stage]);
run("codesign", ["--verify", "--deep", "--strict", stage]);
let previous;
if (existsSync(target)) {
  const oldVersion = run("/usr/libexec/PlistBuddy", ["-c", "Print CFBundleShortVersionString", join(target, "Contents/Info.plist")]);
  previous = join(backup, `KinForge-${oldVersion}-${Date.now()}.app`);
  renameSync(target, previous);
}
try { renameSync(stage, target); }
catch (error) { if (previous) renameSync(previous, target); throw error; }
run("codesign", ["--verify", "--deep", "--strict", target]);
console.log(JSON.stringify({ version, installed: target, previous, backups: backup }));

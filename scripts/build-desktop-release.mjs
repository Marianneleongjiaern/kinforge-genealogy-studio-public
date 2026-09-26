import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

if (!process.argv[2] || !process.argv[3]) throw new Error("Pass a clean temporary build directory and an installer destination.");
const temporary = resolve(process.argv[2]), destination = resolve(process.argv[3]);
mkdirSync(destination, { recursive: true });
const env = { ...process.env, COPYFILE_DISABLE: "1", CSC_IDENTITY_AUTO_DISCOVERY: "false" };
// Run packaging serially to limit memory pressure on the Mac being tested.
for (const [platform, arch] of [["Apple-Silicon", "arm64"], ["Intel", "x64"], ["Windows", "x64"]]) {
  const output = join(temporary, platform);
  const args = platform === "Windows" ? ["--win", "nsis", "portable", "--x64"] : ["--mac", "dmg", "pkg", "zip", `--${arch}`, "--config.mac.identity=-", `--config.mac.artifactName=\${productName}-\${version}-${platform}.\${ext}`];
  console.log(`Building ${platform}`);
  execFileSync("npx", ["electron-builder", ...args, "--publish=never", `--config.directories.output=${output}`], { env, stdio: "inherit" });
  for (const file of readdirSync(output).filter(file => /\.(dmg|pkg|zip|exe)$/.test(file))) copyFileSync(join(output, file), join(destination, file));
  console.log(`${platform} installers copied to ${destination}`);
}

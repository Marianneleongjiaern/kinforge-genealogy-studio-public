import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const output = resolve("dist/client");
const files = (await readdir(resolve(output, "assets"))).filter(file => !file.endsWith(".map"));
const fonts = (await readdir(resolve(output, "fonts"))).filter(file => /\.(ttf|woff2?)$/i.test(file));
const assets = ["./index.html", "./manifest.webmanifest", "./icon.svg", ...files.map(file => `./assets/${file}`), ...fonts.map(file => `./fonts/${file}`)];
const hash = createHash("sha256").update(JSON.stringify(assets)).update(await readFile(resolve(output, "index.html"))).digest("hex").slice(0, 12);
await writeFile(resolve(output, "precache.js"), `self.KINFORGE_CACHE = ${JSON.stringify(`kinforge-${hash}`)};\nself.KINFORGE_ASSETS = ${JSON.stringify(assets)};\n`);
console.log(`Offline build prepared: ${assets.length} files.`);

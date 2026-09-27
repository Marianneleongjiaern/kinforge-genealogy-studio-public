import { readFile, open } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { transform } from "esbuild";

const directory = process.argv[2], origin = "https://kinforge-genealogy-studio.marianneleong3.chatgpt.site";
if (!directory) throw new Error("Pass the verified installer directory.");
const token = process.env.KINFORGE_RELEASE_UPLOAD_TOKEN || (await new Promise((resolve, reject) => {
  process.stdin.setRawMode?.(true);
  console.log("Ready for publisher token JSON on stdin (input is hidden).");
  let input = "";
  const receive = chunk => { input += chunk.toString(); if (!input.includes("\n")) return; process.stdin.off("data", receive); process.stdin.setRawMode?.(false); process.stdin.pause(); try { resolve(JSON.parse(input.trim()).token); } catch (error) { reject(error); } };
  process.stdin.on("data", receive); process.stdin.resume();
}));
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid publisher token.");
const transformed = await transform(await readFile("server/releaseManifest.ts", "utf8"), { loader: "ts", format: "esm" });
const { release } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);
async function call(id, action, body, method = "POST") {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${origin}/api/release-upload/${id}/${action}`, { method, headers: { Authorization: `Bearer ${token}` }, body, signal: AbortSignal.timeout(180000), redirect: "error" });
      const value = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${value.error || "Upload failed"}`); return value;
    } catch (error) { last = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); }
  }
  throw last;
}
async function publishFile(file) {
  const path = join(directory, file.name), hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== file.sha256) throw new Error(`Local checksum failed: ${file.id}`);
  const start = await call(file.id, "start");
  if (!start.complete) {
    const handle = await open(path, "r"), parts = [];
    try {
      for (let offset = 0, number = 1; offset < file.size; number++) {
        const buffer = Buffer.alloc(Math.min(start.partSize, file.size - offset));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        if (bytesRead !== buffer.length) throw new Error("Incomplete local read.");
        parts.push(await call(file.id, `part/${number}`, buffer, "PUT")); offset += bytesRead;
        console.log(`${file.id}: uploaded ${Math.round(offset / file.size * 100)}%`);
      }
    } finally { await handle.close(); }
    await call(file.id, "complete", JSON.stringify({ parts }));
  }
  const url = `${origin}/api/releases/${release.version}/${file.id}`;
  const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!head.ok || Number(head.headers.get("content-length")) !== file.size || head.headers.get("x-checksum-sha256") !== file.sha256) throw new Error(`Published metadata failed: ${file.id}`);
  const handle = await open(path, "r");
  try {
    for (const offset of [0, Math.max(0, file.size - 65536)]) {
      const expected = Buffer.alloc(Math.min(65536, file.size - offset));
      await handle.read(expected, 0, expected.length, offset);
      const check = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + expected.length - 1}` }, signal: AbortSignal.timeout(30000), redirect: "error" });
      if (check.status !== 206 || !Buffer.from(await check.arrayBuffer()).equals(expected)) throw new Error(`Download range failed: ${file.id}`);
    }
  } finally { await handle.close(); }
  console.log(`${file.id}: server checksum, download and resume verified`);
}
for (const file of release.files) await publishFile(file);
console.log(JSON.stringify({ version: release.version, verifiedDownloads: release.files.length, url: `${origin}/downloads` }));

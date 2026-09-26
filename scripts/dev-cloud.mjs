import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
const mf = new Miniflare({ modules: true, scriptPath: "dist/server/index.js", compatibilityDate: "2024-11-01", port: 8787, d1Databases: ["DB"], r2Buckets: ["BUCKET"], d1Persist: ".cloud-dev/db", r2Persist: ".cloud-dev/files" });
const db = await mf.getD1Database("DB");
await db.prepare("CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)").run();
for (const name of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) {
  if (await db.prepare("SELECT name FROM local_migrations WHERE name=?").bind(name).first()) continue;
  for (const sql of (await readFile(`drizzle/${name}`, "utf8")).split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(sql.trim()).run();
  await db.prepare("INSERT INTO local_migrations (name) VALUES (?)").bind(name).run();
}
console.log(`Local cloud service ready: ${await mf.ready}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => { await mf.dispose(); process.exit(0); });

import { build } from "esbuild";
import { fileURLToPath } from "node:url";

export async function createDomainFixture() {
  // Data URLs cannot resolve relative imports, so include the domain's dependencies.
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL("../../src/domain.ts", import.meta.url))],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "es2022",
  });
  const domain = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  return domain.createSeedState();
}

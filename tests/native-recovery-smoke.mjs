// Run after building the parent checkout: node tests/native-recovery-smoke.mjs
import assert from "node:assert/strict";
import { once } from "node:events";
import { access, mkdtemp, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// This standalone test records no traces, screenshots, videos, or credential-bearing errors.
process.env.DEBUG = "";
process.env.PWDEBUG = "0";
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const { _electron: electron, expect } = await import("@playwright/test");

const repo = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const entry = join(repo, "dist", "client", "index.html");
const fixture = {
  email: "native-recovery@example.test",
  password: ["Synthetic", "native", "password", "2468"].join("-"),
  code: ["SYNTHETIC", "NATIVE", "RECOVERY", "2468"].join("-"),
};
const fileName = "KinForge-account-recovery.txt";
const expectedBytes = Buffer.from(`KinForge account: ${fixture.email}\nRecovery code: ${fixture.code}\nKeep this private. A new password reset replaces this code.\n`, "utf8");
let root, nativeApp, server;
let stage = "find the built app; run the parent build first";
let failure;
let registrations = 0;
let unexpectedRequests = 0;

try {
  assert(process.argv.length === 2, "This test only launches the repository Electron app.");
  await access(entry);
  stage = "prepare isolated storage and synthetic account responses";
  root = await realpath(await mkdtemp(join(tmpdir(), "kinforge-native-recovery-")));
  const profile = join(root, "user-data");
  const downloads = join(root, "Downloads");
  const artifacts = join(root, "playwright-artifacts");
  await Promise.all([profile, downloads, artifacts].map(directory => mkdir(directory, { recursive: true })));
  const bootstrap = join(root, "isolate-storage.cjs");
  await writeFile(bootstrap, `(${isolateElectronStorage.toString()})();\n`, { mode: 0o600 });

  server = createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(body));
    };
    try {
      if (request.method === "GET" && request.url === "/api/auth/me") return reply(401, { error: "Sign in required." });
      if (request.method === "GET" && request.url === "/api/libraries") return reply(200, { libraries: [] });
      if (request.method === "POST" && request.url === "/api/auth/register") {
        let body = "";
        for await (const chunk of request) {
          body += chunk.toString("utf8");
          if (body.length > 16_384) throw new Error("Unexpected request size");
        }
        const input = JSON.parse(body);
        assert(input.email === fixture.email && input.password === fixture.password);
        registrations += 1;
        return reply(201, { user: { id: "synthetic-native-recovery", name: "Native Recovery Test", email: fixture.email }, recoveryCode: fixture.code });
      }
      unexpectedRequests += 1;
      reply(404, { error: "No synthetic route." });
    } catch {
      unexpectedRequests += 1;
      reply(400, { error: "Invalid synthetic request." });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const mockOrigin = `http://127.0.0.1:${server.address().port}`;

  stage = "launch repository Electron with storage isolated before app startup";
  const env = { ...process.env, KINFORGE_TEST_CLOUD_URL: mockOrigin, KINFORGE_NATIVE_RECOVERY_ROOT: root, KINFORGE_NATIVE_RECOVERY_SAVE_DIR: downloads };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  nativeApp = await electron.launch({
    cwd: repo,
    args: ["-r", bootstrap, ".", `--user-data-dir=${profile}`],
    env,
    artifactsDir: artifacts,
    acceptDownloads: true,
    timeout: 30_000,
  });
  const identity = await nativeApp.evaluate(({ app }) => ({
    packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath("userData"),
    downloads: app.getPath("downloads"), appData: app.getPath("appData"), sessionData: app.getPath("sessionData"),
  }));
  assert(!identity.packaged && await realpath(identity.appPath) === repo);
  assert(await realpath(identity.userData) === profile);
  assert(await realpath(identity.downloads) === downloads);
  assert(await realpath(identity.appData) === join(root, "app-data"));
  assert(await realpath(identity.sessionData) === join(root, "session-data"));

  stage = "open the actual built recovery dialog using only the synthetic account";
  const page = await nativeApp.firstWindow();
  page.setDefaultTimeout(15_000);
  let pageErrors = 0;
  let browserDownloads = 0;
  page.on("pageerror", () => { pageErrors += 1; });
  page.on("download", () => { browserDownloads += 1; });
  await page.waitForURL(pathToFileURL(entry).href);
  await page.waitForFunction(() => !!window.kinforgeNative?.saveFile);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.evaluate(data => {
    for (const [selector, value] of [
      ['input[autocomplete="name"]', "Native Recovery Test"],
      ['input[type="email"]', data.email],
      ['input[type="password"]', data.password],
    ]) {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, { email: fixture.email, password: fixture.password });
  await page.locator('button[type="submit"]').click();
  const dialog = page.getByRole("dialog", { name: "Your account recovery code" });
  await expect(dialog).toBeVisible();
  assert(registrations === 1 && unexpectedRequests === 0);

  stage = "verify the real native file write and saved-path status";
  const folders = await page.evaluate(() => window.kinforgeNative.getStorageFolders());
  const exportDirectory = await realpath(folders.folders.Exports);
  assert(exportDirectory === join(downloads, "KinForge Genealogy Studio", "Exports"));
  const expectedPath = join(exportDirectory, fileName);
  const downloadButton = dialog.getByRole("button", { name: "Download recovery code", exact: true });
  await downloadButton.click();
  await expect(dialog.getByRole("status")).toHaveText(`Recovery file saved to ${expectedPath}`);
  const writtenPath = await realpath(expectedPath);
  const withinRoot = relative(root, writtenPath);
  assert(withinRoot && !withinRoot.startsWith("..") && !isAbsolute(withinRoot));
  assert((await readFile(writtenPath)).equals(expectedBytes), "Native recovery file bytes must match.");
  assert(browserDownloads === 0, "A successful native save must not use browser fallback.");
  await expect(dialog).toBeVisible();

  stage = "verify a real native write failure cannot claim a native save";
  // Keep the written file, but replace only the temporary Exports directory with a file.
  const retainedExports = join(root, "retained-exports");
  await rename(exportDirectory, retainedExports);
  await writeFile(exportDirectory, "Synthetic write-failure probe", { flag: "wx", mode: 0o600 });
  const [fallback] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  await expect(dialog.getByRole("status")).toContainText("This browser cannot confirm that the file was saved.");
  assert(fallback.suggestedFilename() === fileName && await fallback.failure() === null);
  const fallbackPath = await fallback.path();
  assert(fallbackPath !== null && (await readFile(fallbackPath)).equals(expectedBytes), "Fallback recovery file bytes must match.");
  assert((await readFile(join(retainedExports, fileName))).equals(expectedBytes), "The original native file must remain intact.");
  assert(browserDownloads === 1 && pageErrors === 0 && unexpectedRequests === 0);
  await fallback.delete();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "I have saved it", exact: true }).click();
  await expect(dialog).toBeHidden();
} catch {
  // Never print an exception, request body, DOM snapshot, or fixture on failure.
  failure = stage;
} finally {
  if (nativeApp) {
    const child = nativeApp.process();
    const stop = setTimeout(() => child.kill("SIGKILL"), 5_000);
    try { await nativeApp.close(); }
    catch {
      failure ||= "close the temporary Electron process";
      child.kill("SIGKILL");
      if (child.exitCode === null && child.signalCode === null) await once(child, "exit");
    } finally { clearTimeout(stop); }
  }
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  if (root) {
    try { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch { failure ||= "remove temporary recovery-test files"; }
  }
}

if (failure) {
  console.error(`Native recovery smoke FAIL: ${failure}.`);
  process.exitCode = 1;
} else {
  console.log("Native recovery smoke PASS: isolated repository app, actual recovery button, exact native disk bytes, confirmed saved path, real write-failure fallback, explicit acknowledgement, temporary files removed.");
}

function isolateElectronStorage() {
  const { app } = require("electron");
  const fs = require("node:fs");
  const path = require("node:path");
  const testRoot = process.env.KINFORGE_NATIVE_RECOVERY_ROOT;
  const saveDirectory = process.env.KINFORGE_NATIVE_RECOVERY_SAVE_DIR;
  if (app.isPackaged || !testRoot || saveDirectory !== path.join(testRoot, "Downloads")) throw new Error("Isolated recovery storage is required.");
  const paths = {
    appData: path.join(testRoot, "app-data"),
    userData: path.join(testRoot, "user-data"),
    sessionData: path.join(testRoot, "session-data"),
    downloads: saveDirectory,
    logs: path.join(testRoot, "logs"),
    crashDumps: path.join(testRoot, "crash-dumps"),
  };
  for (const [name, directory] of Object.entries(paths)) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    app.setPath(name, directory);
  }
}

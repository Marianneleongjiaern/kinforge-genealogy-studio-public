import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const source = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
const nativeRequire = createRequire(import.meta.url);

async function start({ savedSession = false, encryptionAvailable = true, brokenSession = false } = {}) {
  const calls = [];
  const handlers = new Map();
  const requests = [];
  const opened = [];
  const updatePayload = Buffer.from("native update package");
  const checksum = nativeRequire("node:crypto").createHash("sha256").update(updatePayload).digest("hex");
  const electron = {
    app: { isPackaged: true, whenReady: () => Promise.resolve(), getPath: key => `/test/${key}`, getVersion: () => "9.9.9", on() {} },
    BrowserWindow: class {
      constructor() { calls.push("window"); this.webContents = { setWindowOpenHandler() {}, on() {} }; }
      loadFile() { return Promise.resolve(); }
    },
    ipcMain: { handle(name, handler) { handlers.set(name, handler); } },
    shell: { openExternal() {}, async openPath(file) { opened.push(file); return ""; } },
    net: { async fetch(url, options) { requests.push(options); return { status: 200, headers: new Headers({ "content-disposition": 'attachment; filename="KinForge-Test.pkg"', "x-checksum-sha256": checksum }), text: async () => "{}", arrayBuffer: async () => updatePayload }; } },
    session: { defaultSession: { webRequest: { onBeforeRequest() {} } } },
    safeStorage: {
      isEncryptionAvailable() { calls.push("keychain"); return encryptionAvailable; },
      decryptString() { calls.push("decrypt"); if (brokenSession) throw new Error("Unavailable key"); return "test-session"; },
    },
  };
  const writes = [];
  const fs = { mkdirSync() {}, writeFileSync() {}, existsSync: () => savedSession, readFileSync: () => Buffer.from("encrypted-session"), promises: { writeFile: async (file, data) => writes.push({ file, data }) } };
  vm.runInNewContext(source, {
    require: name => name === "electron" ? electron : name === "fs" ? fs : nativeRequire(name),
    __dirname: "/test/app/electron", process, URL, AbortSignal, Buffer,
  });
  await new Promise(resolve => setImmediate(resolve));
  const request = (url = "file:///test/app/dist/client/index.html") => handlers.get("kinforge:cloud-request")({ senderFrame: { url } }, { path: "/api/auth/me", method: "GET" });
  const nativeEvent = { senderFrame: { url: "file:///test/app/dist/client/index.html" } };
  return { calls, request, requests, handlers, nativeEvent, opened, writes };
}

test("a fresh desktop profile opens without accessing the keychain", async () => {
  const app = await start();
  assert.deepEqual(app.calls, ["window"]);
  await app.request();
  assert.deepEqual(app.calls, ["window"]);
});

test("a saved desktop sign-in still requires encrypted storage", async () => {
  const app = await start({ savedSession: true });
  assert.deepEqual(app.calls, ["window"]);
  await app.request(); await app.request();
  assert.deepEqual(app.calls, ["window", "keychain", "decrypt"]);
  assert.equal(app.requests[0].headers.Cookie, "test-session");
  const unavailable = await start({ savedSession: true, encryptionAvailable: false });
  await unavailable.request();
  assert.deepEqual(unavailable.calls, ["window", "keychain"]);
  assert.equal(unavailable.requests[0].headers.Cookie, undefined);
});

test("an unreadable encrypted session does not prevent the app window opening", async () => {
  const app = await start({ savedSession: true, brokenSession: true });
  assert.deepEqual(app.calls, ["window"]);
  await app.request();
  assert.deepEqual(app.calls, ["window", "keychain", "decrypt"]);
  assert.equal(app.requests[0].headers.Cookie, undefined);
});

test("untrusted frames cannot trigger session restoration or network requests", async () => {
  const app = await start({ savedSession: true });
  await assert.rejects(app.request("https://example.test"), /Untrusted application frame/);
  assert.deepEqual(app.calls, ["window"]);
  assert.equal(app.requests.length, 0);
});

test("desktop update APIs expose version info and only download verified KinForge release files", async () => {
  const app = await start();
  const info = await app.handlers.get("kinforge:get-app-info")(app.nativeEvent);
  assert.equal(info.version, "9.9.9");
  await assert.rejects(app.handlers.get("kinforge:download-update")(app.nativeEvent, "https://example.test/KinForge.pkg"), /Unsupported KinForge update/);
  const saved = await app.handlers.get("kinforge:download-update")(app.nativeEvent, "https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/api/releases/9.9.10/apple-silicon-pkg");
  assert.equal(saved.ok, true);
  assert.match(saved.path, /Updates\/KinForge-Test\.pkg$/);
  assert.equal(app.writes.length, 1);
  assert.deepEqual(app.opened, [saved.path]);
});

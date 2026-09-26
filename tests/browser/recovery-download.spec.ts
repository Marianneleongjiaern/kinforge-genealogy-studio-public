import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = {
  email: "recovery-download@example.test",
  code: ["SYNTHETIC", "RECOVERY", "ONLY", "2468"].join("-"),
  password: ["Synthetic", "password", "only", "2468"].join("-"),
};
const fileName = "KinForge-account-recovery.txt";
const expectedFile = `KinForge account: ${fixture.email}\nRecovery code: ${fixture.code}\nKeep this private. A new password reset replaces this code.\n`;
const recoveryDialog = (page: Page) => page.getByRole("dialog", { name: "Your account recovery code" });

// Recovery details must never enter traces, screenshots, videos, or assertion diffs.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
test.use({ trace: "off", screenshot: "off", video: "off", serviceWorkers: "block", acceptDownloads: true });
test.afterEach(async ({ page }) => {
  await page.goto("about:blank").catch(() => {});
});

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Recovery tests require a local preview.");
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Exercise the real account/recovery UI without loading the independently edited workspace.
    if (url.pathname === "/src/App.tsx") return route.fulfill({ contentType: "application/javascript", body: "export default function App() { return null; }" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Sign in required." } });
    if (url.pathname === "/api/auth/register") return route.fulfill({ status: 201, json: {
      user: { id: "synthetic-recovery-user", name: "Recovery Test", email: fixture.email }, recoveryCode: fixture.code,
    } });
    if (url.pathname === "/api/libraries") return route.fulfill({ json: { libraries: [] } });
    return route.fulfill({ status: 404, json: { error: "No synthetic route." } });
  });
});

async function openRecovery(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  // Fill inside the browser so failures cannot include credential arguments in an action log.
  await page.evaluate(data => {
    for (const [selector, value] of [
      ['input[autocomplete="name"]', "Recovery Test"],
      ['input[type="email"]', data.email],
      ['input[type="password"]', data.password],
    ]) {
      const input = document.querySelector<HTMLInputElement>(selector)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, fixture);
  await page.locator('button[type="submit"]').click();
  await expect(recoveryDialog(page)).toBeVisible();
}

async function checkDownloadedFile(page: Page, click = () => recoveryDialog(page).getByRole("button", { name: "Download recovery code", exact: true }).click()) {
  const pending = page.waitForEvent("download", { timeout: 5000 });
  await click();
  const download = await pending;
  expect(download.suggestedFilename() === fileName, "Recovery filename matches").toBe(true);
  expect(await download.failure() === null, "Recovery download completes").toBe(true);
  const path = await download.path();
  expect(path !== null, "Recovery file exists").toBe(true);
  const bytes = await readFile(path!);
  expect(bytes.equals(Buffer.from(expectedFile, "utf8")), "Recovery file bytes match the synthetic fixture").toBe(true);
  await download.delete();
}

test("recovery download survives a delayed embedded-browser handoff", async ({ page }) => {
  await page.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.setTimeout(() => click.call(this), 75);
      else click.call(this);
    };
  });
  await openRecovery(page);
  await checkDownloadedFile(page);
  await expect(recoveryDialog(page).getByRole("status")).toContainText("This browser cannot confirm that the file was saved.");
  await expect(recoveryDialog(page)).toBeVisible();
});

test("downloads exact recovery bytes on mobile and requires explicit acknowledgement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRecovery(page);
  await checkDownloadedFile(page);
  await expect(recoveryDialog(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Recovery dialog fits the viewport").toBe(true);
  await recoveryDialog(page).getByRole("button", { name: "I have saved it", exact: true }).click();
  await expect(recoveryDialog(page)).toBeHidden();
});

test("browser download URLs remain usable until delayed cleanup", async ({ page }) => {
  await openRecovery(page);
  await page.clock.install();
  await checkDownloadedFile(page);
  await expect(page.locator("a[download]")).toHaveCount(1);
  await page.clock.fastForward(59_000);
  // Reuse the actual download URL: connect-src intentionally disallows fetching blobs.
  await checkDownloadedFile(page, () => page.evaluate(() => document.querySelector<HTMLAnchorElement>("a[download]")!.click()));
  await page.evaluate(() => {
    const url = document.querySelector<HTMLAnchorElement>("a[download]")!.href;
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = value => {
      document.documentElement.dataset.downloadRevoked = String(value === url);
      revoke(value);
    };
  });
  await page.clock.fastForward(1_000);
  await expect(page.locator("a[download]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.downloadRevoked === "true"), "Download URL is eventually revoked").toBe(true);
});

test("download failure is reported and clipboard copies the complete recovery file", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLAnchorElement.prototype.click = function () { throw new Error("Download blocked"); };
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { copied = text; }, readText: async () => copied,
    } });
  });
  await openRecovery(page);
  const dialog = recoveryDialog(page);
  await dialog.getByRole("button", { name: "Download recovery code", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be downloaded");
  await expect(page.locator("a[download]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Copy recovery details", exact: true }).click();
  expect(await page.evaluate(async expected => (await navigator.clipboard.readText()) === expected, expectedFile), "Clipboard matches the complete synthetic recovery file").toBe(true);
  await expect(dialog.getByRole("status")).toContainText("Recovery details copied");
  await expect(dialog).toBeVisible();
});

for (const clipboard of ["denied", "unavailable"] as const) {
  test(`clipboard ${clipboard} keeps complete recovery details available for manual copy`, async ({ page }) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "unavailable" ? undefined : {
        writeText: async () => { throw new DOMException("Clipboard denied", "NotAllowedError"); },
      } });
    }, clipboard);
    await openRecovery(page);
    const dialog = recoveryDialog(page);
    await dialog.getByRole("button", { name: "Copy recovery details", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Clipboard access is unavailable");
    expect(await page.evaluate(expected => {
      const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Recovery details for manual copy"]');
      return !!input && input.value === expected && input.readOnly && document.activeElement === input
        && input.selectionStart === 0 && input.selectionEnd === input.value.length;
    }, expectedFile), "The entire recovery file is selected for manual copying").toBe(true);
    await expect(dialog).toBeVisible();
  });
}

test("a silent browser block leaves an honest status and a working copy option", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLAnchorElement.prototype.click = function () {};
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
  });
  await openRecovery(page);
  const dialog = recoveryDialog(page);
  await dialog.getByRole("button", { name: "Download recovery code", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("This browser cannot confirm that the file was saved.");
  await dialog.getByRole("button", { name: "Copy recovery details", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Recovery details copied");
  await expect(dialog).toBeVisible();
});

test("native storage confirms its actual path and receives the exact recovery file", async ({ page }) => {
  const savedPath = "/synthetic-downloads/KinForge-account-recovery.txt";
  await page.addInitScript(({ expected, path, name }) => {
    Object.defineProperty(window, "kinforgeNative", { configurable: true, value: {
      saveFile: async (payload: { fileName: string; base64: string; category: string; mimeType: string }) => {
        document.documentElement.dataset.nativePayloadValid = String(atob(payload.base64) === expected
          && payload.fileName === name && payload.category === "Exports" && payload.mimeType === "text/plain;charset=utf-8");
        return { ok: true, path, category: "Exports" };
      },
    } });
    URL.createObjectURL = () => { throw new Error("Native success must not trigger a browser download"); };
  }, { expected: expectedFile, path: savedPath, name: fileName });
  await openRecovery(page);
  const dialog = recoveryDialog(page);
  await dialog.getByRole("button", { name: "Download recovery code", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(`Recovery file saved to ${savedPath}`);
  expect(await page.evaluate(() => document.documentElement.dataset.nativePayloadValid === "true"), "Native payload matches the complete synthetic recovery file").toBe(true);
  await expect(dialog).toBeVisible();
});

for (const nativeFailure of ["rejected", "not-ok"] as const) {
  test(`native storage ${nativeFailure} falls back to a real browser download`, async ({ page }) => {
    await page.addInitScript(failure => {
      Object.defineProperty(window, "kinforgeNative", { configurable: true, value: {
        saveFile: async () => {
          if (failure === "rejected") throw new Error("Native save unavailable");
          return { ok: false, path: "", category: "Exports" };
        },
      } });
    }, nativeFailure);
    await openRecovery(page);
    await checkDownloadedFile(page);
    await expect(recoveryDialog(page).getByRole("status")).toContainText("Download started.");
    await expect(recoveryDialog(page)).toBeVisible();
  });
}

/**
 * Capture the landing page screenshots from the real app.
 *
 * Two windows are involved, both launched by this script:
 *
 *   1. the demo stage (`demo-stage.html`) in app mode - the "content" a creator
 *      would be recording. It shows code copied from this repo, never the
 *      owner's desktop, and never a person.
 *   2. the packaged Electron app, run with `--use-fake-device-for-media-stream`
 *      so the camera is Chromium's synthetic test pattern instead of a real
 *      webcam (no face is ever published).
 *
 * The app is driven over CDP exactly like a person would: enable the camera,
 * open the source picker, pick the demo window, switch scenes, hit Record.
 *
 *   node scripts/screenshots/capture.mjs
 *
 * Output: public/landing/{hero,editor,scenes,recording}.webp
 *
 * The source picker is deliberately never captured: Chromium lists every window
 * on the machine, so such a shot would publish the owner's private window
 * titles and thumbnails.
 *
 * Note: stopping a recording opens the native "Simpan rekaman" dialog (the app
 * saves through the main process, see electron/save-recording.js). This script
 * presses Escape to cancel it, so no file is written, and captures the page
 * afterwards - native dialogs are not part of the page at all.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const OUT_DIR = join(ROOT, "public", "landing");
const DEMO_PAGE = join(HERE, "demo-stage.html");
const ELECTRON = join(
  ROOT,
  "node_modules/.pnpm/electron@44.9.0/node_modules/electron/dist/electron.exe",
);

const PORT = 9410;
const DEMO_TITLE = "Demo konten";
const PROFILE = join(tmpdir(), "creator-screen-shots");
const DEMO_PROFILE = join(PROFILE, "demo-chrome");
const APP_PROFILE = join(PROFILE, "app-electron");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_r, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
  ]);
}

async function waitFor(check, { timeout = 15000, interval = 200, label = "condition" } = {}) {
  const started = Date.now();
  for (;;) {
    if (await check()) return true;
    if (Date.now() - started > timeout) throw new Error(`timeout waiting for ${label}`);
    await sleep(interval);
  }
}

function findBrowser() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("no Chrome or Edge binary found");
  return found;
}

async function connect(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  if (!page) throw new Error("no page target on the debugging port");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  await new Promise((r) => ws.addEventListener("open", r));

  const send = (method, params = {}) =>
    withTimeout(
      new Promise((res) => {
        const next = ++id;
        pending.set(next, res);
        ws.send(JSON.stringify({ id: next, method, params }));
      }),
      20000,
      method,
    );

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.result?.exceptionDetails) {
      throw new Error(
        `page error: ${result.result.exceptionDetails.exception?.description ?? expression}`,
      );
    }
    return result.result?.result?.value;
  };

  return { send, evaluate, close: () => ws.close() };
}

const HELPERS = `
  window.__cs = {
    clickText(text) {
      const target = text.toLowerCase();
      const el = [...document.querySelectorAll("button,[role=tab],a")]
        .find((n) => (n.innerText || "").trim().toLowerCase().includes(target));
      if (!el) return "missing:" + text;
      el.click();
      return "ok";
    },
    clickAria(label) {
      const el = document.querySelector('[aria-label="' + label + '"]');
      if (!el) return "missing:" + label;
      el.click();
      return "ok";
    },
    videoStates() {
      return [...document.querySelectorAll("video")].map((v) => ({
        w: v.videoWidth, h: v.videoHeight, t: Math.round(v.currentTime * 10) / 10,
      }));
    },
    dialogText() {
      const el = document.querySelector('[role=dialog]');
      return el ? el.innerText.slice(0, 200) : null;
    },
    buttonTexts() {
      return [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim());
    },
  };
  "helpers ready";
`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true });

  const browser = findBrowser();
  const children = [];

  const killMatching = (needle) =>
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore" },
    );

  process.on("exit", () => {
    killMatching(PORT);
    killMatching(DEMO_PROFILE.replace(/\\/g, "\\\\"));
  });

  try {
    // 1. The content that will be visible inside the app's canvas.
    const demo = spawn(
      browser,
      [
        `--app=${pathToFileURL(DEMO_PAGE).toString()}`,
        "--window-size=1440,860",
        "--window-position=40,40",
        `--user-data-dir=${DEMO_PROFILE}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--force-color-profile=srgb",
        // Without these, Windows occlusion detection stops painting the demo
        // window once the app window covers it, and the captured source comes
        // out as an empty grey frame.
        "--disable-features=CalculateNativeWinOcclusion",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      { detached: false, stdio: "ignore" },
    );
    children.push(demo);
    console.log("demo stage:", demo.pid);

    // 2. The app under test: separate profile, fake camera/mic, CDP port.
    const appProcess = spawn(
      ELECTRON,
      [
        ".",
        "--prod",
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${APP_PROFILE}`,
        "--use-fake-device-for-media-stream",
        "--disable-features=CalculateNativeWinOcclusion",
        "--force-color-profile=srgb",
        "--disable-gpu-compositing",
        "--disable-accelerated-video-decode",
      ],
      { cwd: ROOT, detached: false, stdio: "ignore" },
    );
    children.push(appProcess);
    console.log("app:", appProcess.pid);

    await waitFor(
      async () => {
        try {
          const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
          return list.some((t) => t.type === "page" && t.url.startsWith("app://"));
        } catch {
          return false;
        }
      },
      { timeout: 30000, label: "app devtools" },
    );
    await sleep(2500);

    const cdp = await connect(PORT);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // Skip onboarding, then reload so it never paints.
    await cdp.evaluate(
      `localStorage.setItem("creator-screen-onboarding", "true"); "seeded"`,
    );
    await cdp.send("Page.reload");
    await sleep(2500);
    await cdp.evaluate(HELPERS);

    const setViewport = (width, height) =>
      cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });

    const shoot = async (name, width, height) => {
      await setViewport(width, height);
      await sleep(1200);
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "webp",
        quality: 82,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
      });
      const bytes = Buffer.from(shot.result.data, "base64");
      await writeFile(join(OUT_DIR, `${name}.webp`), bytes);
      console.log(`shot ${name}.webp ${width}x${height} ${bytes.length} bytes`);
      return bytes.length;
    };

    const clickText = async (text) => {
      const result = await cdp.evaluate(`window.__cs.clickText(${JSON.stringify(text)})`);
      if (result !== "ok") throw new Error(`clickText(${text}) -> ${result}`);
      console.log(`clicked "${text}"`);
    };

    const pickDemoWindow = async () => {
      await clickText("Select screen");
      await waitFor(
        async () => Boolean(await cdp.evaluate("window.__cs.dialogText()")),
        { label: "source picker" },
      );

      // The picker lists window titles; the demo stage is the only window we
      // want, and picking it also proves the picker really works.
      await waitFor(
        async () =>
          (await cdp.evaluate(
            `[...document.querySelectorAll("button")].some((b) => (b.innerText || "").includes(${JSON.stringify(
              DEMO_TITLE,
            )}))`,
          )) === true,
        { label: "demo window in picker" },
      );
      const picked = await cdp.evaluate(
        `window.__cs.clickText(${JSON.stringify(DEMO_TITLE)})`,
      );
      if (picked !== "ok") throw new Error(`pick demo window -> ${picked}`);
      console.log("picked the demo window as the shared source");
    };

    const waitForScreenPreview = () =>
      waitFor(
        async () => {
          // The camera preview is also a <video>; the shared screen is the
          // first one in the DOM, so require both and check the first.
          const states = await cdp.evaluate("window.__cs.videoStates()");
          return (
            Array.isArray(states) &&
            states.length >= 2 &&
            states[0].w > 0 &&
            states[0].h > 0 &&
            states[0].t > 1
          );
        },
        { timeout: 25000, label: "screen preview playing" },
      );

    // --- set the stage -----------------------------------------------------
    const cameraResult = await cdp.evaluate(`window.__cs.clickAria("Kamera mati")`);
    if (cameraResult !== "ok") throw new Error(`enable camera -> ${cameraResult}`);
    console.log("camera on (synthetic device)");

    await waitFor(
      async () => {
        const states = await cdp.evaluate("window.__cs.videoStates()");
        return Array.isArray(states) && states.some((v) => v.w > 0);
      },
      { timeout: 20000, label: "camera preview" },
    );

    // Note: no screenshot of the picker. Chromium lists every window on this
    // machine, so such a shot would publish the owner's private window titles.
    await pickDemoWindow();
    await waitForScreenPreview();
    console.log("screen source attached and playing");

    // --- shots -------------------------------------------------------------
    await shoot("hero", 2560, 1440);
    await shoot("editor", 1600, 1200);

    // Scene 2 gets its own source, so the shot shows scenes really switching.
    await clickText("2. Browser");
    await sleep(800);
    await pickDemoWindow();
    await waitForScreenPreview();
    await shoot("scenes", 1600, 1200);

    // Recording: the app goes fullscreen and strips the UI marked `no-record`.
    await clickText("Record HD");
    await waitFor(
      async () => (await cdp.evaluate(`window.__cs.buttonTexts()`)).includes("Stop"),
      { timeout: 20000, label: "recording to start" },
    );
    await sleep(4500);
    await shoot("recording", 1600, 1200);

    await clickText("Stop");
    // The app now asks where to save, natively. Cancel it: this run must not
    // write a file, and the dialog is not part of the page anyway.
    await sleep(2500);
    const dismissed = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$w = New-Object -ComObject WScript.Shell; if ($w.AppActivate("Simpan rekaman")) { Start-Sleep -Milliseconds 300; $w.SendKeys("{ESC}") } else { "no dialog" }`,
      ],
      { encoding: "utf8" },
    );
    console.log("save dialog:", (dismissed.stdout || "").trim() || "dismissed");
    await sleep(1500);

    cdp.close();
  } finally {
    for (const child of children.reverse()) {
      if (!child.killed) child.kill();
    }
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
});

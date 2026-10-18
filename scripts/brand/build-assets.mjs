/**
 * Generate the brand image assets from the single geometry source
 * (`app/lib/mark.json`):
 *
 *   app/icon.svg      favicon (modern browsers)
 *   app/favicon.ico   favicon (fallback, replaces the create-next-app one)
 *   assets/icon.png   256px render, reused for link previews
 *   assets/icon.ico   multi-size Windows icon for the installer
 *
 * Run with the project's own Electron — no extra dependency, and the same
 * Chromium that renders the app:
 *
 *   node_modules/.pnpm/electron@44.9.0/node_modules/electron/dist/electron.exe scripts/brand/build-assets.mjs
 *
 * Note: exactly one window is created and resized per target size. Creating a
 * second BrowserWindow after destroying the first hangs this setup, and
 * `app.disableHardwareAcceleration()` makes `transparent: true` capture opaque.
 */
import { app, BrowserWindow } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const TMP = join(tmpdir(), "creator-screen-brand");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

app.commandLine.appendSwitch("force-color-profile", "srgb");

function tileSvg(mark) {
  const { frame, card, tile, colors } = mark;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" width="${tile.size}" height="${tile.size}">`,
    `<rect x="0" y="0" width="${tile.size}" height="${tile.size}" rx="${tile.rx}" fill="${colors.ink}"/>`,
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${frame.rx}" fill="none" stroke="${colors.paper}" stroke-width="${frame.strokeWidth}"/>`,
    `<rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="${card.rx}" fill="${colors.brand}" stroke="${colors.ink}" stroke-width="${card.strokeWidth}"/>`,
    "</svg>",
  ].join("");
}

/** The tile fills whatever viewport it is given, so one page serves every size. */
function tilePage(svg) {
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%}
    svg{display:block;width:100%;height:100%}
  </style>${svg}`;
}

/** Assemble a PNG-compressed .ico: 6-byte header, 16-byte entries, then payloads. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const at = index * 16;
    const dimension = entry.size >= 256 ? 0 : entry.size;
    directory.writeUInt8(dimension, at);
    directory.writeUInt8(dimension, at + 1);
    directory.writeUInt8(0, at + 2); // palette size
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(entry.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}

async function main() {
  const mark = JSON.parse(await readFile(join(ROOT, "app/lib/mark.json"), "utf8"));
  const svg = tileSvg(mark);

  await mkdir(TMP, { recursive: true });
  const page = join(TMP, "tile.html");
  await writeFile(page, tilePage(svg));

  const win = new BrowserWindow({
    width: 256,
    height: 256,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { backgroundThrottling: false, paintWhenInitiallyHidden: true },
  });
  await win.loadFile(page);
  await new Promise((r) => setTimeout(r, 300));

  const rendered = [];
  for (const size of SIZES) {
    // The window stays at 256px (Windows enforces a minimum window size, so
    // resizing it produced mis-sized captures for 16/24/32). Instead the tile is
    // drawn at the target size and the capture is cropped to it, which keeps
    // every size rasterised natively instead of downscaled from 256.
    await win.webContents.executeJavaScript(
      `(() => { const s = document.querySelector("svg"); s.style.width = "${size}px"; s.style.height = "${size}px"; return "resized"; })()`,
    );
    await new Promise((r) => setTimeout(r, 250));

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    if (image.isEmpty()) throw new Error(`empty capture at ${size}px`);
    const got = image.getSize();
    if (got.width !== size || got.height !== size) {
      throw new Error(`captured ${got.width}x${got.height} instead of ${size}x${size}`);
    }

    const bitmap = image.toBitmap();
    const cornerAlpha = bitmap[3];
    const centre = Math.floor(size / 2);
    const centreAlpha = bitmap[(centre * size + centre) * 4 + 3];
    const png = image.toPNG();
    rendered.push({ size, png });
    console.log(
      `rendered ${size}x${size} (${png.length} bytes) cornerAlpha=${cornerAlpha} centreAlpha=${centreAlpha}`,
    );
  }

  const largest = rendered.find((entry) => entry.size === 256);
  if (!largest) throw new Error("missing 256px render");
  const ico = buildIco(rendered);

  await mkdir(join(ROOT, "assets"), { recursive: true });
  await writeFile(join(ROOT, "app/icon.svg"), `${svg}\n`);
  console.log("wrote app/icon.svg");
  await writeFile(join(ROOT, "app/favicon.ico"), ico);
  console.log(`wrote app/favicon.ico (${ico.length} bytes)`);
  await writeFile(join(ROOT, "assets/icon.ico"), ico);
  console.log(`wrote assets/icon.ico (${ico.length} bytes)`);
  await writeFile(join(ROOT, "assets/icon.png"), largest.png);
  console.log(`wrote assets/icon.png (${largest.png.length} bytes)`);
}

app.whenReady().then(async () => {
  try {
    await main();
    app.exit(0);
  } catch (error) {
    console.error("FAILED:", error);
    app.exit(1);
  }
});

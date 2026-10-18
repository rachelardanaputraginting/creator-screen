// Next's static export writes `out/app.html`, but a plain static host asked for
// `/app` looks for `out/app/index.html` and does not know about `public/_redirects`
// (that file is a Cloudflare Pages feature). Writing the copy keeps the deep link
// `https://creator.chelution.com/app` working on any host, not just Cloudflare.
//
// `out/app.html` is kept as-is: the desktop app loads `app://bundle/app.html`,
// so that exact file has to stay where it is. This is why `trailingSlash` is not
// enabled in next.config.ts - it would emit only the directory form.
//
//   node scripts/export-app-route.mjs [outDir]
import { copyFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const OUT_DIR = resolve(process.argv[2] ?? "out");
const SOURCE = join(OUT_DIR, "app.html");
const TARGET_DIR = join(OUT_DIR, "app");
const TARGET = join(TARGET_DIR, "index.html");

await mkdir(TARGET_DIR, { recursive: true });
await copyFile(SOURCE, TARGET);
console.log(`app route: ${SOURCE} -> ${TARGET}`);

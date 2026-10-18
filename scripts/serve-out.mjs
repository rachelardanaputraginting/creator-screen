// Serve a static export the way the host will: extensionless paths fall back to
// `<path>.html`, which is what `public/_redirects` does on Cloudflare Pages.
//
//   node scripts/serve-out.mjs [dir] [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "out");
const PORT = Number(process.argv[3] ?? 8901);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const candidates = [];
  if (clean === "/" || clean.endsWith("/")) {
    candidates.push(join(ROOT, clean, "index.html"));
  } else {
    candidates.push(join(ROOT, clean));
    candidates.push(join(ROOT, `${clean}.html`));
    candidates.push(join(ROOT, clean, "index.html"));
  }
  candidates.push(join(ROOT, "404.html"));

  for (const candidate of candidates) {
    const full = resolve(candidate);
    if (!full.startsWith(ROOT)) continue;
    try {
      const info = await stat(full);
      if (info.isFile()) return { full, status: candidate.endsWith("404.html") ? 404 : 200 };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const found = await resolveFile(req.url || "/");
  if (!found) {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  const body = await readFile(found.full);
  res.writeHead(found.status, {
    "content-type": TYPES[extname(found.full).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(body);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`);
});

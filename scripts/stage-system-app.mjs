import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..");

// The app payload every "system Electron" artifact ships: main process files,
// the static renderer and a package.json. No runtime and no node_modules — that
// is what keeps these artifacts around 1 MB instead of ~100 MB.
export function stageSystemApp(stageDir) {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  execFileSync("pnpm", ["build"], { cwd: ROOT, stdio: "inherit" });

  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(join(stageDir, "electron"), { recursive: true });
  cpSync(join(ROOT, "out"), join(stageDir, "out"), { recursive: true });
  for (const file of execFileSync("ls", ["electron"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))) {
    cpSync(join(ROOT, "electron", file), join(stageDir, "electron", file));
  }
  writeFileSync(
    join(stageDir, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        main: "electron/main.js",
      },
      null,
      2
    ) + "\n"
  );
  return pkg;
}

// Resolved through $0 so the same launcher works under /usr, /usr/local and
// ~/.local. `--prod` is required because Electron sets isPackaged inconsistently
// for unpacked app directories, and our main process reads it to skip the dev
// server.
export const LAUNCHER = `#!/bin/sh
# Lightweight build: the Electron runtime comes from the distro package
# (extra/electron on Arch, electron elsewhere) instead of a bundled 200 MB one.
prefix=$(dirname "$(dirname "$(readlink -f "$0")")")
exec electron "$prefix/lib/creator-screen" --prod "$@"
`;

export const DESKTOP_ENTRY = [
  "[Desktop Entry]",
  "Type=Application",
  "Name=Creator Screen",
  "GenericName=Screen recorder",
  "Comment=Perekam layar & overlay streaming",
  "Exec=creator-screen",
  "Icon=creator-screen",
  "Terminal=false",
  "Categories=AudioVideo;Video;",
  "",
].join("\n");

// Files laid out exactly as they belong under an install prefix.
export function stagePrefixPayload(systemDir) {
  const pkgDir = join(systemDir, "usr");
  const appDir = join(pkgDir, "lib", "creator-screen");
  rmSync(pkgDir, { recursive: true, force: true });

  const pkg = stageSystemApp(appDir);
  mkdirSync(join(pkgDir, "bin"), { recursive: true });
  writeFileSync(join(pkgDir, "bin", "creator-screen"), LAUNCHER, { mode: 0o755 });
  mkdirSync(join(pkgDir, "share", "applications"), { recursive: true });
  writeFileSync(join(pkgDir, "share", "applications", "creator-screen.desktop"), DESKTOP_ENTRY);
  mkdirSync(join(pkgDir, "share", "icons", "hicolor", "512x512", "apps"), { recursive: true });
  cpSync(join(ROOT, "assets", "icon.png"), join(pkgDir, "share", "icons", "hicolor", "512x512", "apps", "creator-screen.png"));

  writeFileSync(
    join(systemDir, "install.sh"),
    `#!/bin/sh
# Copy the bundled usr/ payload into an install prefix. Requires the distro's
# Electron package; pass a prefix you own (e.g. ~/.local) to install without sudo.
set -e
prefix=\${1:-/usr/local}
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
cp -a "$here/usr/." "$prefix/"
echo "Creator Screen terpasang di $prefix — jalankan: creator-screen"
`,
    { mode: 0o755 }
  );
  return { pkg, prefixDir: pkgDir };
}

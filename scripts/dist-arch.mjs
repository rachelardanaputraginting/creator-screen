import { execFileSync, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stagePrefixPayload } from "./stage-system-app.mjs";

// Build a pacman package that runs on the SYSTEM Electron (extra/electron),
// so the download is only the app itself instead of a bundled runtime.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PKG = join(ROOT, "dist", "arch");

rmSync(PKG, { recursive: true, force: true });
const { pkg } = stagePrefixPayload(PKG);

execFileSync("tar", ["-czf", join(PKG, "usr.tar.gz"), "-C", PKG, "usr", "install.sh"], {
  cwd: ROOT,
});

writeFileSync(
  join(PKG, "PKGBUILD"),
  `# Maintainer: rachelardanaputraginting
pkgname=creator-screen
pkgver=${pkg.version}
pkgrel=1
pkgdesc="Perekam layar & overlay streaming untuk kreator"
arch=('x86_64')
url='https://chelution.com'
license=('custom')
depends=('electron')
source=('usr.tar.gz')
sha256sums=('SKIP')

package() {
  cp -a usr/. "$pkgdir/usr/"
}
`,
);

// --nodeps: `electron` is a runtime dep of the produced package, not of this
// build, and resolving it would make makepkg shell out to sudo pacman.
const result = spawnSync("makepkg", ["-sf", "--noconfirm", "--nodeps"], {
  cwd: PKG,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const built = execFileSync("ls", [PKG], { encoding: "utf8" })
  .split("\n")
  .find((f) => f.endsWith(".pkg.tar.zst"));
console.log("package:", join(PKG, built || ""));
console.log(
  "install: sudo pacman -U dist/arch/" + (built || "*.pkg.tar.zst") +
  " (pulls extra/electron, ~1 package instead of a bundled runtime)"
);

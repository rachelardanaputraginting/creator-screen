import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stagePrefixPayload } from "./stage-system-app.mjs";

// Distro-agnostic lightweight build: a prefix payload plus install.sh, for
// anyone who already has Electron from their package manager.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = join(ROOT, "dist", "system");

rmSync(OUT, { recursive: true, force: true });
const { pkg } = stagePrefixPayload(OUT);

const artifact = `creator-screen-${pkg.version}-linux-system-electron.tar.gz`;
execFileSync("tar", ["-czf", join(OUT, artifact), "-C", OUT, "usr", "install.sh"], { cwd: ROOT });

console.log(
  `${artifact} (${(execFileSync("stat", ["-c", "%s", join(OUT, artifact)], { encoding: "utf8" }).trim() / 1024 / 1024).toFixed(2)} MB)\n` +
  "install: tar -xzf " + artifact + " && ./install.sh ~/.local   # or: sudo ./install.sh /usr/local"
);

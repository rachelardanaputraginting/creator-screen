"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Trim the bundled Electron runtime before packing. Unused locale packs are a
// free win on every platform. On Linux the software-GL fallback also goes: the
// AppImage is the universal artifact, but a machine without a working GPU
// cannot drive a screen recorder anyway, and the UI was verified to still
// render with --disable-gpu after the removal. Windows keeps its swiftshader
// DLLs because Remote Desktop and VMs are common there.
exports.afterPack = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== "linux" && platform !== "win32") return;

  // afterPack hands us the unpacked Electron layout, not the source app dir.
  const appDir = context.appOutDir;
  const keep = new Set(["en-US.pak", "id.pak"]);
  let removed = 0;

  const drop = (rel) => {
    const target = path.join(appDir, rel);
    if (!fs.existsSync(target)) return;
    removed += fs.statSync(target).size;
    fs.rmSync(target, { force: true, recursive: true });
  };

  const locales = path.join(appDir, "locales");
  if (fs.existsSync(locales)) {
    for (const file of fs.readdirSync(locales)) {
      if (!keep.has(file)) drop(path.join("locales", file));
    }
  }

  if (platform === "linux") {
    for (const file of ["libvk_swiftshader.so", "libvulkan.so.1", "vulkan_swiftshader.json"]) {
      drop(file);
    }
  }

  console.log(`afterPack: stripped ${(removed / 1024 / 1024).toFixed(1)} MB from ${appDir}`);
};

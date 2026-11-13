#!/usr/bin/env bash
# Build the WebKit portal timeout shim (src-tauri/linux/portal-timeout.c) and
# start `tauri dev` with it preloaded.
#
# WebKitGTK 2.54.x uses a 10 ms D-Bus timeout for the ScreenCast portal calls,
# so `getDisplayMedia()` fails with "Unable to open pipewire remote. Error:
# Timeout was reached" whenever the portal needs longer to hand over the
# PipeWire fd. The shim raises that timeout; it changes nothing else.
#
# Usage: pnpm tauri:dev:linux            (or scripts/tauri-dev-linux.sh)
# Debug: PORTAL_TIMEOUT_SHIM_VERBOSE=1 pnpm tauri:dev:linux
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/src-tauri/linux/portal-timeout.c"
out="$root/src-tauri/target/portal-timeout.so"

if [[ ! -f "$out" || "$src" -nt "$out" ]]; then
    mkdir -p "$(dirname "$out")"
    gcc -shared -fPIC -O2 -o "$out" "$src" $(pkg-config --cflags --libs gio-2.0) -ldl
fi

exec env LD_PRELOAD="$out${LD_PRELOAD:+:$LD_PRELOAD}" pnpm tauri dev "$@"

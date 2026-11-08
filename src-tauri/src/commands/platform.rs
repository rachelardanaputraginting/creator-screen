/// Returns the OS platform string, mirroring Node's `process.platform`.
/// The renderer checks this (e.g. `=== "linux"`) to branch Wayland-specific
/// behavior like skipping system-audio loopback.
#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

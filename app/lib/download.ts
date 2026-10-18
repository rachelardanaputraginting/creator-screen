/**
 * The Windows installer this page hands out.
 *
 * `ready` exists so the page can never render a dead download link: the release
 * has to exist first. Until then the button renders an honest note instead, and
 * both the note and this file stay free of invented versions and file sizes.
 */
export interface WindowsInstaller {
    version: string;
    url: string;
    ready: boolean;
}

export const WINDOWS_INSTALLER: WindowsInstaller = {
    version: "0.1.0",
    url: "https://github.com/rachelardanaputraginting/creator-screen/releases/download/v0.1.0/CreatorScreen-Setup-0.1.0.exe",
    ready: true,
};

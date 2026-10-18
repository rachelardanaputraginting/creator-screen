import { WINDOWS_INSTALLER } from "@/app/lib/download";

const SIZES = {
    sm: "gap-2 px-4 py-2.5 text-[0.88rem]",
    md: "gap-2.5 px-5 py-3 text-[0.95rem]",
    lg: "gap-2.5 px-6 py-[0.94rem] text-base",
} as const;

/**
 * The nav is 66px tall next to the wordmark, so its note has to stay short;
 * everywhere else the full sentence fits.
 */
const NOTES = {
    sm: "Installer segera tersedia",
    md: "Installer Windows sedang disiapkan · segera tersedia.",
    lg: "Installer Windows sedang disiapkan · segera tersedia.",
} as const;

const NOTE_SIZES = {
    sm: "text-[0.82rem] whitespace-nowrap",
    md: "text-[0.9rem]",
    lg: "text-[0.9rem]",
} as const;

function WindowsLogo() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
            className="size-[15px] shrink-0 opacity-85"
        >
            <path d="M3 5.6l7.3-1v7.1H3V5.6zm8.5-1.2L21 3v8.7h-9.5V4.4zM3 12.9h7.3v7.1L3 19V12.9zm8.5 0H21V21l-9.5-1.3v-6.8z" />
        </svg>
    );
}

/**
 * Renders the download link only when a real release exists. While
 * `WINDOWS_INSTALLER.ready` is false there is no link, no file size, and no
 * version to show - just a note saying the installer is being prepared.
 */
export default function DownloadButton({
    size = "md",
}: {
    size?: keyof typeof SIZES;
}) {
    if (!WINDOWS_INSTALLER.ready) {
        return (
            <p className={`text-paper/60 ${NOTE_SIZES[size]}`}>
                {NOTES[size]}
            </p>
        );
    }

    return (
        <a
            href={WINDOWS_INSTALLER.url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center rounded-[10px] border border-transparent bg-brand font-semibold text-paper-2 transition-colors hover:bg-brand-ink active:translate-y-px ${SIZES[size]}`}
        >
            <WindowsLogo />
            Download untuk Windows
        </a>
    );
}

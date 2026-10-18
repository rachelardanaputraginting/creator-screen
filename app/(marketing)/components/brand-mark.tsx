import mark from "@/app/lib/mark.json";

/**
 * The brand mark: a screen frame with a camera card stepping out of it - the
 * product's own idea (main content behind, overlay in front).
 *
 * Geometry lives in `app/lib/mark.json` so the generated icon assets
 * (`scripts/brand/build-assets.mjs`) can never drift from what the page draws.
 * The frame inherits `currentColor`; the card is always brand vermilion with a
 * `ring` stroke punching it out of whatever it overlaps.
 */
export default function BrandMark({
    size = 26,
    className,
    ring = mark.colors.paper,
}: {
    size?: number;
    className?: string;
    ring?: string;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={mark.viewBox}
            aria-hidden="true"
            focusable="false"
            className={className}
        >
            <rect
                x={mark.frame.x}
                y={mark.frame.y}
                width={mark.frame.width}
                height={mark.frame.height}
                rx={mark.frame.rx}
                fill="none"
                stroke="currentColor"
                strokeWidth={mark.frame.strokeWidth}
            />
            <rect
                x={mark.card.x}
                y={mark.card.y}
                width={mark.card.width}
                height={mark.card.height}
                rx={mark.card.rx}
                fill={mark.colors.brand}
                stroke={ring}
                strokeWidth={mark.card.strokeWidth}
            />
        </svg>
    );
}

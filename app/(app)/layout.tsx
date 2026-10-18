/**
 * Editor route group.
 *
 * The desktop shell loads the editor directly (see `electron/main.js`), so this
 * branch keeps its own full-height, non-scrolling viewport — the same layout the
 * root body used to provide before the marketing page took over `/`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden flex flex-col">{children}</div>;
}

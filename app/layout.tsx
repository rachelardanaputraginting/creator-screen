import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display face for the marketing page. Bricolage Grotesque is a variable font
// with an optical-size axis, so `opsz` is requested on top of the default `wght`.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for link previews: without this, Next falls back to
  // http://localhost:3000 and no crawler can fetch the preview image.
  metadataBase: new URL("https://creator.chelution.com"),
  title: "Creator Screen",
  description: "Visual compositor for content creation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${manrope.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* No `overflow-hidden` here: the marketing page at `/` scrolls like a
          normal document. The editor route group supplies its own full-height
          non-scrolling wrapper instead. */}
      <body className="min-h-dvh bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("creator-screen-theme")!=="light"){document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}`}
        </Script>
        {children}
      </body>
    </html>
  );
}

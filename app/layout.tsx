import type { Metadata } from "next";
import Script from "next/script";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Creator Screen",
  description: "Visual compositor for content creation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${manrope.variable} h-full antialiased`}
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

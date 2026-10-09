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
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("creator-screen-theme")!=="light"){document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}}`}
        </Script>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

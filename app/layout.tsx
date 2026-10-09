import type { Metadata } from "next";
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
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("creator-screen-theme")!=="light"){document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}`,
        }}
      />
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google"; // Space_Grotesk for editorial headers, Inter for legible body
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Apex | Hybrid Athleticism",
  description: "The most advanced training tool for traversing the extremes. Engineered for the elite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-[#050505] text-white min-h-screen selection:bg-cyan-500/30 selection:text-cyan-50`}
      >
        {children}
      </body>
    </html>
  );
}

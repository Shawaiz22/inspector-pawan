import type { Metadata } from "next";
import { Anek_Devanagari, Anek_Latin } from "next/font/google";
import "./globals.css";

const latin = Anek_Latin({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
const devanagari = Anek_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], display: "swap" });

export const metadata: Metadata = {
  title: "Inspector Pawan",
  description: "Every air reading investigated. Every action followed up.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${latin.variable} ${devanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

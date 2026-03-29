import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AutoSales AI - Sales CRM",
  description:
    "AI-powered sales CRM with automated outreach, pipeline management, and intelligent follow-ups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} flex min-h-screen`}>
        <Sidebar />
        <main className="ml-sidebar flex-1 min-h-screen">{children}</main>
      </body>
    </html>
  );
}

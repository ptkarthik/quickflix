import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { posterFontVariables } from "./fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineAI Studio",
  description: "OTT & cinema release desk and Instagram post studio",
};

import { SidebarLayout } from "@/components/layout/sidebar-layout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${posterFontVariables} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <SidebarLayout>
          {children}
        </SidebarLayout>
      </body>
    </html>
  );
}

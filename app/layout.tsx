import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./light-theme.css";
import "./clarity.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unzoo One Console",
  description:
    "A front-end console prototype for Unzoo One's local-first AI operating system.",
  openGraph: {
    title: "Unzoo One | AI 任务控制台",
    description: "让长期 AI 任务的执行、审批和证据都清晰可见。",
    images: [
      {
        url: "https://unzoo-one-console.matiancheng528.chatgpt.site/og.png",
        width: 1740,
        height: 909,
        alt: "Unzoo One AI 任务控制台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unzoo One | AI 任务控制台",
    description: "让长期 AI 任务的执行、审批和证据都清晰可见。",
    images: ["https://unzoo-one-console.matiancheng528.chatgpt.site/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./light-theme.css";
import "@xterm/xterm/css/xterm.css";
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
  title: "Nissewyn | Your AI helper, on your own computer",
  description:
    "The little helper that lives in your computer: your AI gets a terminal, a browser and a place to work. It works while you sleep, and nothing leaves home.",
  openGraph: {
    title: "Nissewyn | Your AI helper, on your own computer",
    description: "The little helper that lives in your computer. It works while you sleep, and nothing leaves home.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Nissewyn, the little helper that lives in your computer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nissewyn | Your AI helper, on your own computer",
    description: "The little helper that lives in your computer. It works while you sleep, and nothing leaves home.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/nissewyn-favicon.png",
    shortcut: "/nissewyn-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

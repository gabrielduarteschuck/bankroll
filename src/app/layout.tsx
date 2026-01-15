import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ProStake",
    template: "%s | ProStake",
  },
  description:
    "ProStake — dashboard para registrar entradas, acompanhar banca, ROI e relatórios.",
  applicationName: "ProStake",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "ProStake",
    title: "ProStake",
    description:
      "ProStake — dashboard para registrar entradas, acompanhar banca, ROI e relatórios.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "ProStake",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProStake",
    description:
      "ProStake — dashboard para registrar entradas, acompanhar banca, ROI e relatórios.",
    images: ["/og.svg"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

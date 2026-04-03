// Erzwingt dynamisches Rendering für das Root-Layout (verwendet auth() / headers())
export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import SessionProvider from "@/components/providers/SessionProvider";
import ConditionalShell from "@/components/providers/ConditionalShell";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageTracker from "@/components/PageTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FranksFotos – Fotogalerie",
    template: "%s – FranksFotos",
  },
  description: "Franks persönliche Fotogalerie",
  icons: {
    icon: "/logoFF.png",
    apple: "/logoFF.png",
  },
  openGraph: {
    title: "FranksFotos",
    description: "Franks persönliche Fotogalerie",
    type: "website",
    images: [{ url: "/logoFF.png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="de" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" type="image/png" href="/logoFF.png" />
        <link rel="apple-touch-icon" href="/logoFF.png" />
        <link rel="shortcut icon" type="image/png" href="/logoFF.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <SessionProvider session={session}>
          <PageTracker />
          <ConditionalShell header={<Header />} footer={<Footer />}>
            {children}
          </ConditionalShell>
        </SessionProvider>
      </body>
    </html>
  );
}

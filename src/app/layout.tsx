import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EnrichmentProvider } from "@/context/enrichment-context";
import { ScanProvider } from "@/context/scan-context";
import { EnrichmentBar } from "@/components/enrichment-bar";
import { ScanBar } from "@/components/scan-bar";
import { TransferBar } from "@/components/transfer-bar";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Ludotek",
  description: "Personal game collection showcase",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-vault-bg text-vault-text min-h-screen flex`}
      >
        <EnrichmentProvider>
          <ScanProvider>
            <Suspense>
              <Sidebar />
            </Suspense>
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <Suspense>
                <Header />
              </Suspense>
              <main className="flex-1 p-6 pb-20">{children}</main>
            </div>
            <EnrichmentBar />
            <ScanBar />
            <TransferBar />
          </ScanProvider>
        </EnrichmentProvider>
      </body>
    </html>
  );
}

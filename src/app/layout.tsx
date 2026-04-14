import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { EnrichmentProvider } from "@/context/enrichment-context";
import { ScanProvider } from "@/context/scan-context";
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
            {children}
          </ScanProvider>
        </EnrichmentProvider>
      </body>
    </html>
  );
}

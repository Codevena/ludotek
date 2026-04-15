import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
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
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-vault-bg text-vault-text min-h-screen flex`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <EnrichmentProvider>
            <ScanProvider>
              {children}
            </ScanProvider>
          </EnrichmentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

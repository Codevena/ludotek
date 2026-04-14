import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EnrichmentBar } from "@/components/enrichment-bar";
import { ScanBar } from "@/components/scan-bar";
import { TransferBar } from "@/components/transfer-bar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
    </>
  );
}

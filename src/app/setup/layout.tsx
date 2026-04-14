import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup — Ludotek",
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {children}
    </div>
  );
}

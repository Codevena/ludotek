"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SetupRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("skipSetup") === "1") return;

    fetch("/api/setup-status")
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        }
      })
      .catch(() => {
        // Silently fail — don't block home page if status check fails
      });
  }, [router, searchParams]);

  return null;
}

"use client";

import { useState } from "react";

export function ScreenshotGallery({ urls }: { urls: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setSelected(url)}
            className="aspect-video rounded-lg overflow-hidden bg-vault-bg"
          >
            <img
              src={url}
              alt={`Screenshot ${i + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={() => setSelected(null)}
        >
          <img
            src={selected}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}

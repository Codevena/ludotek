"use client";

import { useState, useEffect, useRef } from "react";

interface FilePreviewModalProps {
  deviceId: number;
  filePath: string;
  onClose: () => void;
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];
const TEXT_EXTS = [
  ".txt", ".log", ".cfg", ".ini", ".xml", ".json",
  ".m3u", ".md", ".yaml", ".yml",
];

function formatSize(bytes: number): string {
  if (bytes === 0) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

function getFilename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

type FileType = "image" | "text" | "other";

function classifyFile(path: string): FileType {
  const ext = getExtension(path);
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (TEXT_EXTS.includes(ext)) return "text";
  return "other";
}

export function FilePreviewModal({ deviceId, filePath, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const fileType = classifyFile(filePath);
  const filename = getFilename(filePath);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPreview() {
      setLoading(true);
      setError(null);

      const url = `/api/devices/${deviceId}/files/preview?path=${encodeURIComponent(filePath)}`;

      try {
        if (fileType === "image") {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objUrl;
          setImageUrl(objUrl);
        } else if (fileType === "text") {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
          const data = await res.json();
          setTextContent(data.content ?? "");
          setTruncated(data.truncated === true);
        } else {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load metadata (${res.status})`);
          const data = await res.json();
          const meta: Record<string, string> = {};
          if (data.name) meta["Filename"] = data.name;
          if (data.size != null) meta["Size"] = formatSize(data.size);
          if (data.modifiedAt) meta["Modified"] = new Date(data.modifiedAt).toLocaleString();
          if (data.type) meta["Type"] = data.type;
          setMetadata(meta);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPreview();

    return () => {
      controller.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [deviceId, filePath, fileType]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-vault-surface border border-vault-border rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vault-border">
          <span className="text-sm font-medium text-vault-text truncate mr-3">
            {filename}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-vault-muted hover:text-vault-text transition-colors text-lg leading-none"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-vault-amber border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="text-sm text-red-400 text-center py-8">{error}</div>
          )}

          {!loading && !error && fileType === "image" && imageUrl && (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={filename}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>
          )}

          {!loading && !error && fileType === "text" && textContent !== null && (
            <div>
              <pre className="text-sm text-vault-text bg-vault-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                <code>{textContent}</code>
              </pre>
              {truncated && (
                <p className="mt-2 text-xs text-vault-muted">
                  File truncated at 100 KB...
                </p>
              )}
            </div>
          )}

          {!loading && !error && fileType === "other" && metadata && (
            <div className="space-y-2">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-3 text-sm">
                  <span className="text-vault-muted flex-shrink-0">{key}</span>
                  <span className="text-vault-text">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

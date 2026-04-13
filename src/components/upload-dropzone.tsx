"use client";

import { useCallback, useRef, useState } from "react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]));
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries((results) => resolve(results));
    });
    const nested = await Promise.all(entries.map(traverseEntry));
    return nested.flat();
  }
  return [];
}

export default function UploadDropzone({
  onFilesSelected,
  disabled = false,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const items = e.dataTransfer.items;
      const allFiles: File[] = [];

      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      if (entries.length > 0) {
        const nested = await Promise.all(entries.map(traverseEntry));
        allFiles.push(...nested.flat());
      } else {
        const files = e.dataTransfer.files;
        for (let i = 0; i < files.length; i++) {
          allFiles.push(files[i]);
        }
      }

      if (allFiles.length > 0) onFilesSelected(allFiles);
    },
    [disabled, onFilesSelected],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const arr: File[] = [];
      for (let i = 0; i < files.length; i++) {
        arr.push(files[i]);
      }
      onFilesSelected(arr);
      e.target.value = "";
    },
    [onFilesSelected],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-10 transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : isDragOver
            ? "border-vault-amber bg-vault-amber/5"
            : "border-vault-border hover:border-vault-muted"
      }`}
    >
      <p className="font-heading text-lg text-vault-text">
        {isDragOver ? "Drop files here" : "Drag & drop ROMs here"}
      </p>
      <p className="text-sm text-vault-muted">
        Single files, ZIP archives, or entire folders
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-vault-surface px-4 py-2 text-sm font-medium text-vault-text transition-colors hover:bg-vault-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          Browse Files
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => folderInputRef.current?.click()}
          className="rounded-md bg-vault-surface px-4 py-2 text-sm font-medium text-vault-text transition-colors hover:bg-vault-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          Browse Folder
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

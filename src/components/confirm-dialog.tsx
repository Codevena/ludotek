"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  items?: string[];
  confirmLabel?: string;
  confirmVariant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  items,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === "danger"
      ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
      : confirmVariant === "warning"
        ? "bg-vault-amber/20 text-vault-amber border-vault-amber/30 hover:bg-vault-amber/30"
        : "bg-vault-amber/20 text-vault-amber border-vault-amber/30 hover:bg-vault-amber/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-vault-surface border border-vault-border rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-vault-text">{title}</h3>
          <p className="mt-2 text-sm text-vault-muted">{message}</p>
          {items && items.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-vault-bg border border-vault-border/50 p-3">
              {items.slice(0, 20).map((item) => (
                <div
                  key={item}
                  className="text-xs text-vault-text py-0.5 truncate"
                >
                  {item}
                </div>
              ))}
              {items.length > 20 && (
                <div className="text-xs text-vault-muted pt-1">
                  ...and {items.length - 20} more
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-vault-border bg-vault-bg/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  items?: string[];
  onClose: () => void;
}

export function AlertDialog({
  open,
  title,
  message,
  items,
  onClose,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-vault-surface border border-vault-border rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-vault-text">{title}</h3>
          <p className="mt-2 text-sm text-vault-muted whitespace-pre-wrap">{message}</p>
          {items && items.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-vault-bg border border-vault-border/50 p-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="text-xs text-red-400 py-0.5"
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end px-5 py-4 border-t border-vault-border bg-vault-bg/50">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { FilePanel } from "@/components/file-panel";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { TransferBar } from "@/components/transfer-bar";

interface DeviceOption {
  id: number;
  name: string;
}

export default function FilesPage() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [leftDeviceId, setLeftDeviceId] = useState<number | null>(null);
  const [rightDeviceId, setRightDeviceId] = useState<number | null>(null);
  const [leftPath, setLeftPath] = useState("/");
  const [rightPath, setRightPath] = useState("/");
  const [leftSelection, setLeftSelection] = useState<string[]>([]);
  const [rightSelection, setRightSelection] = useState<string[]>([]);
  const [leftSelectionDeviceId, setLeftSelectionDeviceId] = useState<
    number | null
  >(null);
  const [rightSelectionDeviceId, setRightSelectionDeviceId] = useState<
    number | null
  >(null);
  const [preview, setPreview] = useState<{
    deviceId: number;
    filePath: string;
  } | null>(null);
  const [refreshLeft, setRefreshLeft] = useState(0);
  const [refreshRight, setRefreshRight] = useState(0);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    async function loadDevices() {
      try {
        const res = await fetch("/api/devices");
        if (!res.ok) return;
        const json = await res.json();
        const list: DeviceOption[] = json.devices.map(
          (d: { id: number; name: string }) => ({
            id: d.id,
            name: d.name,
          }),
        );
        setDevices(list);
        if (list.length >= 1) setLeftDeviceId(list[0].id);
        if (list.length >= 2) setRightDeviceId(list[1].id);
      } catch {
        // silently ignore fetch errors
      }
    }
    loadDevices();
  }, []);

  const startTransfer = useCallback(
    async (
      direction: "left-to-right" | "right-to-left",
      mode: "copy" | "move",
    ) => {
      const sourceDeviceId =
        direction === "left-to-right"
          ? leftSelectionDeviceId
          : rightSelectionDeviceId;
      const targetDeviceId =
        direction === "left-to-right" ? rightDeviceId : leftDeviceId;
      const files =
        direction === "left-to-right" ? leftSelection : rightSelection;
      const targetPath =
        direction === "left-to-right" ? rightPath : leftPath;

      if (!sourceDeviceId || !targetDeviceId || files.length === 0) return;

      setTransferring(true);
      try {
        const res = await fetch("/api/devices/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceDeviceId,
            targetDeviceId,
            targetPath,
            files,
            mode,
          }),
        });

        if (!res.ok) {
          console.error("Transfer request failed:", res.status);
          setTransferring(false);
          return;
        }

        // Kick off TransferBar polling
        if (typeof window.__transferBarPoll === "function") {
          window.__transferBarPoll();
        }

        // Poll transfer status until done
        const poll = async () => {
          try {
            const statusRes = await fetch("/api/devices/transfer/status");
            if (!statusRes.ok) {
              setTransferring(false);
              return;
            }
            const status = await statusRes.json();
            if (!status.transferring) {
              setTransferring(false);
              setRefreshLeft((n) => n + 1);
              setRefreshRight((n) => n + 1);
              return;
            }
            setTimeout(poll, 1000);
          } catch {
            setTransferring(false);
          }
        };
        setTimeout(poll, 1000);
      } catch {
        setTransferring(false);
      }
    },
    [
      leftSelectionDeviceId,
      rightSelectionDeviceId,
      leftDeviceId,
      rightDeviceId,
      leftSelection,
      rightSelection,
      leftPath,
      rightPath,
    ],
  );

  const canTransferRight =
    !transferring &&
    leftSelection.length > 0 &&
    leftDeviceId !== null &&
    rightDeviceId !== null;
  const canTransferLeft =
    !transferring &&
    rightSelection.length > 0 &&
    leftDeviceId !== null &&
    rightDeviceId !== null;

  const btnClass =
    "px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-vault-text">File Manager</h1>

      {/* Transfer buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          className={btnClass}
          disabled={!canTransferRight}
          onClick={() => startTransfer("left-to-right", "copy")}
        >
          Copy &rarr;
        </button>
        <button
          className={btnClass}
          disabled={!canTransferRight}
          onClick={() => startTransfer("left-to-right", "move")}
        >
          Move &rarr;
        </button>
        <button
          className={btnClass}
          disabled={!canTransferLeft}
          onClick={() => startTransfer("right-to-left", "copy")}
        >
          &larr; Copy
        </button>
        <button
          className={btnClass}
          disabled={!canTransferLeft}
          onClick={() => startTransfer("right-to-left", "move")}
        >
          &larr; Move
        </button>
      </div>

      {/* Dual panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FilePanel
          side="left"
          devices={devices}
          selectedDeviceId={leftDeviceId}
          onDeviceChange={setLeftDeviceId}
          onSelectionChange={(paths, deviceId) => {
            setLeftSelection(paths);
            setLeftSelectionDeviceId(deviceId);
          }}
          currentPath={leftPath}
          onPathChange={setLeftPath}
          onPreview={(deviceId, filePath) =>
            setPreview({ deviceId, filePath })
          }
          refreshKey={refreshLeft}
        />
        <FilePanel
          side="right"
          devices={devices}
          selectedDeviceId={rightDeviceId}
          onDeviceChange={setRightDeviceId}
          onSelectionChange={(paths, deviceId) => {
            setRightSelection(paths);
            setRightSelectionDeviceId(deviceId);
          }}
          currentPath={rightPath}
          onPathChange={setRightPath}
          onPreview={(deviceId, filePath) =>
            setPreview({ deviceId, filePath })
          }
          refreshKey={refreshRight}
        />
      </div>

      {/* Preview modal */}
      {preview && (
        <FilePreviewModal
          deviceId={preview.deviceId}
          filePath={preview.filePath}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Transfer progress bar */}
      <TransferBar />
    </div>
  );
}

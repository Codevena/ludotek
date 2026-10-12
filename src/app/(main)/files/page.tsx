"use client";

import { useState, useEffect, useCallback } from "react";
import { FilePanel } from "@/components/file-panel";
import type { FilePanelBrowseState } from "@/components/file-panel";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FilePlanPanel, FilePlanHistory } from "@/components/file-plan-panel";
import type { FilePlanView } from "@/lib/file-plans";

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
  const [leftBrowse, setLeftBrowse] = useState<FilePanelBrowseState>({ virtualRoot: false, ready: false });
  const [rightBrowse, setRightBrowse] = useState<FilePanelBrowseState>({ virtualRoot: false, ready: false });
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
  const [plan, setPlan] = useState<FilePlanView | null>(null);
  const [transferError, setTransferError] = useState("");
  const [moveConfirm, setMoveConfirm] = useState<{
    direction: "left-to-right" | "right-to-left";
    files: string[];
  } | null>(null);

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

  const handleLeftSelection = useCallback(
    (paths: string[], deviceId: number) => {
      setLeftSelection(paths);
      setLeftSelectionDeviceId(deviceId);
    },
    [],
  );

  const handleRightSelection = useCallback(
    (paths: string[], deviceId: number) => {
      setRightSelection(paths);
      setRightSelectionDeviceId(deviceId);
    },
    [],
  );

  const handlePreview = useCallback(
    (deviceId: number, filePath: string) => {
      setPreview({ deviceId, filePath });
    },
    [],
  );

  const doTransfer = useCallback(
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

      const targetBrowse = direction === "left-to-right" ? rightBrowse : leftBrowse;
      if (!sourceDeviceId || !targetDeviceId || files.length === 0 || !targetBrowse.ready || targetBrowse.virtualRoot) return;

      setTransferring(true);
      setTransferError("");
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

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transferplan konnte nicht vorbereitet werden.");
        if (!data.plan) throw new Error("Die Transfer-Vorschau fehlt.");
        setPlan(data.plan);
      } catch (error) {
        setTransferError(error instanceof Error ? error.message : "Transferplan konnte nicht vorbereitet werden.");
      } finally {
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
      leftBrowse,
      rightBrowse,
    ],
  );

  const startTransfer = useCallback(
    (
      direction: "left-to-right" | "right-to-left",
      mode: "copy" | "move",
    ) => {
      const files =
        direction === "left-to-right" ? leftSelection : rightSelection;

      if (mode === "move") {
        setMoveConfirm({ direction, files });
        return;
      }

      doTransfer(direction, mode);
    },
    [leftSelection, rightSelection, doTransfer],
  );

  const canTransferRight =
    !transferring &&
    leftSelection.length > 0 &&
    leftDeviceId !== null &&
    rightDeviceId !== null;
  const targetRightReady = rightBrowse.ready && !rightBrowse.virtualRoot;
  const canTransferLeft =
    !transferring &&
    rightSelection.length > 0 &&
    leftDeviceId !== null &&
    rightDeviceId !== null;
  const targetLeftReady = leftBrowse.ready && !leftBrowse.virtualRoot;

  const btnClass =
    "px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-vault-text">File Manager</h1>
      <p className="text-sm text-vault-muted">Dateiaktionen erstellen zunächst eine Vorschau. Erst „Plan ausführen“ verändert Dateien; gespeicherte Pläne bieten Rücknahme und Wiederherstellung.</p>
      {transferError && <p role="alert" className="text-sm text-red-400">{transferError}</p>}

      {/* Transfer buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          className={btnClass}
          disabled={!canTransferRight || !targetRightReady}
          onClick={() => startTransfer("left-to-right", "copy")}
        >
          Copy &rarr;
        </button>
        <button
          className={btnClass}
          disabled={!canTransferRight || !targetRightReady}
          onClick={() => startTransfer("left-to-right", "move")}
        >
          Move &rarr;
        </button>
        <button
          className={btnClass}
          disabled={!canTransferLeft || !targetLeftReady}
          onClick={() => startTransfer("right-to-left", "copy")}
        >
          &larr; Copy
        </button>
        <button
          className={btnClass}
          disabled={!canTransferLeft || !targetLeftReady}
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
          onSelectionChange={handleLeftSelection}
          currentPath={leftPath}
          onPathChange={setLeftPath}
          onBrowseStateChange={setLeftBrowse}
          onPreview={handlePreview}
          refreshKey={refreshLeft}
        />
        <FilePanel
          side="right"
          devices={devices}
          selectedDeviceId={rightDeviceId}
          onDeviceChange={setRightDeviceId}
          onSelectionChange={handleRightSelection}
          currentPath={rightPath}
          onPathChange={setRightPath}
          onBrowseStateChange={setRightBrowse}
          onPreview={handlePreview}
          refreshKey={refreshRight}
        />
      </div>

      {plan && <FilePlanPanel plan={plan} onChanged={(result) => {
        if (["applied", "undone", "compensated", "rolled_back"].includes(result.status)) {
          setRefreshLeft((value) => value + 1); setRefreshRight((value) => value + 1);
        }
      }} />}
      <FilePlanHistory onChanged={() => { setRefreshLeft((value) => value + 1); setRefreshRight((value) => value + 1); }} />

      {/* Preview modal */}
      {preview && (
        <FilePreviewModal
          deviceId={preview.deviceId}
          filePath={preview.filePath}
          onClose={() => setPreview(null)}
        />
      )}

      <ConfirmDialog
        open={moveConfirm !== null}
        title="Verschiebeplan vorbereiten"
        message={`${moveConfirm?.files.length ?? 0} Dateien prüfen? Die Vorschau verändert keine Dateien. Bei der späteren Ausführung bleiben Quelldateien in der Quarantäne wiederherstellbar.`}
        items={moveConfirm?.files.map(f => f.split("/").pop() ?? f)}
        confirmLabel="Vorschau erstellen"
        confirmVariant="warning"
        onConfirm={() => {
          if (moveConfirm) {
            const { direction } = moveConfirm;
            setMoveConfirm(null);
            doTransfer(direction, "move");
          }
        }}
        onCancel={() => setMoveConfirm(null)}
      />
    </div>
  );
}

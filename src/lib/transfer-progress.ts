export interface TransferProgress {
  transferring: boolean;
  currentFile: string;
  progress: number; // 0-100 for current file
  completedFiles: number;
  totalFiles: number;
  mode: "copy" | "move";
  error?: string;
}

const DEFAULT_PROGRESS: TransferProgress = {
  transferring: false,
  currentFile: "",
  progress: 0,
  completedFiles: 0,
  totalFiles: 0,
  mode: "copy",
};

let transferProgress: TransferProgress = { ...DEFAULT_PROGRESS };

export function getTransferProgress(): TransferProgress {
  return { ...transferProgress };
}

export function setTransferProgress(
  update: Partial<TransferProgress>,
): void {
  transferProgress = { ...transferProgress, ...update };
}

export function clearTransferProgress(): void {
  transferProgress = { ...DEFAULT_PROGRESS };
}

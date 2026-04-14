export interface ScanProgress {
  scanning: boolean;
  progress: number; // 0-100
  status: string;
  gamesFound: number;
  newGames: number;
  updatedGames: number;
  totalPaths: number;
  completedPaths: number;
  deviceName: string;
  error?: string;
}

const store = new Map<string, ScanProgress>();

// Only one scan at a time — use a fixed key
const SCAN_KEY = "current";

export function getScanProgress(): ScanProgress | null {
  return store.get(SCAN_KEY) ?? null;
}

export function setScanProgress(progress: ScanProgress): void {
  store.set(SCAN_KEY, progress);
}

export function clearScanProgress(): void {
  store.delete(SCAN_KEY);
}

export function isScanRunning(): boolean {
  const p = store.get(SCAN_KEY);
  return p?.scanning === true;
}

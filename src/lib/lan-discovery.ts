import { createHash } from "node:crypto";
import { isIP, Socket } from "node:net";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

export interface LanInterfaceChoice {
  id: string;
  name: string;
  address: string;
  subnet: string | null;
  family: "IPv4" | "IPv6";
  available: boolean;
  hostCount: number;
  reason?: string;
}
export interface LanSelection {
  host: string;
  port: 22 | 21;
  protocol: "ssh" | "ftp";
  type?: "custom";
}
export interface LanResult extends LanSelection { hint: string }
export interface LanDiscoverySummary {
  total: number;
  completed: number;
  results: LanResult[];
  stopped: boolean;
  reason?: string;
}
type Snapshot = Record<string, NetworkInterfaceInfo[] | undefined>;
type SelectedInterface = { choice: LanInterfaceChoice; hosts: string[] };
type Probe = (host: string, port: 22 | 21, signal: AbortSignal, timeoutMs: number) => Promise<boolean>;
const MAX_ADDRESSES = 256;
const CONCURRENCY = 8;
const CONNECT_MS = 650;
const TOTAL_MS = 45000;

function ipv4(address: string): bigint | null {
  if (isIP(address) !== 4) return null;
  return address.split(".").reduce((value, octet) => value * BigInt(256) + BigInt(octet), BigInt(0));
}
function ipv6(address: string): bigint | null {
  // No scoped, mapped or dotted addresses: the chosen subnet has to be unambiguous.
  if (isIP(address) !== 6 || address.includes("%") || address.includes(".")) return null;
  const halves = address.toLowerCase().split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  if (words.length !== 8) return null;
  return words.reduce((value, word) => value * BigInt(65536) + BigInt(parseInt(word, 16)), BigInt(0));
}
function privateAddress(value: bigint, family: "IPv4" | "IPv6"): boolean {
  if (family === "IPv6") return value >> BigInt(121) === BigInt(126); // fc00::/7 ULA only
  const first = Number(value >> BigInt(24));
  const second = Number((value >> BigInt(16)) & BigInt(255));
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
function formatAddress(value: bigint, family: "IPv4" | "IPv6"): string {
  if (family === "IPv4") return [24, 16, 8, 0].map((shift) => String(Number((value >> BigInt(shift)) & BigInt(255)))).join(".");
  return [112, 96, 80, 64, 48, 32, 16, 0].map((shift) => ((value >> BigInt(shift)) & BigInt(65535)).toString(16)).join(":");
}
function allChoices(snapshot: Snapshot): SelectedInterface[] {
  const own = new Set(Object.values(snapshot).flatMap((entries) => (entries ?? []).flatMap((entry) => {
    const value = ipv4(entry.address) ?? ipv6(entry.address);
    return value === null ? [] : [`${isIP(entry.address)}:${value}`];
  })));
  const selections: SelectedInterface[] = [];
  for (const [name, entries] of Object.entries(snapshot)) for (const entry of entries ?? []) {
    if (entry.internal) continue;
    const family = isIP(entry.address) === 4 ? "IPv4" : "IPv6";
    const address = family === "IPv4" ? ipv4(entry.address) : ipv6(entry.address);
    if (address === null || !privateAddress(address, family)) continue;
    const id = createHash("sha256").update(JSON.stringify([name, entry.address, entry.netmask, entry.cidr])).digest("hex");
    const choice: LanInterfaceChoice = { id, name, address: entry.address, subnet: entry.cidr, family, available: false, hostCount: 0 };
    const hosts: string[] = [];
    const bits = family === "IPv4" ? 32 : 128;
    const parse = family === "IPv4" ? ipv4 : ipv6;
    const cidr = entry.cidr?.split("/");
    const prefix = cidr?.length === 2 && /^\d+$/.test(cidr[1]) ? Number(cidr[1]) : -1;
    const mask = parse(entry.netmask);
    const expectedMask = prefix >= 0 && prefix <= bits ? ((BigInt(1) << BigInt(bits)) - BigInt(1)) ^ ((BigInt(1) << BigInt(bits - prefix)) - BigInt(1)) : null;
    if (prefix < 0 || prefix > bits || !cidr || parse(cidr[0]) !== address || mask !== expectedMask) {
      choice.reason = "Das lokale Subnetz ist nicht eindeutig belegt.";
    } else if (bits - prefix > 8) {
      choice.reason = family === "IPv6"
        ? "Dieses IPv6-Subnetz ist zu groß für eine sichere automatische Suche; IPv4 oder manuelle Geräteanlage verwenden."
        : "Dieses Subnetz umfasst mehr als 256 Adressen; das Gerät manuell hinzufügen.";
    } else {
      const first = address & mask!;
      const count = 2 ** (bits - prefix);
      const last = first + BigInt(count - 1);
      if (count > MAX_ADDRESSES || !privateAddress(first, family) || !privateAddress(last, family)) {
        choice.reason = "Das Subnetz liegt nicht vollständig im privaten Adressbereich.";
      } else {
        for (let offset = 1; offset < count; offset++) {
          // IPv4 broadcast and subnet-router anycast (IPv6 offset zero) are never probed.
          if (family === "IPv4" && offset === count - 1) continue;
          const value = first + BigInt(offset);
          if (!own.has(`${family === "IPv4" ? 4 : 6}:${value}`)) hosts.push(formatAddress(value, family));
        }
        choice.hostCount = hosts.length;
        choice.available = hosts.length > 0;
        if (!choice.available) choice.reason = "In diesem Subnetz gibt es keine weiteren geeigneten Adressen.";
      }
    }
    selections.push({ choice, hosts });
  }
  return selections;
}

/** Pure fixture-friendly derivation; callers cannot supply hosts or an arbitrary subnet. */
export function interfaceChoices(snapshot: Snapshot = networkInterfaces()): LanInterfaceChoice[] {
  return allChoices(snapshot).map(({ choice }) => choice);
}
export function resolveInterface(id: string, snapshot: Snapshot = networkInterfaces()): SelectedInterface {
  const selected = allChoices(snapshot).find(({ choice }) => choice.id === id && choice.available);
  if (!selected) throw new Error("Die Netzwerkschnittstelle ist nicht mehr verfügbar oder für die begrenzte Suche ungeeignet.");
  return selected;
}

/** A TCP handshake only: no banners, protocol commands, passwords or DNS lookup. */
export async function probeTcp(host: string, port: 22 | 21, signal: AbortSignal, timeoutMs = CONNECT_MS, createSocket: () => Socket = () => new Socket(), localAddress?: string): Promise<boolean> {
  const family = isIP(host);
  const value = family === 4 ? ipv4(host) : ipv6(host);
  if (![4, 6].includes(family) || value === null || !privateAddress(value, family === 4 ? "IPv4" : "IPv6") || ![21, 22].includes(port)) throw new Error("Invalid LAN probe");
  if (localAddress !== undefined) {
    const source = family === 4 ? ipv4(localAddress) : ipv6(localAddress);
    if (isIP(localAddress) !== family || source === null || !privateAddress(source, family === 4 ? "IPv4" : "IPv6")) throw new Error("Invalid LAN source");
  }
  if (signal.aborted) return false;
  return new Promise<boolean>((resolve) => {
    const socket = createSocket();
    let open = false;
    const stop = () => { socket.destroy(); };
    const connected = () => { open = !signal.aborted; stop(); };
    const failed = () => { open = false; stop(); };
    const timer = setTimeout(stop, timeoutMs);
    const closed = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      socket.removeListener("connect", connected);
      socket.removeListener("error", failed);
      socket.removeListener("close", closed);
      resolve(open && !signal.aborted);
    };
    signal.addEventListener("abort", stop, { once: true });
    socket.once("connect", connected);
    socket.on("error", failed);
    socket.once("close", closed);
    try { socket.connect({ host, port, family, ...(localAddress ? { localAddress } : {}) }); } catch { failed(); }
  });
}

export async function discoverLan(selected: SelectedInterface, options: {
  signal: AbortSignal;
  probe?: Probe;
  assertActive?: () => Promise<void>;
  onProgress?: (progress: { completed: number; total: number; result?: LanResult }) => void;
}): Promise<LanDiscoverySummary> {
  if (!selected.choice.available || selected.hosts.length > MAX_ADDRESSES || selected.hosts.length === 0) throw new Error("Invalid LAN selection");
  const controller = new AbortController();
  let reason = "Suche abgebrochen.";
  const abort = () => { controller.abort(); };
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const timer = setTimeout(() => { reason = "Zeitlimit der LAN-Suche erreicht."; abort(); }, TOTAL_MS);
  const tasks = selected.hosts.flatMap((host) => [{ host, port: 22 as const }, { host, port: 21 as const }]);
  const results: LanResult[] = [];
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (!controller.signal.aborted && cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        await options.assertActive?.();
        if (controller.signal.aborted) break;
        const probe = options.probe ?? ((host, port, signal, timeoutMs) => probeTcp(host, port, signal, timeoutMs, undefined, selected.choice.address));
        const open = await probe(task.host, task.port, controller.signal, CONNECT_MS);
        completed++;
        let result: LanResult | undefined;
        if (open && !controller.signal.aborted) {
          result = { ...task, protocol: task.port === 22 ? "ssh" : "ftp", type: "custom",
            hint: task.port === 22 ? "SSH erreichbar; möglicherweise Steam Deck oder ein anderes SSH-Gerät. Modell bitte selbst prüfen."
              : "FTP erreichbar; möglicherweise Retroid, Miyoo oder ein anderes FTP-Gerät. Modell bitte selbst prüfen." };
          results.push(result);
        }
        options.onProgress?.({ completed, total: tasks.length, result });
      } catch {
        reason = "Die Suche konnte nicht sicher fortgesetzt werden.";
        abort();
      }
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker)); }
  finally { clearTimeout(timer); options.signal.removeEventListener("abort", abort); }
  return { total: tasks.length, completed, results, stopped: controller.signal.aborted, ...(controller.signal.aborted ? { reason } : {}) };
}

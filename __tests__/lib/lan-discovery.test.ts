import { EventEmitter } from "node:events";
import type { NetworkInterfaceInfo } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverLan, interfaceChoices, probeTcp, resolveInterface } from "@/lib/lan-discovery";

function nic(address: string, netmask: string, cidr: string | null, internal = false): NetworkInterfaceInfo {
  return { address, netmask, family: address.includes(":") ? "IPv6" : "IPv4", mac: "00:00:00:00:00:00", internal, cidr } as NetworkInterfaceInfo;
}
const interfaces = () => ({ fixture: [nic("192.168.45.2", "255.255.255.248", "192.168.45.2/29")] });
afterEach(() => { vi.useRealTimers(); });

describe("bounded LAN discovery", () => {
  it("offers only actual private interfaces and excludes network, broadcast and all own addresses", () => {
    const snapshot = { ...interfaces(), second: [nic("192.168.45.3", "255.255.255.248", "192.168.45.3/29")],
      public: [nic("203.0.113.2", "255.255.255.0", "203.0.113.2/24")], loop: [nic("127.0.0.1", "255.0.0.0", "127.0.0.1/8", true)],
      link: [nic("169.254.1.2", "255.255.0.0", "169.254.1.2/16")] };
    const choices = interfaceChoices(snapshot);
    expect(choices).toHaveLength(2);
    const selected = resolveInterface(choices[0].id, snapshot);
    expect(selected.hosts).toEqual(["192.168.45.1", "192.168.45.4", "192.168.45.5", "192.168.45.6"]);
    expect(choices[0]).toMatchObject({ available: true, hostCount: 4, family: "IPv4" });
  });

  it("rejects forged/stale identifiers and refuses broad or inconsistent subnets", () => {
    const id = interfaceChoices(interfaces())[0].id;
    expect(() => resolveInterface("203.0.113.1", interfaces())).toThrow();
    expect(() => resolveInterface(id, { fixture: [nic("192.168.45.10", "255.255.255.248", "192.168.45.10/29")] })).toThrow();
    const broad = { fixture: [nic("10.1.2.3", "255.0.0.0", "10.1.2.3/8")] };
    const choice = interfaceChoices(broad)[0];
    expect(choice.available).toBe(false);
    expect(() => resolveInterface(choice.id, broad)).toThrow();
    const mismatch = { fixture: [nic("192.168.45.2", "255.255.255.248", "192.168.45.2/24")] };
    expect(interfaceChoices(mismatch)[0].available).toBe(false);
  });

  it("handles small ULA IPv6 subnets and visibly refuses /64, public and link-local enumeration", () => {
    const snapshot = { v6: [nic("fd12:3456::2", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:fff8", "fd12:3456::2/125")],
      broad: [nic("fd12:9999::2", "ffff:ffff:ffff:ffff::", "fd12:9999::2/64")],
      public: [nic("2001:db8::2", "ffff:ffff:ffff:ffff::", "2001:db8::2/64")],
      link: [nic("fe80::2", "ffff:ffff:ffff:ffff::", "fe80::2/64")] };
    const choices = interfaceChoices(snapshot);
    expect(choices).toHaveLength(2);
    expect(choices.find((c) => c.name === "broad")).toMatchObject({ available: false, reason: expect.stringMatching(/IPv6/) });
    const selected = resolveInterface(choices.find((c) => c.name === "v6")!.id, snapshot);
    expect(selected.hosts).toEqual([1, 3, 4, 5, 6, 7].map((n) => `fd12:3456:0:0:0:0:0:${n}`));
  });

  it("probes only selected hosts on ports 22/21, with bounded concurrency and no credential argument", async () => {
    vi.useFakeTimers();
    const selected = resolveInterface(interfaceChoices(interfaces())[0].id, interfaces());
    let active = 0;
    let maximum = 0;
    const probe = vi.fn(async (host: string, port: 22 | 21, signal: AbortSignal, timeoutMs: number) => {
      expect(timeoutMs).toBe(650);
      active++; maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      active--;
      expect(signal.aborted).toBe(false);
      return host.endsWith(".4") && port === 22;
    });
    const promise = discoverLan(selected, { signal: new AbortController().signal, probe });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(maximum).toBeLessThanOrEqual(8);
    expect(probe).toHaveBeenCalledTimes(10);
    expect(probe.mock.calls.every((args) => args.length === 4 && [21, 22].includes(args[1]))).toBe(true);
    expect(result).toMatchObject({ stopped: false, completed: 10, total: 10, results: [{ host: "192.168.45.4", port: 22, protocol: "ssh" }] });
  });

  it("aborts started probes and awaits their drain before returning; queued probes never start", async () => {
    const selected = resolveInterface(interfaceChoices(interfaces())[0].id, interfaces());
    const controller = new AbortController();
    const drains: (() => void)[] = [];
    const probe = vi.fn((_host: string, _port: number, signal: AbortSignal) => new Promise<boolean>((resolve) => {
      signal.addEventListener("abort", () => drains.push(() => resolve(false)), { once: true });
    }));
    let finished = false;
    const promise = discoverLan(selected, { signal: controller.signal, probe }).then((result) => { finished = true; return result; });
    await Promise.resolve();
    controller.abort();
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(drains).toHaveLength(8);
    drains.forEach((drain) => drain());
    expect(await promise).toMatchObject({ stopped: true, completed: 8 });
    expect(probe).toHaveBeenCalledTimes(8);
  });

  it("enforces a total deadline and leaves no timers after all probes drain", async () => {
    vi.useFakeTimers();
    const selected = resolveInterface(interfaceChoices(interfaces())[0].id, interfaces());
    const probe = vi.fn((_host: string, _port: number, signal: AbortSignal) => new Promise<boolean>((resolve) => {
      signal.addEventListener("abort", () => resolve(false), { once: true });
    }));
    const promise = discoverLan(selected, { signal: new AbortController().signal, probe });
    await vi.advanceTimersByTimeAsync(45000);
    expect(await promise).toMatchObject({ stopped: true, reason: expect.stringMatching(/Zeit/), completed: 8 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TCP connect sends no payload and resolves only after destroy/close, including cancellation", async () => {
    vi.useFakeTimers();
    class FakeSocket extends EventEmitter {
      connect = vi.fn(() => this);
      destroy = vi.fn(() => this);
      write = vi.fn();
    }
    const socket = new FakeSocket();
    const controller = new AbortController();
    let complete = false;
    const promise = probeTcp("192.168.45.4", 22, controller.signal, 650, () => socket as never, "192.168.45.2").then((open) => { complete = true; return open; });
    expect(socket.connect).toHaveBeenCalledWith({ host: "192.168.45.4", port: 22, family: 4, localAddress: "192.168.45.2" });
    controller.abort();
    expect(socket.destroy).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(complete).toBe(false);
    socket.emit("close");
    expect(await promise).toBe(false);
    expect(socket.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(socket.listenerCount("error")).toBe(0);
    expect(socket.listenerCount("connect")).toBe(0);
  });

  it("never creates a socket for public, scoped or unsupported-port probes", async () => {
    class FakeSocket extends EventEmitter {
      connect = vi.fn(() => { queueMicrotask(() => this.emit("error", new Error("fixture"))); return this; });
      destroy = vi.fn(() => { queueMicrotask(() => this.emit("close")); return this; });
    }
    const factory = vi.fn(() => new FakeSocket() as never);
    for (const host of ["203.0.113.1", "127.0.0.1", "169.254.2.3", "2001:db8::1", "fe80::2%en0", "device.local"]) {
      await expect(probeTcp(host, 22, new AbortController().signal, 650, factory)).rejects.toThrow("Invalid LAN probe");
    }
    await expect(probeTcp("192.168.45.4", 80 as never, new AbortController().signal, 650, factory)).rejects.toThrow("Invalid LAN probe");
    await expect(probeTcp("192.168.45.4", 22, new AbortController().signal, 650, factory, "203.0.113.1")).rejects.toThrow("Invalid LAN source");
    await expect(probeTcp("192.168.45.4", 22, new AbortController().signal, 650, factory, "fd12::2")).rejects.toThrow("Invalid LAN source");
    expect(factory).not.toHaveBeenCalled();
  });

  it("bounds an individual TCP connect and awaits close after its deadline", async () => {
    vi.useFakeTimers();
    class FakeSocket extends EventEmitter {
      connect = vi.fn(() => this);
      destroy = vi.fn(() => { queueMicrotask(() => this.emit("close")); return this; });
    }
    const socket = new FakeSocket();
    const promise = probeTcp("192.168.45.4", 21, new AbortController().signal, 650, () => socket as never);
    await vi.advanceTimersByTimeAsync(650);
    expect(await promise).toBe(false);
    expect(socket.destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

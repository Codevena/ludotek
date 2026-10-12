import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ interfaces: vi.fn(), socket: vi.fn(), acquire: vi.fn(), close: vi.fn(), assert: vi.fn(), controller: new AbortController() }));
vi.mock("node:os", () => ({ networkInterfaces: deps.interfaces }));
vi.mock("node:net", async (original) => ({ ...await original<typeof import("node:net")>(), Socket: deps.socket }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireScopedJob: deps.acquire }));
import { AdmissionError } from "@/lib/job-admission";
import { GET, POST } from "@/app/api/devices/discovery/route";
import { EventEmitter } from "node:events";

const snapshot = () => ({ fixture: [{ address: "192.168.45.2", netmask: "255.255.255.248", family: "IPv4", internal: false, cidr: "192.168.45.2/29", mac: "00:00:00:00:00:00" }] });
const request = (method: string, body?: string, headers: Record<string, string> = {}) => new NextRequest("http://localhost:3000/api/devices/discovery", { method, ...(body ? { body } : {}), headers: { authorization: "Bearer toy-test-token", ...headers } });
beforeEach(() => {
  vi.clearAllMocks();
  deps.socket.mockReset();
  vi.stubEnv("ADMIN_TOKEN", "toy-test-token");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  deps.interfaces.mockImplementation(snapshot);
  deps.controller = new AbortController();
  deps.assert.mockResolvedValue(undefined);
  deps.close.mockResolvedValue(undefined);
  deps.acquire.mockResolvedValue({ signal: deps.controller.signal, assertActive: deps.assert, close: deps.close, abort: () => deps.controller.abort(), run: (work: () => Promise<unknown>) => work() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
async function selectedId() { const response = await GET(request("GET")); return (await response.json()).interfaces[0].id as string; }

describe("explicit authenticated LAN API", () => {
  it("does not inventory NICs or probe when unauthenticated or from a foreign Origin", async () => {
    expect((await GET(request("GET", undefined, { authorization: "" }))).status).toBe(401);
    expect((await POST(request("POST", "{}", { origin: "http://foreign.invalid" }))).status).toBe(403);
    expect(deps.interfaces).not.toHaveBeenCalled();
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.socket).not.toHaveBeenCalled();
  });

  it("GET only inventories; POST forbids arbitrary hosts, subnets and credentials", async () => {
    const id = await selectedId();
    expect(deps.socket).not.toHaveBeenCalled();
    for (const extra of [{ host: "203.0.113.1" }, { subnet: "192.168.45.0/24" }, { password: "toy" }, { ports: [80] }]) {
      expect((await POST(request("POST", JSON.stringify({ interfaceId: id, ...extra })))).status).toBe(400);
    }
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.socket).not.toHaveBeenCalled();
  });

  it("rejects stale NIC selections before acquiring/probing and caps body bytes", async () => {
    const id = await selectedId();
    deps.interfaces.mockReturnValue({ fixture: [{ ...snapshot().fixture[0], address: "192.168.45.10", cidr: "192.168.45.10/29" }] });
    expect((await POST(request("POST", JSON.stringify({ interfaceId: id })))).status).toBe(400);
    expect((await POST(request("POST", " ".repeat(4097)))).status).toBe(413);
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.socket).not.toHaveBeenCalled();
  });

  it("bounds a stalled request body even when the sender's cancel promise never settles", async () => {
    vi.useFakeTimers();
    const incoming = new ReadableStream<Uint8Array>({ cancel: () => new Promise<void>(() => {}) });
    const input = new NextRequest("http://localhost:3000/api/devices/discovery", { method: "POST", body: incoming, headers: { authorization: "Bearer toy-test-token" }, duplex: "half" } as never);
    const response = POST(input);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await response).status).toBe(408);
    expect(deps.interfaces).not.toHaveBeenCalled();
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.socket).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([409, 503] as const)("starts zero network IO when admission returns %s", async (status) => {
    const id = await selectedId();
    deps.acquire.mockRejectedValue(new AdmissionError(status, "Synthetic unavailable", 7));
    const response = await POST(request("POST", JSON.stringify({ interfaceId: id })));
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(deps.socket).not.toHaveBeenCalled();
  });

  it("revalidates the interface after waiting for admission, before any socket", async () => {
    const id = await selectedId();
    deps.acquire.mockImplementation(async () => {
      deps.interfaces.mockReturnValue({});
      return { signal: deps.controller.signal, assertActive: deps.assert, close: deps.close, abort: () => deps.controller.abort(), run: (work: () => Promise<unknown>) => work() };
    });
    deps.socket.mockImplementation(function () {
      const socket = new EventEmitter() as EventEmitter & { connect: unknown; destroy: unknown };
      socket.destroy = () => { queueMicrotask(() => socket.emit("close")); return socket; };
      socket.connect = () => { queueMicrotask(() => socket.emit("error", new Error("fixture"))); return socket; };
      return socket;
    });
    expect((await POST(request("POST", JSON.stringify({ interfaceId: id })))).status).toBe(400);
    expect(deps.close).toHaveBeenCalledOnce();
    expect(deps.socket).not.toHaveBeenCalled();
  });

  it("streams progress and one cautious result; no protocol writes or device creation occur", async () => {
    const writes = vi.fn();
    const connects = vi.fn();
    deps.socket.mockImplementation(function () {
      const socket = new EventEmitter() as EventEmitter & { connect: unknown; destroy: unknown; write: unknown };
      socket.write = writes;
      socket.destroy = () => { queueMicrotask(() => socket.emit("close")); return socket; };
      socket.connect = (options: { host: string; port: number; localAddress: string }) => {
        connects(options);
        const { host, port } = options;
        queueMicrotask(() => socket.emit(host.endsWith(".4") && port === 22 ? "connect" : "error", new Error("private detail omitted")));
        return socket;
      };
      return socket;
    });
    const response = await POST(request("POST", JSON.stringify({ interfaceId: await selectedId() })));
    const text = await response.text();
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(text).toContain('"type":"result"');
    expect(text).toContain('"host":"192.168.45.4"');
    expect(text).toContain('"type":"done"');
    expect(text).not.toContain("private detail");
    expect(writes).not.toHaveBeenCalled();
    expect(connects.mock.calls.every(([options]) => options.localAddress === "192.168.45.2")).toBe(true);
    expect(deps.acquire.mock.calls[0][0]).toBe("lan-discovery");
    expect(deps.close).toHaveBeenCalledOnce();
  });

  it("holds the lease until cancellation closes every started socket", async () => {
    const sockets: EventEmitter[] = [];
    const destroys = vi.fn();
    deps.socket.mockImplementation(function () {
      const socket = new EventEmitter() as EventEmitter & { connect: unknown; destroy: unknown };
      socket.connect = () => socket;
      socket.destroy = destroys;
      sockets.push(socket);
      return socket;
    });
    const response = await POST(request("POST", JSON.stringify({ interfaceId: await selectedId() })));
    await vi.waitFor(() => expect(sockets).toHaveLength(8));
    const cancelling = response.body!.cancel();
    await Promise.resolve();
    expect(destroys).toHaveBeenCalledTimes(8);
    expect(deps.close).not.toHaveBeenCalled();
    sockets.forEach((socket) => socket.emit("close"));
    await cancelling;
    expect(deps.close).toHaveBeenCalledOnce();
    expect(sockets).toHaveLength(8);
  });
});

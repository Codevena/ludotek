import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ spawn: vi.fn(), available: vi.fn(), stat: vi.fn() }));
vi.mock("child_process", () => ({ spawn: deps.spawn, execFileSync: deps.available }));
vi.mock("node:fs/promises", () => ({ stat: deps.stat }));
import { convert } from "@/lib/converter";
let child: EventEmitter & { kill: ReturnType<typeof vi.fn>; stdout: EventEmitter; stderr: EventEmitter };
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); child = Object.assign(new EventEmitter(), { kill: vi.fn(), stdout: new EventEmitter(), stderr: new EventEmitter() }); deps.spawn.mockReturnValue(child); deps.stat.mockResolvedValue({ size: 1, isFile: () => true }); });
afterEach(() => { vi.useRealTimers(); });
describe("bounded converter cancellation and terminal drain", () => {
  it("kills a running process but does not finish until its close event", async () => {
    const controller = new AbortController(); let done = false;
    const pending = convert({ inputPath: "/own/input.cue", outputPath: "/own/output.chd", format: "chd", signal: controller.signal }).catch((error) => { done = true; return error; });
    controller.abort(); await Promise.resolve(); expect(child.kill).toHaveBeenCalledWith("SIGTERM"); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2000); expect(child.kill).toHaveBeenCalledWith("SIGKILL"); expect(done).toBe(false);
    child.emit("close", null); expect(await pending).toBeInstanceOf(Error); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps DVD/CD/RVZ command contracts and fails nonzero exits", async () => {
    for (const [format, type, command] of [["chd", "dvd", "createdvd"], ["chd", "cd", "createcd"], ["rvz", undefined, "convert"]] as const) {
      const pending = convert({ inputPath: "/own/input.iso", outputPath: "/own/output", format, chdType: type });
      expect(deps.spawn.mock.calls.at(-1)![1][0]).toBe(command); child.emit("close", 0); await pending;
    }
    const failed = convert({ inputPath: "/own/input.iso", outputPath: "/own/output.chd", format: "chd" }); child.emit("close", 1); await expect(failed).rejects.toThrow("exited with code1".replace("code1", "code 1"));
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds elapsed time and diagnostic bytes without abandoning a live process", async () => {
    const pending = convert({ inputPath: "/own/input.cue", outputPath: "/own/output.chd", format: "chd", timeoutMs: 10 }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(10); expect(child.kill).toHaveBeenCalledWith("SIGTERM"); child.emit("close", null); expect(await pending).toHaveProperty("message", "Conversion deadline exceeded");
    const noisy = convert({ inputPath: "/own/input.cue", outputPath: "/own/output.chd", format: "chd" }).catch((error) => error);
    child.stderr.emit("data", Buffer.alloc(1024 * 1024 + 1)); child.emit("close", null); expect(await noisy).toHaveProperty("message", "Conversion diagnostic output exceeds its limit");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("enforces the authoritative output byte budget while running and verifies the final regular output", async () => {
    deps.stat.mockResolvedValue({ size: 2, isFile: () => true }); let done = false;
    const pending = convert({ inputPath: "/own/input.iso", outputPath: "/own/output.chd", format: "chd", maxOutputBytes: 1 }).catch((error) => { done = true; return error; });
    await vi.advanceTimersByTimeAsync(250); expect(child.kill).toHaveBeenCalledWith("SIGTERM"); expect(done).toBe(false); child.emit("close", null);
    expect(await pending).toHaveProperty("message", "Conversion output exceeds its byte budget");
    deps.stat.mockResolvedValue({ size: 1, isFile: () => false });
    const directory = convert({ inputPath: "/own/input.iso", outputPath: "/own/output.chd", format: "chd" }); child.emit("close", 0);
    await expect(directory).rejects.toThrow("verified byte budget"); expect(vi.getTimerCount()).toBe(0);
  });
});

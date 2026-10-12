import { EventEmitter } from "node:events";
import type { Client, ClientChannel } from "ssh2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sshExec } from "@/lib/connection";

class TestChannel extends EventEmitter {
  stderr = new EventEmitter();
  close = vi.fn();
}

function execution(delayed = false) {
  const channel = new TestChannel();
  let callback: (err?: Error, stream?: ClientChannel) => void;
  const conn = {
    exec: vi.fn((_command, cb) => {
      callback = cb;
      if (!delayed) cb(undefined, channel);
    }),
  } as unknown as Client;
  const promise = sshExec(conn, "test command");
  // Observe rejection immediately so fake-timer advancement cannot create an
  // unhandled rejection before the assertion attaches its own handler.
  void promise.catch(() => {});
  return { channel, promise, deliver: (err?: Error) => callback(err, channel as unknown as ClientChannel) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SSH command completion", () => {
  it("waits for close after exit zero and preserves tail stdout", async () => {
    const { channel, promise } = execution();
    const resolved = vi.fn();
    void promise.then(resolved);
    channel.emit("data", Buffer.from("first"));
    channel.emit("exit", 0);
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();
    channel.emit("data", Buffer.from(" tail"));
    channel.emit("close", 0);
    await expect(promise).resolves.toBe("first tail");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects nonzero remote exit instead of reporting success", async () => {
    const { channel, promise } = execution();
    channel.emit("exit", 1);
    channel.emit("close", 1);
    await expect(promise).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a process killed by a signal", async () => {
    const { channel, promise } = execution();
    channel.emit("exit", null, "SIGTERM", false, "terminated");
    channel.emit("close", null, "SIGTERM");
    await expect(promise).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects close without a reported exit status", async () => {
    const { channel, promise } = execution();
    channel.emit("close");
    await expect(promise).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an exec callback error and clears its timer", async () => {
    const { promise, deliver } = execution(true);
    deliver(new Error("exec unavailable"));
    await expect(promise).rejects.toThrow("exec unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timer when exec throws synchronously", async () => {
    const conn = { exec: () => { throw new Error("exec unavailable"); } } as unknown as Client;
    await expect(sshExec(conn, "test")).rejects.toThrow("exec unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["channel", "stderr"] as const)("rejects a %s stream error and settles only once", async (source) => {
    const { channel, promise } = execution();
    const outcome = promise.then(() => "success", (err: Error) => err.message);
    (source === "channel" ? channel : channel.stderr).emit("error", new Error("stream failed"));
    channel.emit("exit", 0);
    channel.emit("close", 0);
    await expect(outcome).resolves.toBe("stream failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects at 15 seconds and closes the active channel once", async () => {
    const { channel, promise } = execution();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(channel.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).rejects.toThrow(/timed out/i);
    expect(channel.close).toHaveBeenCalledTimes(1);
    channel.emit("exit", 0);
    channel.emit("close", 0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes a channel delivered after the command already timed out", async () => {
    const { channel, promise, deliver } = execution(true);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(promise).rejects.toThrow(/timed out/i);
    deliver();
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts exactly 4 MiB combined stdout and stderr", async () => {
    const { channel, promise } = execution();
    channel.emit("data", Buffer.alloc(2 * 1024 * 1024, "a"));
    channel.stderr.emit("data", Buffer.alloc(2 * 1024 * 1024, "b"));
    channel.emit("exit", 0);
    channel.emit("close", 0);
    expect((await promise).length).toBe(2 * 1024 * 1024);
    expect(channel.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["stdout", "stderr"] as const)("rejects when %s takes combined output beyond 4 MiB", async (source) => {
    const { channel, promise } = execution();
    channel.emit("data", Buffer.alloc(2 * 1024 * 1024));
    channel.stderr.emit("data", Buffer.alloc(2 * 1024 * 1024));
    (source === "stdout" ? channel : channel.stderr).emit("data", Buffer.from("x"));
    channel.emit("exit", 0);
    channel.emit("close", 0);
    await expect(promise).rejects.toThrow(/output|limit/i);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

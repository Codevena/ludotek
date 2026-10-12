import { afterEach, expect, it, vi } from "vitest";
import { readBoundedJson } from "@/lib/request-body";
afterEach(() => vi.useRealTimers());
it("counts streamed bytes even when Content-Length lies and cancels excess input", async () => {
  const cancel = vi.fn();
  const request = new Request("http://fixture", { method: "POST", headers: { "Content-Length": "1" }, duplex: "half",
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"long":"value"}')); }, cancel }) } as RequestInit);
  await expect(readBoundedJson(request, 4)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalledOnce();
});
it("bounds a stalled body with an injected fake clock and drains cancellation", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const request = new Request("http://fixture", { method: "POST", duplex: "half", body: new ReadableStream({ cancel }) } as RequestInit);
  const result = expect(readBoundedJson(request, 1024, 10)).rejects.toMatchObject({ status: 408 });
  await vi.advanceTimersByTimeAsync(10);
  await result;
  expect(cancel).toHaveBeenCalledOnce();
});
it("rejects invalid UTF-8 before JSON parsing and allows bounded valid data", async () => {
  await expect(readBoundedJson(new Request("http://fixture", { method: "POST", body: new Uint8Array([0xff]) }))).rejects.toMatchObject({ status: 400 });
  await expect(readBoundedJson(new Request("http://fixture", { method: "POST", body: '{"kind":"copy"}' }))).resolves.toEqual({ kind: "copy" });
});

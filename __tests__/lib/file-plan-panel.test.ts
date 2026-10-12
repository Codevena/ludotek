// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilePlanPanel, FilePlanHistory } from "@/components/file-plan-panel";
import type { FilePlanView } from "@/lib/file-plans";
const id = "12345678-1234-4123-8123-123456789abc";
const ready: FilePlanView = { id, kind: "copy", status: "ready", totalBytes: "4", revision: 0, error: null, createdAt: "2026-10-12T00:00:00.000Z", appliedAt: null,
  operations: [{ id: "op", ordinal: 0, kind: "copy", phase: "planned", error: null, deviceId: 1, filePath: "/roms/Toy.sfc", sourceDeviceId: 1, sourcePath: "/roms/Toy.sfc", targetDeviceId: 2, targetPath: "/other/Toy.sfc", newPath: "/other/Toy.sfc", generated: false, rewritesDescriptor: false, bytes: 4, sourceFingerprint: { sha256: "a".repeat(64), size: 4 } }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("requires explicit apply after preview and offers undo only after actual completion", async () => {
  const fetch = vi.fn(async (url: string) => Response.json({ plan: { ...ready, status: url.endsWith("/undo") ? "undone" : "applied", revision: 1 } }));
  vi.stubGlobal("fetch", fetch);
  render(React.createElement(FilePlanPanel, { plan: ready }));
  expect(screen.getByText("/roms/Toy.sfc")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Rückgängig machen" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Plan ausführen" }));
  const undo = await screen.findByRole("button", { name: "Rückgängig machen" });
  expect(fetch.mock.calls[0][0]).toBe(`/api/file-plans/${id}/apply`);
  fireEvent.click(undo);
  expect(await screen.findByText("Zurückgenommen")).toBeTruthy();
  expect(fetch.mock.calls[1][0]).toBe(`/api/file-plans/${id}/undo`);
});
it("reloads persisted recovery state after an execution failure without inventing success", async () => {
  vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => options?.method === "POST"
    ? Response.json({ error: "Journal unavailable after publication" }, { status: 503 })
    : Response.json({ plan: { ...ready, status: "recovery_needed", revision: 1, error: "Journal unavailable after publication" } }));
  render(React.createElement(FilePlanPanel, { plan: ready }));
  fireEvent.click(screen.getByRole("button", { name: "Plan ausführen" }));
  expect(await screen.findByText("Wiederherstellung nötig")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Wiederherstellung prüfen" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Rückgängig machen" })).toBeNull();
});

it("does not let a late progress response overwrite a confirmed completed plan", async () => {
  vi.useFakeTimers();
  let finishPost!: (value: Response) => void;
  let finishPoll!: (value: Response) => void;
  vi.stubGlobal("fetch", (_url: string, options?: RequestInit) => new Promise<Response>((resolve) => {
    if (options?.method === "POST") finishPost = resolve;
    else finishPoll = resolve;
  }));
  render(React.createElement(FilePlanPanel, { plan: ready }));
  fireEvent.click(screen.getByRole("button", { name: "Plan ausführen" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await act(async () => { finishPost(Response.json({ plan: { ...ready, status: "applied" } })); });
  expect(screen.getByRole("button", { name: "Rückgängig machen" })).toBeTruthy();
  await act(async () => { finishPoll(Response.json({ plan: { ...ready, status: "applying" } })); });
  expect(screen.getByRole("button", { name: "Rückgängig machen" })).toBeTruthy();
});
it("retains its active request when a parent records polled status for the same plan", async () => {
  vi.useFakeTimers(); let finish!: (response: Response) => void; let signal!: AbortSignal;
  vi.stubGlobal("fetch", (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") { signal = options.signal!; return new Promise<Response>((resolve) => { finish = resolve; }); }
    return Promise.resolve(Response.json({ plan: { ...ready, status: "applying" } }));
  });
  function Parent() { const [plan, setPlan] = React.useState(ready); return React.createElement(FilePlanPanel, { plan, onChanged: setPlan }); }
  render(React.createElement(Parent)); fireEvent.click(screen.getByRole("button", { name: "Plan ausführen" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  const wasAborted = signal.aborted;
  await act(async () => { finish(Response.json({ plan: { ...ready, status: "applied" } })); });
  expect(wasAborted).toBe(false);
  expect(screen.getByRole("button", { name: "Rückgängig machen" })).toBeTruthy();
});
it("opens the persisted plan selected by existing profile/save deep links", async () => {
  window.history.replaceState({}, "", `/files?planId=${id}`);
  const calls: string[] = []; vi.stubGlobal("fetch", async (url: string) => { calls.push(url); return Response.json(url === "/api/file-plans" ? { plans: [], nextCursor: null } : { plan: ready }); });
  render(React.createElement(FilePlanHistory));
  expect(await screen.findByText("Dateiplan prüfen")).toBeTruthy();
  expect(calls).toContain(`/api/file-plans/${id}`);
  window.history.replaceState({}, "", "/");
});

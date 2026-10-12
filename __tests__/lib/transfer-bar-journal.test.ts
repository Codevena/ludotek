// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TransferBar } from "@/components/transfer-bar";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(["idle", "error", "ready", "undone"])("never turns partial %s state into success", async (status) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ status, completed: 1, total: 2, progress: 50, mode: "copy" })); vi.stubGlobal("fetch", fetch);
  render(React.createElement(TransferBar)); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText(/Dateiplan abgeschlossen/)).toBeNull();
});
it("shows actual completed journal steps and an Undo link", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "complete", completed: 2, total: 2, progress: 100, mode: "copy", planId: "12345678-1234-4234-9234-123456789abc" })));
  render(React.createElement(TransferBar)); expect(await screen.findByText(/Dateiplan abgeschlossen \(2 Schritte\)/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Rücknahme prüfen" })).toHaveProperty("href", "http://localhost:3000/files?plan=12345678-1234-4234-9234-123456789abc");
});
it("replaces a recent success notification with a newly failed plan", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ status: "complete", completed: 2, total: 2, progress: 100, mode: "copy" })).mockResolvedValue(Response.json({ status: "error", completed: 1, total: 2, progress: 50, mode: "copy", error: "New plan needs recovery" }));
  vi.stubGlobal("fetch", fetch); render(React.createElement(TransferBar)); await screen.findByText(/Dateiplan abgeschlossen/);
  await act(async () => { window.__transferBarPoll?.(); });
  expect(screen.queryByText(/Dateiplan abgeschlossen/)).toBeNull();
  expect(screen.getByText("New plan needs recovery")).toBeTruthy();
});

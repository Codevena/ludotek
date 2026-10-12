// @vitest-environment jsdom

import { createElement, useState } from "react";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileBrowser } from "@/components/file-browser";
import { FilePanel } from "@/components/file-panel";
import FilesPage from "@/app/(main)/files/page";

let sandbox: string;
let root: string;
const calls: string[] = [];

function browseFixture(url: string): Response {
  calls.push(url);
  const requested = new URL(url, "http://localhost").searchParams.get("path");
  if (requested === "/") return Response.json({ path: "/", parent: null, virtualRoot: true, entries: [{ name: "ROM library", type: "dir", size: 0, absolutePath: root }] });
  if (requested === root) return Response.json({ path: root, parent: "/", entries: [{ name: "nes", type: "dir", size: 0, absolutePath: `${root}/nes` }] });
  if (requested === `${root}/nes`) return Response.json({ path: `${root}/nes`, parent: root, entries: [{ name: "game.nes", type: "file", size: 3, absolutePath: `${root}/nes/game.nes` }] });
  return Response.json({ error: "Outside configured fixture" }, { status: 403 });
}

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "ludotek-local-picker-"));
  root = join(sandbox, "roms");
  await mkdir(join(root, "nes"), { recursive: true });
  await writeFile(join(root, "nes", "game.nes"), "ROM");
  root = await realpath(root);
  vi.stubEnv("LOCAL_FILES_ROOT", root);
  vi.stubEnv("LOCAL_FILES_ROOTS", "");
});

afterEach(async () => {
  cleanup();
  calls.length = 0;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(sandbox, { recursive: true, force: true });
});

describe("LOCAL browse clients", () => {
  it("lets setup choose a configured root descendant and uses the server parent", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => browseFixture(url)));
    const add = vi.fn();
    render(createElement(FileBrowser, { deviceId: 1, onAddPath: add, existingPaths: [] }));
    await screen.findByText("ROM library");
    expect((screen.getByRole("button", { name: "+ ROM Path" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("ROM library"));
    await screen.findByText("nes");
    fireEvent.click(screen.getByText("nes"));
    await screen.findByText("game.nes");
    fireEvent.click(screen.getByRole("button", { name: "+ ROM Path" }));
    expect(add).toHaveBeenCalledWith(`${root}/nes`, "rom");
    fireEvent.click(screen.getByTitle("Go to parent"));
    await screen.findByText("nes");
    fireEvent.click(screen.getByTitle("Go to parent"));
    await screen.findByText("ROM library");
    expect(calls.map((url) => new URL(url, "http://localhost").searchParams.get("path"))).toEqual(["/", root, `${root}/nes`, root, "/"]);
  });

  it("prevents virtual-root selection/mkdir and uses absolute entries in FilePanel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => browseFixture(url)));
    const selection = vi.fn();
    const preview = vi.fn();
    function Panel() {
      const [path, setPath] = useState("/");
      return createElement(FilePanel, { side: "left", devices: [{ id: 1, name: "Local" }], selectedDeviceId: 1, onDeviceChange: vi.fn(), onSelectionChange: selection, currentPath: path, onPathChange: setPath, onPreview: preview });
    }
    render(createElement(Panel));
    await screen.findByText("ROM library");
    expect((screen.getByRole("button", { name: "New Folder" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryAllByRole("checkbox").every((box) => (box as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByText("ROM library"));
    await screen.findByText("nes");
    fireEvent.click(screen.getByText("nes"));
    await screen.findByText("game.nes");
    fireEvent.click(screen.getAllByRole("checkbox").at(-1)!);
    await waitFor(() => expect(selection).toHaveBeenLastCalledWith([`${root}/nes/game.nes`], 1));
    fireEvent.click(screen.getByText("game.nes"));
    expect(preview).toHaveBeenCalledWith(1, `${root}/nes/game.nes`);
    fireEvent.click(screen.getByTitle("Go to parent"));
    await screen.findByText("nes");
    fireEvent.click(screen.getByTitle("Go to parent"));
    await screen.findByText("ROM library");
    expect((screen.getByRole("button", { name: "Rename" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.map((url) => new URL(url, "http://localhost").searchParams.get("path"))).toEqual(["/", root, `${root}/nes`, root, "/"]);
  });

  it("uses the canonical response path when setup adds a selected directory", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ path: root, parent: "/", entries: [] })));
    const add = vi.fn();
    render(createElement(FileBrowser, { deviceId: 1, onAddPath: add, existingPaths: [] }));
    await screen.findByText(root);
    fireEvent.click(screen.getByRole("button", { name: "+ ROM Path" }));
    expect(add).toHaveBeenCalledWith(root, "rom");
  });

  it("disables transfer to a virtual target until a configured directory is opened", async () => {
    const transfers: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/devices") return Response.json({ devices: [{ id: 1, name: "Source" }, { id: 2, name: "Local" }] });
      if (url.startsWith("/api/devices/1/browse")) return Response.json({ path: "/source", parent: "/", entries: [{ name: "game.nes", type: "file", size: 3, absolutePath: "/source/game.nes" }] });
      if (url.startsWith("/api/devices/2/browse")) return browseFixture(url);
      if (url === "/api/devices/transfer") {
        transfers.push(JSON.parse(String(options?.body)));
        return Response.json({ error: "Fixture stops before worker" }, { status: 409 });
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(createElement(FilesPage));
    await screen.findByText("ROM library");
    const source = view.container.querySelector('[data-side="left"]') as HTMLElement;
    fireEvent.click(within(source).getAllByRole("checkbox").at(-1)!);
    await waitFor(() => expect(within(source).getByText(/1 selected/)).toBeTruthy());
    const copy = screen.getByRole("button", { name: /^Copy/ }) as HTMLButtonElement;
    const move = screen.getByRole("button", { name: /^Move/ }) as HTMLButtonElement;
    expect(copy.disabled).toBe(true);
    expect(move.disabled).toBe(true);
    fireEvent.click(copy);
    expect(transfers).toEqual([]);
    fireEvent.click(screen.getByText("ROM library"));
    await screen.findByText("nes");
    await waitFor(() => expect(copy.disabled).toBe(false));
    fireEvent.click(copy);
    await waitFor(() => expect(transfers).toEqual([{ sourceDeviceId: 1, targetDeviceId: 2, targetPath: root, files: ["/source/game.nes"], mode: "copy" }]));
    errorLog.mockRestore();
  });
});

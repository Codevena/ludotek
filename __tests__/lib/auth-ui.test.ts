// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SetupPage from "@/app/(setup)/setup/page";
import UploadPage from "@/app/(main)/admin/upload/page";
import AdminPage from "@/app/(main)/admin/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("setup and upload authentication", () => {
  it("keeps setup unavailable until a successful token login, then opens the real wizard", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (init?.method === "POST") return Response.json({ success: true });
      return Response.json({ authRequired: true, configured: true, authenticated: false, mode: "token" });
    });
    render(React.createElement(SetupPage));
    expect(await screen.findByRole("heading", { name: "Sign in to set up Ludotek" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome to Ludotek" })).toBeNull();
    expect(calls.map((call) => call.url)).toEqual(["/api/auth"]);
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "fixture-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Welcome to Ludotek" })).toBeTruthy();
    expect(calls[1]).toEqual({ url: "/api/auth", body: '{"token":"fixture-token"}' });
  });

  it("shows a configuration failure and does not mount setup or offer an ineffective login", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ authRequired: true, configured: false, authenticated: false, error: "Configure ADMIN_TOKEN" }, { status: 503 }));
    render(React.createElement(SetupPage));
    expect(await screen.findByRole("heading", { name: "Server access unavailable" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome to Ludotek" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("opens setup immediately for a server-confirmed existing session", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ authRequired: true, configured: true, authenticated: true, mode: "token" }));
    render(React.createElement(SetupPage));
    expect(await screen.findByRole("heading", { name: "Welcome to Ludotek" })).toBeTruthy();
  });

  it("does not interpret an unconfigured auth response as tokenless upload access", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ authRequired: true, configured: false, authenticated: false, error: "Configure ADMIN_TOKEN" }, { status: 503 }));
    render(React.createElement(UploadPage));
    expect(await screen.findByRole("heading", { name: "Server access unavailable" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Upload ROMs" })).toBeNull();
  });

  it("uses status authentication instead of probing protected settings on the upload page", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ authRequired: true, configured: true, authenticated: false, mode: "token" }));
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(UploadPage));
    expect(await screen.findByRole("heading", { name: "Admin Login" })).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0][0]).toBe("/api/auth");
  });

  it("uses the existing authRequired status for the Admin login without reading settings", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ authRequired: true, configured: true, authenticated: false, mode: "token" }));
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(AdminPage));
    expect(await screen.findByRole("heading", { name: "Admin Login" })).toBeTruthy();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/auth"]);
  });
});

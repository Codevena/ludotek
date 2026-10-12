import { describe, expect, it } from "vitest";
import { chooseSyncAction } from "@/lib/device-profile-sync";
const a = { sha256: "a".repeat(64), size: "3" };
const b = { sha256: "b".repeat(64), size: "3" };
const c = { sha256: "c".repeat(64), size: "3" };
describe("content-baseline two-way decisions", () => {
  it("never picks latestmtime or silently replaces initial differences", () => {
    expect(chooseSyncAction(a, b, null, "two-way")).toMatchObject({ action: "conflict" });
    expect(chooseSyncAction(a, b, null, "push")).toMatchObject({ action: "conflict" });
  });
  it("detects both changed and requires an explicit side selection", () => {
    expect(chooseSyncAction(b, c, { master: a, device: a }, "two-way")).toMatchObject({ action: "conflict" });
    expect(chooseSyncAction(b, c, { master: a, device: a }, "two-way", "master")).toMatchObject({ action: "copy-master" });
    expect(chooseSyncAction(b, c, { master: a, device: a }, "two-way", "device")).toMatchObject({ action: "copy-device" });
    expect(chooseSyncAction(b, c, { master: a, device: a }, "two-way", "skip")).toMatchObject({ action: "skip" });
    expect(chooseSyncAction(b, b, { master: a, device: a }, "two-way")).toMatchObject({ action: "conflict" });
  });
  it("pushes/pulls only the side changed since successful baseline and respects direction", () => {
    expect(chooseSyncAction(b, a, { master: a, device: a }, "two-way")).toMatchObject({ action: "copy-master" });
    expect(chooseSyncAction(a, b, { master: a, device: a }, "two-way")).toMatchObject({ action: "copy-device" });
    expect(chooseSyncAction(a, b, { master: a, device: a }, "push")).toMatchObject({ action: "conflict" });
    expect(chooseSyncAction(b, a, { master: a, device: a }, "pull")).toMatchObject({ action: "conflict" });
  });
  it("compares legitimate descriptor baseline sides independently and never auto-deletes", () => {
    expect(chooseSyncAction(a, b, { master: a, device: b }, "two-way")).toMatchObject({ action: "equal" });
    expect(chooseSyncAction(a, null, { master: a, device: b }, "two-way")).toMatchObject({ action: "conflict" });
    expect(chooseSyncAction(a, null, null, "push")).toMatchObject({ action: "copy-master" });
    expect(chooseSyncAction(null, a, null, "pull")).toMatchObject({ action: "copy-device" });
  });
});

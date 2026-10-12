import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ acquire: vi.fn() }));
vi.mock("@/lib/job-admission", () => ({ acquireScopedJob: mocks.acquire }));
import { acquireDeviceFiles, withDeviceFiles } from "@/lib/device-jobs";
beforeEach(() => vi.clearAllMocks());
const makeJob = () => ({ signal: new AbortController().signal, assertActive: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) });
it("takes ordered distinct locks and releases earlier claims when a later device is busy", async () => {
  const first = makeJob();
  const global = makeJob();
  mocks.acquire.mockResolvedValueOnce(global).mockResolvedValueOnce(first).mockRejectedValueOnce(new Error("busy"));
  await expect(acquireDeviceFiles([9, 2, 9], new Request("http://fixture"))).rejects.toThrow("busy");
  expect(mocks.acquire.mock.calls.map((call) => call[0])).toEqual(["device-files", "files:2", "files:9"]);
  expect(first.close).toHaveBeenCalledOnce();
  expect(global.close).toHaveBeenCalledOnce();
});
it("retains all locks until aborted underlying work has actually drained", async () => {
  const controller = new AbortController();
  const job = { ...makeJob(), signal: controller.signal };
  mocks.acquire.mockResolvedValue(job);
  let finish!: () => void;
  let started!: () => void;
  const began = new Promise<void>((resolve) => { started = resolve; });
  const pending = withDeviceFiles([2], new Request("http://fixture"), async (jobs) => {
    started(); await new Promise<void>((resolve) => { finish = resolve; });
    expect(jobs.signal.aborted).toBe(true);
  });
  await began;
  controller.abort(new Error("lease lost"));
  expect(job.close).not.toHaveBeenCalled();
  finish(); await pending;
  expect(job.close).toHaveBeenCalledTimes(2);
});

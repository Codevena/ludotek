import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { clearCache } from "@/lib/image-cache";
import { withDeviceFiles, assertDeviceJobsOwned } from "@/lib/device-jobs";
import { filePlanFailure } from "@/lib/file-plan-api";

// POST /api/devices/wipe-all — delete ALL games from ALL devices
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const ids = (await prisma.device.findMany({ select: { id: true } })).map((device) => device.id);
    return await withDeviceFiles(ids, request, async (jobs) => {
      await jobs.assertActive();
      await clearCache();
      const gamesRemoved = await prisma.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
        await tx.syncQueue.deleteMany({});
        await tx.gameDevice.deleteMany({});
        const deleted = await tx.game.deleteMany({});
        await tx.deviceInventory.updateMany({ data: { complete: false } });
        await tx.platform.updateMany({ data: { gameCount: 0 } });
        return deleted.count;
      });
      return NextResponse.json({ success: true, gamesRemoved });
    });
  } catch (error) { return filePlanFailure(error); }
}

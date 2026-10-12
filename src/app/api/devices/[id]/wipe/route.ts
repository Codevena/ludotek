import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteGameFiles } from "@/lib/image-cache";
import { withDeviceFiles, assertDeviceJobsOwned } from "@/lib/device-jobs";
import { filePlanFailure } from "@/lib/file-plan-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(request); if (denied) return denied;
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  const deviceId = Number(id);
  try {
    return await withDeviceFiles([deviceId], request, async (jobs) => {
      const result = await prisma.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
        const device = await tx.device.findUnique({ where: { id: deviceId }, select: { name: true } });
        if (!device) return null;
        const { count: linksRemoved } = await tx.gameDevice.deleteMany({ where: { deviceId } });
        await tx.syncQueue.deleteMany({ where: { deviceId } });
        await tx.deviceFile.updateMany({ where: { deviceId }, data: { gameId: null } });
        await tx.deviceInventory.updateMany({ where: { deviceId }, data: { complete: false } });
        const orphaned = await tx.game.findMany({ where: { devices: { none: {} } }, select: { id: true } });
        const orphanIds = orphaned.map((game) => game.id);
        const { count: gamesRemoved } = await tx.game.deleteMany({ where: { id: { in: orphanIds }, devices: { none: {} } } });
        const counts = await tx.game.groupBy({ by: ["platform"], _count: true });
        await tx.platform.updateMany({ data: { gameCount: 0 } });
        for (const count of counts) await tx.platform.updateMany({ where: { id: count.platform }, data: { gameCount: count._count } });
        return { device: device.name, linksRemoved, gamesRemoved, orphanIds };
      });
      if (!result) return NextResponse.json({ error: "Device not found" }, { status: 404 });
      await jobs.assertActive();
      await deleteGameFiles(result.orphanIds);
      return NextResponse.json({ success: true, device: result.device, linksRemoved: result.linksRemoved, gamesRemoved: result.gamesRemoved });
    });
  } catch (error) { return filePlanFailure(error); }
}

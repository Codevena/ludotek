import { NextResponse } from "next/server";

export function validateRemotePath(path: string): NextResponse | null {
  if (typeof path !== "string" || !path || path.trim() === "") {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }
  if (path.includes("\0")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (path.includes("..")) {
    return NextResponse.json(
      { error: "Path must not contain '..'" },
      { status: 400 },
    );
  }
  if (path === "/") {
    return NextResponse.json(
      { error: "Cannot operate on root path" },
      { status: 400 },
    );
  }
  return null;
}

export async function loadDevice(
  id: string,
): Promise<
  | { device: import("@prisma/client").Device; error?: never }
  | { device?: never; error: NextResponse }
> {
  const { prisma } = await import("@/lib/prisma");
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return {
      error: NextResponse.json(
        { error: "Invalid device ID" },
        { status: 400 },
      ),
    };
  }
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return {
      error: NextResponse.json(
        { error: "Device not found" },
        { status: 404 },
      ),
    };
  }
  return { device };
}

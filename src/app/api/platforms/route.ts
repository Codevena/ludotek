import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const platforms = await prisma.platform.findMany({
    where: { gameCount: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(platforms);
}

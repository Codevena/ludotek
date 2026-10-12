import { PrismaClient } from "@prisma/client";
import { sqliteUrlWithSingleConnection } from "@/lib/sqlite-url";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const databaseUrl = process.env.DATABASE_URL;
const options = databaseUrl && /^(?:file|sqlite):/.test(databaseUrl)
  ? { datasourceUrl: sqliteUrlWithSingleConnection(databaseUrl) }
  : undefined;

export const prisma = globalForPrisma.prisma || new PrismaClient(options);

globalForPrisma.prisma = prisma;

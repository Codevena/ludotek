import { PrismaClient } from "@prisma/client";
import { PLATFORM_CONFIG } from "../src/lib/platforms";

const prisma = new PrismaClient();

async function main() {
  for (const p of PLATFORM_CONFIG) {
    await prisma.platform.upsert({
      where: { id: p.id },
      update: { label: p.label, icon: p.icon, color: p.color, sortOrder: p.sortOrder },
      create: { id: p.id, label: p.label, icon: p.icon, color: p.color, sortOrder: p.sortOrder },
    });
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.warn(`Seeded ${PLATFORM_CONFIG.length} platforms + settings`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

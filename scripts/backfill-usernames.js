/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

function normalizeUsernameCandidate(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.+/g, ".")
    .slice(0, 40);
}

async function nextUniqueUsername(prisma, tenantId, email) {
  const local = String(email || "").split("@")[0] || "";
  const base = normalizeUsernameCandidate(local) || "user";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const exists = await prisma.user.findFirst({ where: { tenantId, username: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 40);
}

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes("--dry-run");
  const tenantIdArgIndex = process.argv.findIndex((a) => a === "--tenant");
  const tenantId = tenantIdArgIndex >= 0 ? process.argv[tenantIdArgIndex + 1] : null;

  const where = {
    ...(tenantId ? { tenantId } : {}),
    OR: [{ username: null }, { username: "" }],
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, tenantId: true, email: true },
    orderBy: [{ createdAt: "asc" }],
  });

  console.log(`Found ${users.length} users without username${tenantId ? ` (tenant=${tenantId})` : ""}.`);
  let updated = 0;

  for (const u of users) {
    const username = await nextUniqueUsername(prisma, u.tenantId, u.email);
    if (dryRun) {
      console.log(`[dry-run] ${u.id} -> ${username}`);
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { username } });
    updated++;
  }

  if (!dryRun) console.log(`Updated ${updated} users.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


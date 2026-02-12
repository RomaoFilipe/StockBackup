import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const has = (name) => args.includes(`--${name}`);
  return {
    tenantSlug: get("tenant"),
    apply: has("apply"),
  };
}

async function resolveOwnerUserId(publicReq) {
  if (publicReq.requesterUserId) return publicReq.requesterUserId;

  const requesterName = (publicReq.requesterName || "").trim();
  if (!requesterName) return null;

  const byName = await prisma.user.findMany({
    where: {
      tenantId: publicReq.tenantId,
      role: "USER",
      name: requesterName,
    },
    select: { id: true },
    take: 2,
  });
  if (byName.length === 1) return byName[0].id;

  if (requesterName.includes("@")) {
    const byEmail = await prisma.user.findMany({
      where: {
        tenantId: publicReq.tenantId,
        role: "USER",
        email: requesterName,
      },
      select: { id: true },
      take: 2,
    });
    if (byEmail.length === 1) return byEmail[0].id;
  }

  return null;
}

async function main() {
  const { tenantSlug, apply } = parseArgs(process.argv);

  let tenantIdFilter = undefined;
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      console.error(`Tenant não encontrado para --tenant=${tenantSlug}`);
      process.exit(1);
    }
    tenantIdFilter = tenant.id;
    console.log(`Filtro tenant: ${tenant.slug} (${tenant.id})`);
  }

  const publicRequests = await prisma.publicRequest.findMany({
    where: {
      acceptedRequestId: { not: null },
      ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      requesterUserId: true,
      requesterName: true,
      acceptedRequestId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (publicRequests.length === 0) {
    console.log("Nada para corrigir.");
    return;
  }

  let checked = 0;
  let fixed = 0;
  let alreadyOk = 0;
  let unresolved = 0;
  let missingRequest = 0;

  for (const pr of publicRequests) {
    checked += 1;
    const requestId = pr.acceptedRequestId;
    if (!requestId) continue;

    const ownerUserId = await resolveOwnerUserId(pr);
    if (!ownerUserId) {
      unresolved += 1;
      console.log(`[UNRESOLVED] publicRequest=${pr.id} request=${requestId} requester="${pr.requesterName || ""}"`);
      continue;
    }

    const req = await prisma.request.findFirst({
      where: { id: requestId, tenantId: pr.tenantId },
      select: { id: true, userId: true },
    });
    if (!req) {
      missingRequest += 1;
      console.log(`[MISSING] request=${requestId} (from publicRequest=${pr.id})`);
      continue;
    }

    if (req.userId === ownerUserId) {
      alreadyOk += 1;
      continue;
    }

    if (apply) {
      await prisma.request.update({
        where: { id: req.id },
        data: { userId: ownerUserId },
      });
    }
    fixed += 1;
    console.log(`[${apply ? "FIXED" : "DRY-RUN"}] request=${req.id} ${req.userId} -> ${ownerUserId}`);
  }

  console.log("-------- RESUMO --------");
  console.log(`Checked:     ${checked}`);
  console.log(`To fix:      ${fixed}`);
  console.log(`Already OK:  ${alreadyOk}`);
  console.log(`Unresolved:  ${unresolved}`);
  console.log(`Missing req: ${missingRequest}`);
  console.log(`Mode:        ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("------------------------");
  if (!apply) {
    console.log("Executa com --apply para gravar alterações.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

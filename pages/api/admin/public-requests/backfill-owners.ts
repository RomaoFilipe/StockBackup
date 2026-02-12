import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const bodySchema = z.object({
  apply: z.boolean().optional(),
});

async function resolveOwnerUserId(args: {
  tenantId: string;
  requesterUserId: string | null;
  requesterName: string;
  requestingServiceId: number;
}) {
  if (args.requesterUserId) return args.requesterUserId;

  const requesterName = (args.requesterName || "").trim();
  if (!requesterName) return null;

  const byName = await prisma.user.findMany({
    where: {
      tenantId: args.tenantId,
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
        tenantId: args.tenantId,
        role: "USER",
        email: requesterName,
      },
      select: { id: true },
      take: 2,
    });
    if (byEmail.length === 1) return byEmail[0].id;
  }

  const byService = await prisma.user.findMany({
    where: {
      tenantId: args.tenantId,
      role: "USER",
      requestingServiceId: args.requestingServiceId,
      isActive: true,
    },
    select: { id: true },
    take: 2,
  });
  if (byService.length === 1) return byService[0].id;

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const apply = Boolean(parsed.data.apply);
  const tenantId = session.tenantId;

  const rows = await prisma.publicRequest.findMany({
    where: {
      tenantId,
      acceptedRequestId: { not: null },
    },
    select: {
      id: true,
      requesterUserId: true,
      requesterName: true,
      requestingServiceId: true,
      acceptedRequestId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let checked = 0;
  let fixed = 0;
  let alreadyOk = 0;
  let unresolved = 0;
  let missingRequest = 0;

  const sample: Array<{ requestId: string; fromUserId: string; toUserId: string; mode: "DRY_RUN" | "APPLIED" }> = [];

  for (const row of rows) {
    checked += 1;
    const requestId = row.acceptedRequestId;
    if (!requestId) continue;

    const ownerUserId = await resolveOwnerUserId({
      tenantId,
      requesterUserId: row.requesterUserId,
      requesterName: row.requesterName,
      requestingServiceId: row.requestingServiceId,
    });
    if (!ownerUserId) {
      unresolved += 1;
      continue;
    }

    const reqRow = await prisma.request.findFirst({
      where: { id: requestId, tenantId },
      select: { id: true, userId: true },
    });
    if (!reqRow) {
      missingRequest += 1;
      continue;
    }

    if (reqRow.userId === ownerUserId) {
      alreadyOk += 1;
      continue;
    }

    if (apply) {
      await prisma.request.update({
        where: { id: reqRow.id },
        data: { userId: ownerUserId },
      });
    }

    fixed += 1;
    if (sample.length < 20) {
      sample.push({
        requestId: reqRow.id,
        fromUserId: reqRow.userId,
        toUserId: ownerUserId,
        mode: apply ? "APPLIED" : "DRY_RUN",
      });
    }
  }

  return res.status(200).json({
    ok: true,
    apply,
    summary: {
      checked,
      fixed,
      alreadyOk,
      unresolved,
      missingRequest,
    },
    sample,
  });
}

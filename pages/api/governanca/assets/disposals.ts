import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const openSchema = z.object({
  action: z.literal("OPEN"),
  assetId: z.string().uuid(),
  reasonCode: z.string().min(2).max(80),
  reasonDetail: z.string().max(1200).optional().nullable(),
  technicalEvaluation: z.string().max(2000).optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  documentRef: z.string().max(500).optional().nullable(),
  attachments: z.array(z.string().max(500)).max(20).optional().nullable(),
});

const decideSchema = z.object({
  action: z.literal("DECIDE"),
  disposalId: z.string().uuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().max(1200).optional().nullable(),
  destination: z.string().max(200).optional().nullable(),
  documentRef: z.string().max(500).optional().nullable(),
  attachments: z.array(z.string().max(500)).max(20).optional().nullable(),
});

const completeSchema = z.object({
  action: z.literal("COMPLETE"),
  disposalId: z.string().uuid(),
  destination: z.string().max(200).optional().nullable(),
  documentRef: z.string().max(500).optional().nullable(),
  attachments: z.array(z.string().max(500)).max(20).optional().nullable(),
  note: z.string().max(1200).optional().nullable(),
});

const requestSchema = z.discriminatedUnion("action", [openSchema, decideSchema, completeSchema]);

async function userHasActiveRoleKey(db: any, tenantId: string, userId: string, roleKey: string) {
  const now = new Date();
  const assignment = await db.userRoleAssignment.findFirst({
    where: {
      tenantId,
      userId,
      isActive: true,
      role: { key: roleKey },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

async function generateDisposalCode(tx: any, tenantId: string) {
  const year = new Date().getFullYear();
  const prefix = `ABT-${year}`;
  const count = await tx.municipalAssetDisposalProcess.count({ where: { tenantId, code: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");
  const canView = canManage || hasPermission(grants, "assets.view") || hasPermission(grants, "assets.audit_view");
  const canDispose = canManage || hasPermission(grants, "assets.dispose");

  if (req.method === "GET") {
    if (!canView) return res.status(403).json({ error: "Forbidden" });

    const assetId = typeof req.query.assetId === "string" ? req.query.assetId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const rows = await db.municipalAssetDisposalProcess.findMany({
      where: {
        tenantId,
        ...(assetId ? { assetId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ openedAt: "desc" }],
      include: {
        asset: { select: { id: true, code: true, name: true, status: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json({
      items: rows.map((row: any) => ({
        ...row,
        openedAt: row.openedAt.toISOString(),
        closedAt: row.closedAt ? row.closedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  }

  if (req.method === "POST") {
    if (!canDispose) return res.status(403).json({ error: "Forbidden" });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    try {
      const payload = parsed.data;
      const policy = await db.assetPolicy.findFirst({ where: { tenantId } });

      const requirePolicyApproval =
        policy?.requireDisposalApproval &&
        !canManage &&
        (payload.action === "DECIDE" || payload.action === "COMPLETE");
      if (requirePolicyApproval) {
        if (!policy?.disposalApproverRoleKey) {
          return res.status(403).json({ error: "Disposal policy requires approver role configuration" });
        }
        const canApproveDisposal = await userHasActiveRoleKey(db, tenantId, session.id, policy.disposalApproverRoleKey);
        if (!canApproveDisposal) {
          return res.status(403).json({ error: "Disposal approval requires approver role" });
        }
      }

      if (payload.action === "OPEN") {
        if (!payload.documentRef?.trim()) {
          return res.status(400).json({ error: "documentRef is required to open disposal process" });
        }
        const result = await prisma.$transaction(async (tx) => {
          const txAny = tx as any;
          const asset = await txAny.municipalAsset.findFirst({ where: { id: payload.assetId, tenantId }, select: { id: true, status: true } });
          if (!asset) throw new Error("Asset not found");

          const openExisting = await txAny.municipalAssetDisposalProcess.findFirst({
            where: { tenantId, assetId: payload.assetId, status: { in: ["DRAFT", "UNDER_REVIEW", "APPROVED"] } },
            select: { id: true },
          });
          if (openExisting) throw new Error("There is already an active disposal process for this asset");

          const code = await generateDisposalCode(txAny, tenantId);
          const process = await txAny.municipalAssetDisposalProcess.create({
            data: {
              tenantId,
              assetId: payload.assetId,
              code,
              status: "UNDER_REVIEW",
              reasonCode: payload.reasonCode.trim(),
              reasonDetail: payload.reasonDetail?.trim() || null,
              technicalEvaluation: payload.technicalEvaluation?.trim() || null,
              estimatedValue: payload.estimatedValue ?? null,
              documentRef: payload.documentRef?.trim() || null,
              attachments: payload.attachments?.length ? payload.attachments : null,
              openedByUserId: session.id,
            },
          });

          await txAny.municipalAsset.update({ where: { id: payload.assetId }, data: { status: "TO_DISPOSE" } });

          await txAny.municipalAssetEvent.create({
            data: {
              tenantId,
              assetId: payload.assetId,
              fromStatus: asset.status,
              toStatus: "TO_DISPOSE",
              note: `Processo de abate ${code} aberto`,
              actorUserId: session.id,
            },
          });

          await txAny.municipalAssetMovement.create({
            data: {
              tenantId,
              assetId: payload.assetId,
              type: "DISPOSAL_INIT",
              statusFrom: asset.status,
              statusTo: "TO_DISPOSE",
              note: `Processo ${code} aberto`,
              reason: payload.reasonCode,
              documentRef: payload.documentRef?.trim() || null,
              attachments: payload.attachments?.length ? payload.attachments : null,
              actorUserId: session.id,
            },
          });

          return process;
        });

        return res.status(201).json({
          ...result,
          openedAt: result.openedAt.toISOString(),
          closedAt: result.closedAt ? result.closedAt.toISOString() : null,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        });
      }

      if (payload.action === "DECIDE") {
        if (!payload.documentRef?.trim()) {
          return res.status(400).json({ error: "documentRef is required for disposal decision" });
        }
        const result = await prisma.$transaction(async (tx) => {
          const txAny = tx as any;
          const current = await txAny.municipalAssetDisposalProcess.findFirst({
            where: { id: payload.disposalId, tenantId },
            select: { id: true, assetId: true, status: true },
          });
          if (!current) throw new Error("Disposal process not found");
          if (current.status === "COMPLETED") throw new Error("Process already completed");

          const nextAssetStatus = payload.status === "APPROVED" ? "TO_DISPOSE" : "IN_SERVICE";
          const asset = await txAny.municipalAsset.findUnique({ where: { id: current.assetId }, select: { status: true } });

          const process = await txAny.municipalAssetDisposalProcess.update({
            where: { id: payload.disposalId },
            data: {
              status: payload.status,
              decisionNote: payload.decisionNote?.trim() || null,
              destination: payload.destination?.trim() || null,
              documentRef: payload.documentRef?.trim() || null,
              attachments: payload.attachments?.length ? payload.attachments : null,
              decidedByUserId: session.id,
            },
          });

          await txAny.municipalAsset.update({ where: { id: current.assetId }, data: { status: nextAssetStatus } });

          await txAny.municipalAssetMovement.create({
            data: {
              tenantId,
              assetId: current.assetId,
              type: "DISPOSAL_APPROVED",
              statusFrom: asset?.status ?? null,
              statusTo: nextAssetStatus,
              note: payload.decisionNote?.trim() || `Decisão de abate: ${payload.status}`,
              documentRef: payload.documentRef?.trim() || null,
              attachments: payload.attachments?.length ? payload.attachments : null,
              actorUserId: session.id,
            },
          });

          await txAny.municipalAssetEvent.create({
            data: {
              tenantId,
              assetId: current.assetId,
              fromStatus: asset?.status ?? null,
              toStatus: nextAssetStatus,
              note: payload.decisionNote?.trim() || `Decisão do processo de abate: ${payload.status}`,
              actorUserId: session.id,
            },
          });

          return process;
        });

        return res.status(200).json({
          ...result,
          openedAt: result.openedAt.toISOString(),
          closedAt: result.closedAt ? result.closedAt.toISOString() : null,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (!payload.documentRef?.trim()) {
          throw new Error("documentRef is required to complete disposal");
        }
        const txAny = tx as any;
        const current = await txAny.municipalAssetDisposalProcess.findFirst({
          where: { id: payload.disposalId, tenantId },
          select: { id: true, assetId: true, status: true },
        });
        if (!current) throw new Error("Disposal process not found");
        if (current.status !== "APPROVED") throw new Error("Only approved disposals can be completed");

        const asset = await txAny.municipalAsset.findUnique({ where: { id: current.assetId }, select: { status: true } });

        const process = await txAny.municipalAssetDisposalProcess.update({
          where: { id: payload.disposalId },
          data: {
            status: "COMPLETED",
            destination: payload.destination?.trim() || null,
            documentRef: payload.documentRef?.trim() || null,
            attachments: payload.attachments?.length ? payload.attachments : null,
            decisionNote: payload.note?.trim() || undefined,
            closedAt: new Date(),
            decidedByUserId: session.id,
          },
        });

        await txAny.municipalAsset.update({ where: { id: current.assetId }, data: { status: "DISPOSED" } });

        await txAny.municipalAssetMovement.create({
          data: {
            tenantId,
            assetId: current.assetId,
            type: "DISPOSED",
            statusFrom: asset?.status ?? null,
            statusTo: "DISPOSED",
            note: payload.note?.trim() || "Ativo abatido e concluído",
            documentRef: payload.documentRef?.trim() || null,
            attachments: payload.attachments?.length ? payload.attachments : null,
            actorUserId: session.id,
          },
        });

        await txAny.municipalAssetEvent.create({
          data: {
            tenantId,
            assetId: current.assetId,
            fromStatus: asset?.status ?? null,
            toStatus: "DISPOSED",
            note: payload.note?.trim() || "Processo de abate concluído",
            actorUserId: session.id,
          },
        });

        return process;
      });

      return res.status(200).json({
        ...result,
        openedAt: result.openedAt.toISOString(),
        closedAt: result.closedAt ? result.closedAt.toISOString() : null,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Failed to process disposal" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

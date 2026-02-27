import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canView =
    session.role === "ADMIN" ||
    hasPermission(grants, "assets.view") ||
    hasPermission(grants, "assets.audit_view") ||
    hasPermission(grants, "reports.view");
  if (!canView) return res.status(403).json({ error: "Forbidden" });

  const now = new Date();
  const repairDays = Math.max(1, Number(req.query.repairDays || 30));
  const repairThreshold = new Date(now.getTime() - repairDays * 24 * 60 * 60 * 1000);
  const year = Number(req.query.year || now.getFullYear());
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [
    totalAssets,
    withoutCustody,
    inRepairOverSla,
    movementsByType,
    inventoryByService,
    inventoryByClass,
    disposalMap,
  ] = await Promise.all([
    (prisma as any).municipalAsset.count({ where: { tenantId } }),
    (prisma as any).municipalAsset.count({ where: { tenantId, assignedToUserId: null } }),
    (prisma as any).municipalAsset.count({
      where: {
        tenantId,
        status: "IN_REPAIR",
        updatedAt: { lte: repairThreshold },
      },
    }),
    (prisma as any).municipalAssetMovement.groupBy({
      by: ["type"],
      where: { tenantId },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
    }),
    (prisma as any).municipalAsset.groupBy({
      by: ["requestingServiceId"],
      where: { tenantId },
      _count: { _all: true },
    }),
    (prisma as any).municipalAsset.groupBy({
      by: ["classId"],
      where: { tenantId },
      _count: { _all: true },
    }),
    (prisma as any).municipalAssetDisposalProcess.groupBy({
      by: ["status"],
      where: { tenantId, openedAt: { gte: yearStart, lt: yearEnd } },
      _count: { _all: true },
    }),
  ]);

  const serviceIds = inventoryByService.map((r: any) => r.requestingServiceId).filter(Boolean);
  const classIds = inventoryByClass.map((r: any) => r.classId).filter(Boolean);

  const [services, classes] = await Promise.all([
    serviceIds.length
      ? (prisma as any).requestingService.findMany({ where: { id: { in: serviceIds } }, select: { id: true, codigo: true, designacao: true } })
      : [],
    classIds.length
      ? (prisma as any).municipalAssetClass.findMany({ where: { id: { in: classIds } }, select: { id: true, key: true, name: true } })
      : [],
  ]);

  const serviceMap = new Map(services.map((s: any) => [s.id, s]));
  const classMap = new Map(classes.map((c: any) => [c.id, c]));

  return res.status(200).json({
    totals: {
      totalAssets,
      withoutCustody,
      inRepairOverSla,
      repairSlaDays: repairDays,
    },
    movementsByType: movementsByType.map((m: any) => ({ type: m.type, count: m._count?._all ?? 0 })),
    inventoryByService: inventoryByService.map((row: any) => {
      const svc = row.requestingServiceId ? (serviceMap.get(row.requestingServiceId) as any) : null;
      return {
        requestingServiceId: row.requestingServiceId,
        label: svc ? `${svc.codigo} - ${svc.designacao}` : "Sem serviço",
        count: row._count?._all ?? 0,
      };
    }),
    inventoryByClass: inventoryByClass.map((row: any) => {
      const cls = row.classId ? (classMap.get(row.classId) as any) : null;
      return {
        classId: row.classId,
        label: cls ? cls.name : "Sem classe",
        count: row._count?._all ?? 0,
      };
    }),
    annualDisposalMap: {
      year,
      rows: disposalMap.map((r: any) => ({ status: r.status, count: r._count?._all ?? 0 })),
    },
  });
}

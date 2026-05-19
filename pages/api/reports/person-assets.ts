import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).optional(),
});

const movementWeight: Record<string, number> = {
  OUT: 1,
  REPAIR_IN: 1,
  RETURN: -1,
  REPAIR_OUT: -1,
  SCRAP: -1,
  LOST: -1,
};

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT");
}

function csvFileName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "pessoa"
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const tenantId = session.tenantId;
  const targetUserId = parsed.data.userId ?? session.id;
  const format = parsed.data.format ?? "json";

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId,
    role: session.role,
  });
  const canViewAll =
    hasPermission(grants, "reports.view") ||
    hasPermission(grants, "users.manage") ||
    hasPermission(grants, "assets.view") ||
    hasPermission(grants, "assets.manage");

  if (targetUserId !== session.id && !canViewAll) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const prismaAny = prisma as any;

  try {
    const person = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        requestingService: { select: { codigo: true, designacao: true } },
      },
    });

    if (!person) return res.status(404).json({ error: "Pessoa não encontrada." });

    const [currentUnits, movements, requests] = await Promise.all([
      prismaAny.productUnit.findMany({
        where: {
          tenantId,
          assignedToUserId: targetUserId,
          status: "ACQUIRED",
        },
        orderBy: [{ acquiredAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          code: true,
          status: true,
          serialNumber: true,
          assetTag: true,
          acquiredAt: true,
          acquiredReason: true,
          acquiredNotes: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
          invoice: {
            select: {
              invoiceNumber: true,
              issuedAt: true,
              reqNumber: true,
              reqDate: true,
            },
          },
        },
      }),
      prismaAny.stockMovement.findMany({
        where: {
          tenantId,
          OR: [{ assignedToUserId: targetUserId }, { request: { is: { userId: targetUserId } } }],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1000,
        select: {
          id: true,
          type: true,
          quantity: true,
          reason: true,
          costCenter: true,
          notes: true,
          createdAt: true,
          product: { select: { id: true, name: true, sku: true } },
          unit: { select: { id: true, code: true, serialNumber: true, assetTag: true } },
          invoice: { select: { invoiceNumber: true, issuedAt: true, reqNumber: true, reqDate: true } },
          request: { select: { id: true, gtmiNumber: true, status: true, title: true } },
          performedBy: { select: { name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.request.findMany({
        where: { tenantId, userId: targetUserId },
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        take: 500,
        select: {
          id: true,
          gtmiNumber: true,
          status: true,
          requestType: true,
          title: true,
          requestedAt: true,
          pickupSignedAt: true,
          signedAt: true,
          items: {
            select: {
              quantity: true,
              destination: true,
              role: true,
              product: { select: { name: true, sku: true } },
              reservedUnit: { select: { code: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);

    const aggregateMap = new Map<
      string,
      { productId: string; productName: string; sku: string; currentQuantity: number; totalDelivered: number; totalReturned: number }
    >();

    for (const movement of movements as any[]) {
      if (movement.unit?.code) continue;
      const productId = movement.product?.id;
      if (!productId) continue;
      const current = aggregateMap.get(productId) ?? {
        productId,
        productName: movement.product?.name ?? "Produto",
        sku: movement.product?.sku ?? "",
        currentQuantity: 0,
        totalDelivered: 0,
        totalReturned: 0,
      };
      const quantity = Number(movement.quantity || 0);
      if (movement.type === "OUT") current.totalDelivered += quantity;
      if (movement.type === "RETURN") current.totalReturned += quantity;
      current.currentQuantity += (movementWeight[movement.type] ?? 0) * quantity;
      aggregateMap.set(productId, current);
    }

    const currentAggregates = Array.from(aggregateMap.values()).filter((row) => row.currentQuantity > 0);
    const report = {
      generatedAt: new Date().toISOString(),
      person: {
        ...person,
        requestingService: person.requestingService
          ? `${person.requestingService.codigo} - ${person.requestingService.designacao}`
          : null,
      },
      summary: {
        currentUnitCount: currentUnits.length,
        currentAggregateProductCount: currentAggregates.length,
        movementsCount: movements.length,
        requestsCount: requests.length,
      },
      currentUnits: currentUnits.map((unit: any) => ({
        id: unit.id,
        code: unit.code,
        status: unit.status,
        serialNumber: unit.serialNumber,
        assetTag: unit.assetTag,
        acquiredAt: unit.acquiredAt?.toISOString?.() ?? null,
        acquiredReason: unit.acquiredReason,
        acquiredNotes: unit.acquiredNotes,
        product: unit.product,
        invoice: unit.invoice
          ? {
              ...unit.invoice,
              issuedAt: unit.invoice.issuedAt?.toISOString?.() ?? null,
              reqDate: unit.invoice.reqDate?.toISOString?.() ?? null,
            }
          : null,
      })),
      currentAggregates,
      movements: movements.map((movement: any) => ({
        ...movement,
        quantity: Number(movement.quantity || 0),
        createdAt: movement.createdAt.toISOString(),
        invoice: movement.invoice
          ? {
              ...movement.invoice,
              issuedAt: movement.invoice.issuedAt?.toISOString?.() ?? null,
              reqDate: movement.invoice.reqDate?.toISOString?.() ?? null,
            }
          : null,
      })),
      requests: requests.map((request) => ({
        ...request,
        requestedAt: request.requestedAt.toISOString(),
        pickupSignedAt: request.pickupSignedAt?.toISOString() ?? null,
        signedAt: request.signedAt?.toISOString() ?? null,
        items: request.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        })),
      })),
    };

    if (format === "csv") {
      const rows: Array<Array<unknown>> = [
        ["Secção", "Data", "Tipo", "Produto", "SKU", "Qtd", "QR/Unidade", "SN/Ativo", "GTMI", "Fatura", "REQ", "Estado", "Notas"],
        ...report.currentUnits.map((unit: any) => [
          "Atual em posse",
          csvDate(unit.acquiredAt),
          "UNIDADE",
          unit.product?.name,
          unit.product?.sku,
          1,
          unit.code,
          unit.serialNumber || unit.assetTag,
          "",
          unit.invoice?.invoiceNumber,
          unit.invoice?.reqNumber,
          unit.status,
          unit.acquiredReason || unit.acquiredNotes,
        ]),
        ...report.currentAggregates.map((row) => [
          "Atual em posse",
          "",
          "AGREGADO",
          row.productName,
          row.sku,
          row.currentQuantity,
          "",
          "",
          "",
          "",
          "",
          "EM POSSE",
          `Entregue: ${row.totalDelivered}; Devolvido: ${row.totalReturned}`,
        ]),
        ...report.movements.map((movement: any) => [
          "Histórico",
          csvDate(movement.createdAt),
          movement.type,
          movement.product?.name,
          movement.product?.sku,
          movement.quantity,
          movement.unit?.code,
          movement.unit?.serialNumber || movement.unit?.assetTag,
          movement.request?.gtmiNumber,
          movement.invoice?.invoiceNumber,
          movement.invoice?.reqNumber,
          movement.request?.status,
          movement.reason || movement.notes,
        ]),
      ];
      const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
      const file = `relatorio-pessoa-${csvFileName(person.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
      return res.status(200).send(`\uFEFF${csv}`);
    }

    return res.status(200).json(report);
  } catch (error) {
    console.error("GET /api/reports/person-assets error:", error);
    return res.status(500).json({ error: "Falha ao gerar relatório por pessoa." });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};

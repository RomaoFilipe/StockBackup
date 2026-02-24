import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

type DesktopItem = {
  unitId: string;
  code: string;
  status: "ACQUIRED" | "IN_REPAIR";
  assignedAt: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  request: {
    id: string;
    gtmiNumber: string;
    title: string | null;
  } | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const prismaAny = prisma as any;

    const rows = await prismaAny.productUnit.findMany({
      where: {
        tenantId: session.tenantId,
        assignedToUserId: session.id,
        status: { in: ["ACQUIRED", "IN_REPAIR"] },
      },
      orderBy: [{ acquiredAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        status: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        stockMovements: {
          where: {
            assignedToUserId: session.id,
            type: "OUT",
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            createdAt: true,
            request: {
              select: {
                id: true,
                gtmiNumber: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const items: DesktopItem[] = rows.map((u: any) => {
      const latestOut = u.stockMovements?.[0] ?? null;
      const req = latestOut?.request ?? null;
      return {
        unitId: String(u.id),
        code: String(u.code),
        status: u.status as "ACQUIRED" | "IN_REPAIR",
        assignedAt: latestOut?.createdAt ? new Date(latestOut.createdAt).toISOString() : null,
        product: {
          id: String(u.product?.id ?? ""),
          name: String(u.product?.name ?? ""),
          sku: String(u.product?.sku ?? ""),
        },
        request: req
          ? {
              id: String(req.id),
              gtmiNumber: String(req.gtmiNumber ?? ""),
              title: req.title ? String(req.title) : null,
            }
          : null,
      };
    });

    const summary = {
      total: items.length,
      acquired: items.filter((i) => i.status === "ACQUIRED").length,
      inRepair: items.filter((i) => i.status === "IN_REPAIR").length,
    };

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      summary,
      items,
    });
  } catch (error) {
    console.error("GET /api/mydesktop error:", error);
    return res.status(500).json({ error: "Failed to load desktop items" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};

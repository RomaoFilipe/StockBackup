import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.role !== "USER") return res.status(403).json({ error: "Forbidden" });

  const tenantId = (session as any).tenantId as string | undefined;
  if (!tenantId) return res.status(400).json({ error: "Sessão inválida (tenant em falta)." });

  const possibleNames = [session.name, session.email].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );

  const rows = await prisma.publicRequest.findMany({
    where: {
      tenantId,
      status: "REJECTED",
      OR: [
        { requesterUserId: session.id },
        {
          requesterUserId: null,
          requesterName: { in: possibleNames },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      requesterName: true,
      title: true,
      notes: true,
      deliveryLocation: true,
      handledAt: true,
      handledNote: true,
      requestingService: {
        select: { id: true, codigo: true, designacao: true },
      },
      items: { select: { id: true } },
    },
    take: 200,
  });

  return res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      requesterName: r.requesterName,
      title: r.title,
      notes: r.notes,
      deliveryLocation: r.deliveryLocation,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      handledNote: r.handledNote,
      requestingService: r.requestingService
        ? {
            id: r.requestingService.id,
            codigo: r.requestingService.codigo,
            designacao: r.requestingService.designacao,
          }
        : null,
      itemsCount: r.items.length,
    }))
  );
}

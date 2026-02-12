import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getClientIp } from "@/utils/ip";
import { applyRateLimit } from "@/utils/rateLimit";
import { notifyAdmin } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";

const submitSchema = z.object({
  title: z.string().max(120).optional(),
  notes: z.string().trim().min(1).max(5000),
  deliveryLocation: z.string().trim().min(1).max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 20,
    keyPrefix: "user-intake",
  });
  if (!rl.ok) {
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.role !== "USER") {
    return res.status(403).json({ error: "Apenas utilizadores USER podem usar este formulário." });
  }

  const tenantId = (session as any).tenantId as string | undefined;
  const requestingServiceId = (session as any).requestingServiceId as number | null | undefined;
  if (!tenantId) return res.status(400).json({ error: "Sessão inválida (tenant em falta)." });
  if (typeof requestingServiceId !== "number" || !Number.isFinite(requestingServiceId)) {
    return res.status(400).json({ error: "Utilizador sem serviço requisitante associado." });
  }

  const service = await prisma.requestingService.findUnique({
    where: { id: requestingServiceId },
    select: { id: true, codigo: true, designacao: true, ativo: true },
  });
  if (!service || !service.ativo) {
    return res.status(400).json({ error: "Serviço requisitante inválido ou inativo." });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      requestingService: {
        id: service.id,
        codigo: service.codigo,
        designacao: service.designacao,
      },
      requesterName: session.name || session.email || "",
      requestedAt: new Date().toISOString(),
    });
  }

  if (req.method === "POST") {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

    try {
      const created = await prisma.publicRequest.create({
        data: {
          tenantId,
          requestingServiceId,
          requesterName: session.name || session.email || "Utilizador",
          requesterUserId: session.id,
          requesterIp: getClientIp(req),
          title: parsed.data.title?.trim() || null,
          notes: parsed.data.notes.trim(),
          deliveryLocation: parsed.data.deliveryLocation.trim(),
          status: "RECEIVED",
        },
        select: { id: true },
      });

      try {
        await notifyAdmin({
          tenantId,
          kind: "PUBLIC_REQUEST_RECEIVED",
          title: "Novo pedido recebido",
          message: `${session.name || session.email || "Utilizador"} submeteu um novo pedido.`,
          data: {
            publicRequestId: created.id,
            requesterName: session.name || session.email || "Utilizador",
            requestingServiceId,
          },
        });
        publishRealtimeEvent({
          type: "public-request.received",
          tenantId,
          audience: "ADMIN",
          payload: {
            publicRequestId: created.id,
            requesterName: session.name || session.email || "Utilizador",
            requestingServiceId,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (notifyError) {
        console.error("POST /api/requests/user-intake notify error:", notifyError);
      }

      return res.status(201).json({ ok: true, id: created.id });
    } catch (error) {
      console.error("POST /api/requests/user-intake error:", error);
      return res.status(500).json({ error: "Não foi possível submeter o pedido." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getClientIp } from "@/utils/ip";
import { applyRateLimit } from "@/utils/rateLimit";
import { createRequestStatusAudit, notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";
import { ensureRequestWorkflowDefinition, ensureRequestWorkflowInstance, transitionRequestWorkflowByActionTx } from "@/utils/workflow";
import { createTicketAudit } from "@/pages/api/tickets/_utils";

const submitSchema = z.object({
  title: z.string().max(120).optional(),
  notes: z.string().trim().min(1).max(5000),
  deliveryLocation: z.string().trim().min(1).max(200),
  ticketId: z.string().uuid().optional(),
});

function formatGtmiNumber(gtmiYear: number, gtmiSeq: number) {
  return `GTMI-${gtmiYear}-${String(gtmiSeq).padStart(6, "0")}`;
}

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

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  const ticketId = parsed.data.ticketId;
  if (ticketId) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId,
        OR: [{ createdByUserId: session.id }, { assignedToUserId: session.id }],
      },
      select: { id: true },
    });
    if (!ticket) {
      return res.status(400).json({ error: "Ticket inválido para associação." });
    }
  }

  await ensureRequestWorkflowDefinition(prisma, tenantId);

  const gtmiYear = new Date().getFullYear();
  let createdRequestId: string | null = null;
  let createdGtmiNumber: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const maxSeq = await tx.request.aggregate({
          where: { tenantId, gtmiYear },
          _max: { gtmiSeq: true },
        });

        const nextSeq = (maxSeq._max.gtmiSeq ?? 0) + 1;
        const gtmiNumber = formatGtmiNumber(gtmiYear, nextSeq);

        const reqRow = await tx.request.create({
          data: {
            tenantId,
            userId: session.id,
            createdByUserId: session.id,
            status: "DRAFT",
            requestType: "STANDARD",
            title: parsed.data.title?.trim() || null,
            notes: parsed.data.notes.trim(),
            gtmiYear,
            gtmiSeq: nextSeq,
            gtmiNumber,
            requestedAt: new Date(),
            priority: "NORMAL",
            dueAt: null,
            requestingServiceId,
            requestingService: `${service.codigo} — ${service.designacao}`.slice(0, 120),
            requesterName: session.name || session.email || "Utilizador",
            requesterEmployeeNo: null,
            deliveryLocation: parsed.data.deliveryLocation.trim(),
            expectedDeliveryFrom: null,
            expectedDeliveryTo: null,
            goodsTypes: [],
          },
          select: { id: true, gtmiNumber: true },
        });

        await ensureRequestWorkflowInstance(tx, { tenantId, requestId: reqRow.id });
        await transitionRequestWorkflowByActionTx(tx, {
          tenantId,
          requestId: reqRow.id,
          action: "SUBMIT",
          actorUserId: session.id,
          note: "user-intake submit",
        });

        if (ticketId) {
          const ticket = await tx.ticket.findFirst({
            where: { id: ticketId, tenantId },
            select: { id: true, code: true },
          });
          if (!ticket) throw new Error("Ticket inválido para associação.");

          await tx.ticket.update({
            where: { id: ticket.id },
            data: { type: "REQUEST" },
          });

          await tx.ticketRequestLink.upsert({
            where: {
              ticketId_requestId: {
                ticketId: ticket.id,
                requestId: reqRow.id,
              },
            },
            create: {
              tenantId,
              ticketId: ticket.id,
              requestId: reqRow.id,
              linkedByUserId: session.id,
            },
            update: {},
          });

          await tx.ticketMessage.create({
            data: {
              tenantId,
              ticketId: ticket.id,
              authorUserId: session.id,
              body: `Requisição associada: ${reqRow.gtmiNumber}.`,
            },
          });

          await createTicketAudit({
            tenantId,
            ticketId: ticket.id,
            actorUserId: session.id,
            action: "REQUEST_LINKED",
            note: `Requisição ${reqRow.gtmiNumber} associada ao ticket`,
            data: { requestId: reqRow.id, gtmiNumber: reqRow.gtmiNumber },
          });

          publishRealtimeEvent({
            type: "ticket.updated",
            tenantId,
            audience: "ALL",
            payload: { ticketId: ticket.id, code: ticket.code, requestId: reqRow.id },
          });
          publishRealtimeEvent({
            type: "ticket.message_created",
            tenantId,
            audience: "ALL",
            payload: { ticketId: ticket.id, code: ticket.code, requestId: reqRow.id, authorUserId: session.id },
          });
        }

        return reqRow;
      });

      createdRequestId = created.id;
      createdGtmiNumber = created.gtmiNumber;
      break;
    } catch (error: any) {
      if (error?.code === "P2002" && attempt < 4) {
        continue;
      }
      console.error("POST /api/requests/user-intake error:", error);
      return res.status(500).json({ error: "Não foi possível submeter o pedido." });
    }
  }

  if (!createdRequestId || !createdGtmiNumber) {
    return res.status(500).json({ error: "Não foi possível submeter o pedido." });
  }

  try {
    await createRequestStatusAudit({
      tenantId,
      requestId: createdRequestId,
      fromStatus: null,
      toStatus: "SUBMITTED",
      changedByUserId: session.id,
      source: "api/requests/user-intake:POST",
      note: `ip=${getClientIp(req) ?? "?"}`,
    });

    await notifyAdmin({
      tenantId,
      kind: "REQUEST_CREATED",
      title: `Nova requisição ${createdGtmiNumber}`,
      message: `${session.name || session.email || "Utilizador"} submeteu um pedido.`,
      requestId: createdRequestId,
      data: {
        requestId: createdRequestId,
        gtmiNumber: createdGtmiNumber,
        requestingServiceId,
      },
    });

    await notifyUser({
      tenantId,
      recipientUserId: session.id,
      kind: "REQUEST_CREATED",
      title: `Pedido criado: ${createdGtmiNumber}`,
      message: "O teu pedido foi submetido com sucesso.",
      requestId: createdRequestId,
      data: {
        requestId: createdRequestId,
        gtmiNumber: createdGtmiNumber,
      },
    });

    publishRealtimeEvent({
      type: "request.created",
      tenantId,
      audience: "ALL",
      userId: session.id,
      payload: {
        id: createdRequestId,
        gtmiNumber: createdGtmiNumber,
        status: "SUBMITTED",
        requestedAt: new Date().toISOString(),
        ownerUserId: session.id,
      },
    });
  } catch (notifyError) {
    console.error("POST /api/requests/user-intake notify error:", notifyError);
  }

  return res.status(201).json({ ok: true, id: createdRequestId });
}


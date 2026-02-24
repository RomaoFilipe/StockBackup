import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdminOrPermission } from "../../_admin";
import { notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";

const bodySchema = z.object({
  note: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminOrPermission(req, res, "public_requests.handle");
  if (!session) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "id is required" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const row = await prisma.publicRequest.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true, status: true, requesterUserId: true, requesterName: true },
  });

  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "RECEIVED") return res.status(400).json({ error: "Request already handled" });

  await prisma.publicRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      handledAt: new Date(),
      handledByUserId: session.id,
      handledNote: parsed.data.note?.trim() || null,
    },
  });

  try {
    await notifyAdmin({
      tenantId: session.tenantId,
      kind: "PUBLIC_REQUEST_REJECTED",
      title: "Pedido recebido recusado",
      message: parsed.data.note?.trim() || "Um pedido foi recusado.",
      data: {
        publicRequestId: row.id,
        requesterName: row.requesterName ?? null,
      },
    });

    if (row.requesterUserId) {
      await notifyUser({
        tenantId: session.tenantId,
        recipientUserId: row.requesterUserId,
        kind: "PUBLIC_REQUEST_REJECTED",
        title: "O teu pedido foi recusado",
        message: parsed.data.note?.trim() || "Podes consultar o motivo no Estado do Pedido.",
        data: {
          publicRequestId: row.id,
          handledNote: parsed.data.note?.trim() || null,
        },
      });
    }

    publishRealtimeEvent({
      type: "public-request.rejected",
      tenantId: session.tenantId,
      audience: "ALL",
      userId: row.requesterUserId ?? null,
      payload: {
        publicRequestId: row.id,
        requesterName: row.requesterName ?? null,
        handledNote: parsed.data.note?.trim() || null,
        at: new Date().toISOString(),
      },
    });
  } catch (notifyError) {
    console.error("POST /api/admin/public-requests/[id]/reject notify error:", notifyError);
  }

  return res.status(200).json({ ok: true });
}

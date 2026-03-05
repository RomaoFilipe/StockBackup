import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/pages/api/admin/_admin";
import { applyTicketSlaEscalations } from "../_sla";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await requireAdmin(req, res);
  if (!session) return;

  try {
    await applyTicketSlaEscalations(session.tenantId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("POST /api/tickets/sla/run error", error);
    return res.status(500).json({ error: "Failed to run SLA escalation" });
  }
}

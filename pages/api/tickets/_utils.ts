import { prisma } from "@/prisma/client";
import type { TicketLevel, TicketPriority } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

export function inferLevelFromPriority(priority: TicketPriority): TicketLevel {
  if (priority === "CRITICAL") return "L3";
  if (priority === "HIGH") return "L2";
  return "L1";
}

export function buildTicketCode(now = new Date()): string {
  const year = now.getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TCK-${year}-${rand}`;
}

export async function nextUniqueTicketCode(tenantId: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = buildTicketCode();
    const exists = await prisma.ticket.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `${buildTicketCode()}-${Date.now().toString(36).toUpperCase()}`;
}

export function canAccessTicket(session: { role?: string; id: string }, ticket: { createdByUserId: string; assignedToUserId: string | null }) {
  if (session.role === "ADMIN") return true;
  return ticket.createdByUserId === session.id || ticket.assignedToUserId === session.id;
}

export async function createTicketAudit(args: {
  tenantId: string;
  ticketId: string;
  actorUserId?: string | null;
  action: string;
  note?: string | null;
  data?: Record<string, unknown> | null;
}) {
  return prisma.ticketAudit.create({
    data: {
      tenantId: args.tenantId,
      ticketId: args.ticketId,
      actorUserId: args.actorUserId ?? null,
      action: args.action,
      note: args.note ?? null,
      data: (args.data as any) ?? undefined,
    },
  });
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).end();
}

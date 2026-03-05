import { prisma } from "@/prisma/client";
import type { TicketLevel, TicketPriority } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

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
  return ticket.createdByUserId === session.id || ticket.assignedToUserId === session.id;
}

export async function getTicketPermissionGrants(session: { id: string; tenantId: string; role?: any }) {
  return getUserPermissionGrants(prisma, { id: session.id, tenantId: session.tenantId, role: session.role });
}

export function isTicketManager(grants: Array<{ key: string; requestingServiceId: number | null }>) {
  return hasPermission(grants, "tickets.manage");
}

export function canAccessTicketWithParticipants(
  session: { id: string },
  ticket: { createdByUserId: string; assignedToUserId: string | null },
  participantUserIds: string[],
  opts?: { isManager?: boolean }
) {
  if (opts?.isManager) return true;
  if (ticket.createdByUserId === session.id) return true;
  if (ticket.assignedToUserId && ticket.assignedToUserId === session.id) return true;
  return participantUserIds.includes(session.id);
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

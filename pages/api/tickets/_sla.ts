import { prisma } from "@/prisma/client";
import type { TicketLevel, TicketPriority, TicketStatus } from "@prisma/client";
import { notifyAdmin, notifyUser } from "@/utils/notifications";
import { sendEmail } from "@/utils/email";
import type { NextApiRequest, NextApiResponse } from "next";
import { publishRealtimeEvent } from "@/utils/realtime";
import { createTicketAudit } from "./_utils";

type SlaRule = {
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

const SLA_RULES: Record<TicketPriority, SlaRule> = {
  LOW: { firstResponseMinutes: 8 * 60, resolutionMinutes: 48 * 60 },
  NORMAL: { firstResponseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  HIGH: { firstResponseMinutes: 60, resolutionMinutes: 8 * 60 },
  CRITICAL: { firstResponseMinutes: 15, resolutionMinutes: 4 * 60 },
};

const ESCALATION_COOLDOWN_MS = 30 * 60 * 1000;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function nextLevel(level: TicketLevel): TicketLevel {
  if (level === "L1") return "L2";
  if (level === "L2") return "L3";
  return "L3";
}

export function computeSlaTargets(priority: TicketPriority, createdAt: Date) {
  const rule = SLA_RULES[priority];
  return {
    firstResponseDueAt: addMinutes(createdAt, rule.firstResponseMinutes),
    resolutionDueAt: addMinutes(createdAt, rule.resolutionMinutes),
  };
}

function isTerminal(status: TicketStatus) {
  return status === "RESOLVED" || status === "CLOSED";
}

export async function applyTicketSlaEscalations(tenantId: string) {
  const now = new Date();

  const candidates = await prisma.ticket.findMany({
    where: {
      tenantId,
      OR: [
        {
          firstResponseAt: null,
          firstResponseDueAt: { lt: now },
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED"] },
        },
        {
          resolutionDueAt: { lt: now },
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED"] },
        },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      tenantId: true,
      createdByUserId: true,
      assignedToUserId: true,
      status: true,
      level: true,
      firstResponseAt: true,
      firstResponseDueAt: true,
      resolutionDueAt: true,
      lastEscalatedAt: true,
      escalationReason: true,
      slaBreachedAt: true,
    },
  });

  for (const ticket of candidates) {
    if (isTerminal(ticket.status)) continue;

    const firstResponseBreached =
      !ticket.firstResponseAt && ticket.firstResponseDueAt && ticket.firstResponseDueAt.getTime() < now.getTime();
    const resolutionBreached = ticket.resolutionDueAt && ticket.resolutionDueAt.getTime() < now.getTime();

    if (!firstResponseBreached && !resolutionBreached) continue;

    if (ticket.lastEscalatedAt && now.getTime() - ticket.lastEscalatedAt.getTime() < ESCALATION_COOLDOWN_MS) {
      continue;
    }

    const reason = firstResponseBreached
      ? "Escalonado automaticamente por incumprimento do SLA de primeira resposta."
      : "Escalonado automaticamente por incumprimento do SLA de resolução.";

    const newLevel = nextLevel(ticket.level);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        level: newLevel,
        status: "ESCALATED",
        escalationReason: ticket.escalationReason ? `${ticket.escalationReason}\n${reason}` : reason,
        slaBreachedAt: ticket.slaBreachedAt ?? now,
        lastEscalatedAt: now,
        slaEscalationCount: { increment: 1 },
      },
    });
    await createTicketAudit({
      tenantId: ticket.tenantId,
      ticketId: ticket.id,
      action: "SLA_ESCALATED",
      note: reason,
      data: { level: newLevel, firstResponseBreached, resolutionBreached },
    });

    const notifyUserIds = Array.from(new Set([ticket.createdByUserId, ticket.assignedToUserId].filter(Boolean) as string[]));
    publishRealtimeEvent({
      type: "ticket.escalated",
      tenantId: ticket.tenantId,
      audience: "ADMIN",
      payload: { ticketId: ticket.id, ticketCode: ticket.code, level: newLevel, reason },
    });
    for (const uid of notifyUserIds) {
      publishRealtimeEvent({
        type: "ticket.escalated",
        tenantId: ticket.tenantId,
        audience: "USER",
        userId: uid,
        payload: { ticketId: ticket.id, ticketCode: ticket.code, level: newLevel, reason },
      });
    }

    const title = `Ticket ${ticket.code} escalado automaticamente`;
    const message = `${ticket.title} foi escalado para ${newLevel} por incumprimento de SLA.`;

    await notifyAdmin({
      tenantId: ticket.tenantId,
      kind: "SECURITY_ALERT",
      title,
      message,
      data: {
        ticketId: ticket.id,
        ticketCode: ticket.code,
        level: newLevel,
        reason,
      },
    });

    if (ticket.assignedToUserId) {
      await notifyUser({
        tenantId: ticket.tenantId,
        recipientUserId: ticket.assignedToUserId,
        kind: "SECURITY_ALERT",
        title,
        message,
        data: {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          level: newLevel,
          reason,
        },
      });
    }

    if (ticket.createdByUserId !== ticket.assignedToUserId) {
      await notifyUser({
        tenantId: ticket.tenantId,
        recipientUserId: ticket.createdByUserId,
        kind: "SECURITY_ALERT",
        title,
        message,
        data: {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          level: newLevel,
          reason,
        },
      });
    }

    const admins = await prisma.user.findMany({
      where: { tenantId: ticket.tenantId, role: "ADMIN", isActive: true },
      select: { email: true },
    });

    const involvedUsers = await prisma.user.findMany({
      where: {
        tenantId: ticket.tenantId,
        id: { in: [ticket.createdByUserId, ticket.assignedToUserId].filter(Boolean) as string[] },
        isActive: true,
      },
      select: { email: true },
    });

    const toSet = new Set<string>([
      ...admins.map((u) => u.email).filter(Boolean),
      ...involvedUsers.map((u) => u.email).filter(Boolean),
    ]);
    const recipients = Array.from(toSet);

    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
    const ticketUrl = `${baseUrl || ""}/tickets/${ticket.id}`;
    const emailBody = `${title}\n\n${message}\n\nAbrir ticket: ${ticketUrl}`;

    await Promise.allSettled(
      recipients.map((email) =>
        sendEmail({
          to: email,
          subject: title,
          text: emailBody,
        })
      )
    );
  }
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).end();
}

import { prisma } from "@/prisma/client";

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

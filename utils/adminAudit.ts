import { prisma } from "@/prisma/client";

export async function logUserAdminAction(args: {
  tenantId: string;
  action: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  note?: string | null;
  payload?: Record<string, any> | null;
}) {
  try {
    await prisma.userAdminAudit.create({
      data: {
        tenantId: args.tenantId,
        action: args.action,
        actorUserId: args.actorUserId ?? null,
        targetUserId: args.targetUserId ?? null,
        note: args.note ?? null,
        payload: args.payload ?? undefined,
      },
    });
  } catch (error) {
    console.error("logUserAdminAction error:", error);
  }
}

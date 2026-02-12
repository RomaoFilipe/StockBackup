import { NotificationKind, UserRole } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { publishRealtimeEvent } from "@/utils/realtime";

type BaseNotificationInput = {
  tenantId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  requestId?: string | null;
  data?: Record<string, any> | null;
};

type NotificationTargets = {
  recipientRole?: UserRole | null;
  recipientUserId?: string | null;
};

async function createAndEmit(input: BaseNotificationInput & NotificationTargets) {
  const created = await prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      kind: input.kind,
      title: input.title,
      message: input.message,
      requestId: input.requestId ?? null,
      data: input.data ?? undefined,
      recipientRole: input.recipientRole ?? null,
      recipientUserId: input.recipientUserId ?? null,
    },
  });

  publishRealtimeEvent({
    type: "notification.created",
    tenantId: input.tenantId,
    audience: input.recipientRole === "ADMIN" ? "ADMIN" : input.recipientUserId ? "USER" : "ALL",
    userId: input.recipientUserId ?? null,
    payload: {
      id: created.id,
      kind: created.kind,
      title: created.title,
      message: created.message,
      requestId: created.requestId,
      createdAt: created.createdAt.toISOString(),
      readAt: created.readAt ? created.readAt.toISOString() : null,
      data: created.data,
    },
  });

  return created;
}

export async function notifyAdmin(input: BaseNotificationInput) {
  return createAndEmit({ ...input, recipientRole: "ADMIN" });
}

export async function notifyUser(input: BaseNotificationInput & { recipientUserId: string }) {
  return createAndEmit({ ...input, recipientUserId: input.recipientUserId });
}

export async function createRequestStatusAudit(args: {
  tenantId: string;
  requestId: string;
  fromStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED" | null;
  toStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  changedByUserId?: string | null;
  note?: string | null;
  source?: string | null;
}) {
  return prisma.requestStatusAudit.create({
    data: {
      tenantId: args.tenantId,
      requestId: args.requestId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      changedByUserId: args.changedByUserId ?? null,
      note: args.note ?? null,
      source: args.source ?? null,
    },
  });
}

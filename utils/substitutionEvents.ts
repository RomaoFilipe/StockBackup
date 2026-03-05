import { prisma } from "@/prisma/client";

export type SubstitutionAuditPayload = {
  substitutionId?: string;
  oldCode?: string;
  newCode?: string;
  linkedRequestId?: string;
  linkedRequestGtmiNumber?: string;
  linkedRequestOwnerUserId?: string;
  oldDisposition?: "RETURN" | "REPAIR" | "SCRAP" | "LOST";
  returnReasonCode?: "AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO";
  returnReasonDetail?: string | null;
  assignedToUserId?: string | null;
  reason?: string | null;
  costCenter?: string | null;
  ticketNumber?: string | null;
  hasNotes?: boolean;
  compatibilityOverrideReason?: string | null;
};

export type SubstitutionEventRow = {
  id: string;
  createdAt: string;
  note?: string | null;
  oldCode: string;
  newCode: string;
  linkedRequestId: string | null;
  linkedRequestGtmiNumber: string | null;
  oldDisposition: "RETURN" | "REPAIR" | "SCRAP" | "LOST";
  returnReasonCode: "AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO" | null;
  returnReasonDetail: string | null;
  reason: string | null;
  costCenter: string | null;
  ticketNumber: string | null;
  assignedToUserId: string | null;
  compatibilityOverrideReason: string | null;
  actor?: { id: string; name: string; email: string } | null;
};

export type SubstitutionEventDetail = SubstitutionEventRow & {
  oldUnit?: {
    id: string;
    code: string;
    status: string;
    product: { id: string; name: string; sku: string };
  } | null;
  newUnit?: {
    id: string;
    code: string;
    status: string;
    assignedTo?: { id: string; name: string; email: string } | null;
    product: { id: string; name: string; sku: string };
  } | null;
};

export function readSubstitutionPayload(payload: unknown): SubstitutionAuditPayload {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  return {
    substitutionId: typeof p.substitutionId === "string" ? p.substitutionId : undefined,
    oldCode: typeof p.oldCode === "string" ? p.oldCode : undefined,
    newCode: typeof p.newCode === "string" ? p.newCode : undefined,
    linkedRequestId: typeof p.linkedRequestId === "string" ? p.linkedRequestId : undefined,
    linkedRequestGtmiNumber: typeof p.linkedRequestGtmiNumber === "string" ? p.linkedRequestGtmiNumber : undefined,
    linkedRequestOwnerUserId: typeof p.linkedRequestOwnerUserId === "string" ? p.linkedRequestOwnerUserId : undefined,
    oldDisposition:
      p.oldDisposition === "RETURN" || p.oldDisposition === "REPAIR" || p.oldDisposition === "SCRAP" || p.oldDisposition === "LOST"
        ? p.oldDisposition
        : undefined,
    returnReasonCode:
      p.returnReasonCode === "AVARIA" || p.returnReasonCode === "FIM_USO" || p.returnReasonCode === "TROCA" || p.returnReasonCode === "EXTRAVIO" || p.returnReasonCode === "OUTRO"
        ? p.returnReasonCode
        : undefined,
    returnReasonDetail: typeof p.returnReasonDetail === "string" ? p.returnReasonDetail : null,
    assignedToUserId: typeof p.assignedToUserId === "string" ? p.assignedToUserId : null,
    reason: typeof p.reason === "string" ? p.reason : null,
    costCenter: typeof p.costCenter === "string" ? p.costCenter : null,
    ticketNumber: typeof p.ticketNumber === "string" ? p.ticketNumber : null,
    hasNotes: Boolean(p.hasNotes),
    compatibilityOverrideReason: typeof p.compatibilityOverrideReason === "string" ? p.compatibilityOverrideReason : null,
  };
}

export function toSubstitutionEventRow(input: {
  id: string;
  createdAt: Date;
  note: string | null;
  payload: unknown;
  actor?: { id: string; name: string; email: string } | null;
}): SubstitutionEventRow {
  const payload = readSubstitutionPayload(input.payload);
  return {
    id: payload.substitutionId || input.id,
    createdAt: input.createdAt.toISOString(),
    note: input.note,
    oldCode: payload.oldCode || "",
    newCode: payload.newCode || "",
    linkedRequestId: payload.linkedRequestId || null,
    linkedRequestGtmiNumber: payload.linkedRequestGtmiNumber || null,
    oldDisposition: payload.oldDisposition || "RETURN",
    returnReasonCode: payload.returnReasonCode || null,
    returnReasonDetail: payload.returnReasonDetail || null,
    reason: payload.reason || null,
    costCenter: payload.costCenter || null,
    ticketNumber: payload.ticketNumber || null,
    assignedToUserId: payload.assignedToUserId || null,
    compatibilityOverrideReason: payload.compatibilityOverrideReason || null,
    actor: input.actor || null,
  };
}

export async function getSubstitutionEventById(tenantId: string, eventId: string): Promise<SubstitutionEventDetail | null> {
  const row = await prisma.userAdminAudit.findFirst({
    where: {
      tenantId,
      action: "UNIT_SUBSTITUTE",
      OR: [
        { id: eventId },
        { payload: { path: ["substitutionId"], equals: eventId } as any },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      note: true,
      payload: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  if (!row) return null;

  const event = toSubstitutionEventRow(row);

  const [oldUnit, newUnit] = await Promise.all([
    event.oldCode
      ? (prisma as any).productUnit.findFirst({
          where: { code: event.oldCode, tenantId },
          select: {
            id: true,
            code: true,
            status: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        })
      : null,
    event.newCode
      ? (prisma as any).productUnit.findFirst({
          where: { code: event.newCode, tenantId },
          select: {
            id: true,
            code: true,
            status: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            product: { select: { id: true, name: true, sku: true } },
          },
        })
      : null,
  ]);

  return {
    ...event,
    oldUnit,
    newUnit,
  };
}

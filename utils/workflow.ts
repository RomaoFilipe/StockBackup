import { PrismaClient, RequestStatus } from "@prisma/client";

const REQUEST_WORKFLOW_KEY = "REQUEST_STANDARD";

const REQUEST_STATES = [
  { code: "DRAFT", name: "Rascunho", sortOrder: 5, isInitial: true, isTerminal: false, requestStatus: "DRAFT" as RequestStatus },
  { code: "SUBMITTED", name: "Submetida", sortOrder: 10, isInitial: false, isTerminal: false, requestStatus: "SUBMITTED" as RequestStatus },
  { code: "AWAITING_ADMIN_APPROVAL", name: "Aguarda aprovação final", sortOrder: 15, isInitial: false, isTerminal: false, requestStatus: "SUBMITTED" as RequestStatus },
  { code: "APPROVED", name: "Aprovada", sortOrder: 20, isInitial: false, isTerminal: false, requestStatus: "APPROVED" as RequestStatus },
  { code: "REJECTED", name: "Rejeitada", sortOrder: 30, isInitial: false, isTerminal: true, requestStatus: "REJECTED" as RequestStatus },
  { code: "FULFILLED", name: "Cumprida", sortOrder: 40, isInitial: false, isTerminal: true, requestStatus: "FULFILLED" as RequestStatus },
];

const REQUEST_TRANSITIONS = [
  { from: "DRAFT", to: "SUBMITTED", action: "SUBMIT", requiredPermission: null },

  // Department/Service decision (CHEFIA)
  { from: "SUBMITTED", to: "AWAITING_ADMIN_APPROVAL", action: "APPROVE", requiredPermission: "requests.approve" },
  { from: "SUBMITTED", to: "REJECTED", action: "REJECT", requiredPermission: "requests.reject" },

  // Final decision (ADMIN)
  { from: "AWAITING_ADMIN_APPROVAL", to: "APPROVED", action: "APPROVE", requiredPermission: "requests.final_approve" },
  { from: "AWAITING_ADMIN_APPROVAL", to: "REJECTED", action: "REJECT", requiredPermission: "requests.final_reject" },

  // Presidency override (dispatch decision)
  { from: "SUBMITTED", to: "APPROVED", action: "PRESIDENCY_APPROVE", requiredPermission: "presidency.approve" },
  { from: "SUBMITTED", to: "REJECTED", action: "PRESIDENCY_REJECT", requiredPermission: "presidency.approve" },
  { from: "AWAITING_ADMIN_APPROVAL", to: "APPROVED", action: "PRESIDENCY_APPROVE", requiredPermission: "presidency.approve" },
  { from: "AWAITING_ADMIN_APPROVAL", to: "REJECTED", action: "PRESIDENCY_REJECT", requiredPermission: "presidency.approve" },

  { from: "APPROVED", to: "FULFILLED", action: "FULFILL", requiredPermission: "requests.pickup_sign" },
  { from: "APPROVED", to: "REJECTED", action: "REJECT", requiredPermission: "requests.final_reject" },
] as const;

export async function ensureRequestWorkflowDefinition(prisma: PrismaClient, tenantId: string) {
  const db = prisma as any;
  const existing = await db.workflowDefinition.findFirst({
    where: {
      tenantId,
      key: REQUEST_WORKFLOW_KEY,
      targetType: "REQUEST",
      isActive: true,
    },
    include: {
      states: true,
      transitions: true,
    },
    orderBy: { version: "desc" },
  });

  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;

    const definition =
      existing ??
      (await txAny.workflowDefinition.create({
        data: {
          tenantId,
          key: REQUEST_WORKFLOW_KEY,
          name: "Workflow Requisição Padrão",
          targetType: "REQUEST",
          version: 1,
          isActive: true,
        },
      }));

    const workflowId = definition.id;

    for (const state of REQUEST_STATES) {
      const existingState = await txAny.workflowStateDefinition.findFirst({
        where: { workflowId, code: state.code },
        select: { id: true },
      });

      if (!existingState) {
        await txAny.workflowStateDefinition.create({
          data: {
            tenantId,
            workflowId,
            code: state.code,
            name: state.name,
            sortOrder: state.sortOrder,
            isInitial: state.isInitial,
            isTerminal: state.isTerminal,
            requestStatus: state.requestStatus,
          },
        });
      } else {
        await txAny.workflowStateDefinition.update({
          where: { id: existingState.id },
          data: {
            name: state.name,
            sortOrder: state.sortOrder,
            isInitial: state.isInitial,
            isTerminal: state.isTerminal,
            requestStatus: state.requestStatus,
          },
        });
      }
    }

    const states = await txAny.workflowStateDefinition.findMany({
      where: { workflowId },
      select: { id: true, code: true },
    });
    const stateByCode = new Map(states.map((s: any) => [s.code, s.id]));

    for (const transition of REQUEST_TRANSITIONS) {
      const fromStateId = stateByCode.get(transition.from);
      const toStateId = stateByCode.get(transition.to);
      if (!fromStateId || !toStateId) continue;

      const existingTransition = await txAny.workflowTransitionDefinition.findFirst({
        where: { workflowId, fromStateId, action: transition.action },
        select: { id: true },
      });

      if (!existingTransition) {
        await txAny.workflowTransitionDefinition.create({
          data: {
            tenantId,
            workflowId,
            fromStateId,
            toStateId,
            action: transition.action,
            requiredPermission: transition.requiredPermission ?? null,
          },
        });
      } else {
        await txAny.workflowTransitionDefinition.update({
          where: { id: existingTransition.id },
          data: {
            toStateId,
            requiredPermission: transition.requiredPermission ?? null,
          },
        });
      }
    }

    return txAny.workflowDefinition.findUniqueOrThrow({
      where: { id: workflowId },
      include: { states: true, transitions: true },
    });
  });
}

export async function ensureRequestWorkflowInstance(tx: any, args: {
  tenantId: string;
  requestId: string;
}) {
  const txAny = tx as any;
  const existing = await txAny.workflowInstance.findFirst({
    where: {
      tenantId: args.tenantId,
      requestId: args.requestId,
    },
    include: {
      currentState: true,
      definition: true,
    },
  });
  if (existing) return existing;

  const definition = await txAny.workflowDefinition.findFirst({
    where: {
      tenantId: args.tenantId,
      key: REQUEST_WORKFLOW_KEY,
      targetType: "REQUEST",
      isActive: true,
    },
    include: {
      states: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { version: "desc" },
  });

  if (!definition) {
    throw new Error("Workflow definition for requests not found");
  }

  const requestRow = await txAny.request.findFirst({
    where: { id: args.requestId, tenantId: args.tenantId },
    select: { status: true },
  });
  const desiredStatus = requestRow?.status ?? null;

  const byStatus =
    desiredStatus && definition.states.find((state: any) => state.requestStatus === desiredStatus);
  const initial = byStatus ?? definition.states.find((state: any) => state.isInitial) ?? definition.states[0];
  if (!initial) {
    throw new Error("Workflow initial state not found");
  }

  return txAny.workflowInstance.create({
    data: {
      tenantId: args.tenantId,
      definitionId: definition.id,
      currentStateId: initial.id,
      requestId: args.requestId,
    },
    include: {
      currentState: true,
      definition: true,
    },
  });
}

export async function transitionRequestWorkflowByActionTx(tx: any, args: {
  tenantId: string;
  requestId: string;
  action: string;
  actorUserId?: string;
  note?: string | null;
}) {
  const instance = await ensureRequestWorkflowInstance(tx, {
    tenantId: args.tenantId,
    requestId: args.requestId,
  });

  const txAny = tx as any;
  const transitions = await txAny.workflowTransitionDefinition.findMany({
    where: {
      tenantId: args.tenantId,
      workflowId: instance.definitionId,
      fromStateId: instance.currentStateId,
    },
    include: { toState: true },
  });

  const transition = transitions.find((item: any) => item.action === args.action);
  if (!transition) {
    return { moved: false as const, reason: "TRANSITION_NOT_ALLOWED" as const };
  }

  const fromStateId = instance.currentStateId;
  const toState = transition.toState;

  await txAny.workflowInstance.update({
    where: { id: instance.id },
    data: {
      currentStateId: toState.id,
      completedAt: toState.isTerminal ? new Date() : null,
    },
  });

  if (toState.requestStatus) {
    await txAny.request.update({
      where: { id: args.requestId },
      data: { status: toState.requestStatus as RequestStatus },
    });
  }

  await txAny.workflowEvent.create({
    data: {
      tenantId: args.tenantId,
      instanceId: instance.id,
      fromStateId,
      toStateId: toState.id,
      action: transition.action,
      note: args.note ?? null,
      actorUserId: args.actorUserId ?? null,
    },
  });

  return {
    moved: true as const,
    action: transition.action,
    requiredPermission: transition.requiredPermission as string | null,
    toState: { id: toState.id, code: toState.code, requestStatus: toState.requestStatus as RequestStatus | null },
  };
}

export async function transitionRequestWorkflowByAction(prisma: PrismaClient, args: {
  tenantId: string;
  requestId: string;
  action: string;
  actorUserId?: string;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => transitionRequestWorkflowByActionTx(tx, args));
}

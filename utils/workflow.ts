import { PrismaClient, RequestStatus } from "@prisma/client";

const REQUEST_WORKFLOW_KEY = "REQUEST_STANDARD";

const REQUEST_STATES = [
  { code: "SUBMITTED", name: "Submetida", sortOrder: 10, isInitial: true, isTerminal: false, requestStatus: "SUBMITTED" as RequestStatus },
  { code: "APPROVED", name: "Aprovada", sortOrder: 20, isInitial: false, isTerminal: false, requestStatus: "APPROVED" as RequestStatus },
  { code: "REJECTED", name: "Rejeitada", sortOrder: 30, isInitial: false, isTerminal: true, requestStatus: "REJECTED" as RequestStatus },
  { code: "FULFILLED", name: "Cumprida", sortOrder: 40, isInitial: false, isTerminal: true, requestStatus: "FULFILLED" as RequestStatus },
];

const REQUEST_TRANSITIONS = [
  { from: "SUBMITTED", to: "APPROVED", action: "APPROVE", requiredPermission: "requests.approve" },
  { from: "SUBMITTED", to: "REJECTED", action: "REJECT", requiredPermission: "requests.reject" },
  { from: "APPROVED", to: "FULFILLED", action: "FULFILL", requiredPermission: "requests.pickup_sign" },
  { from: "APPROVED", to: "REJECTED", action: "REJECT", requiredPermission: "requests.reject" },
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

  if (existing && existing.states.length && existing.transitions.length) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const existingTx = await txAny.workflowDefinition.findFirst({
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

    if (existingTx && existingTx.states.length && existingTx.transitions.length) {
      return existingTx;
    }

    const version = (existingTx?.version ?? 0) + 1;
    const workflow = await txAny.workflowDefinition.create({
      data: {
        tenantId,
        key: REQUEST_WORKFLOW_KEY,
        name: "Workflow Requisição Padrão",
        targetType: "REQUEST",
        version,
        isActive: true,
      },
    });

    await txAny.workflowStateDefinition.createMany({
      data: REQUEST_STATES.map((state) => ({
        tenantId,
        workflowId: workflow.id,
        code: state.code,
        name: state.name,
        sortOrder: state.sortOrder,
        isInitial: state.isInitial,
        isTerminal: state.isTerminal,
        requestStatus: state.requestStatus,
      })),
    });

    const states = await txAny.workflowStateDefinition.findMany({
      where: { workflowId: workflow.id },
      select: { id: true, code: true },
    });
    const stateByCode = new Map(states.map((state: any) => [state.code, state.id]));

    await txAny.workflowTransitionDefinition.createMany({
      data: REQUEST_TRANSITIONS.map((transition) => ({
        tenantId,
        workflowId: workflow.id,
        fromStateId: stateByCode.get(transition.from)!,
        toStateId: stateByCode.get(transition.to)!,
        action: transition.action,
        requiredPermission: transition.requiredPermission,
      })),
    });

    return txAny.workflowDefinition.findUniqueOrThrow({
      where: { id: workflow.id },
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

  const initial = definition.states.find((state: any) => state.isInitial) ?? definition.states[0];
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

export async function transitionRequestWorkflowToStatus(prisma: PrismaClient, args: {
  tenantId: string;
  requestId: string;
  targetStatus: RequestStatus;
  actorUserId?: string;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
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
      include: {
        toState: true,
      },
    });

    const transition = transitions.find((item: any) => item.toState.requestStatus === args.targetStatus);
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

    await txAny.request.update({
      where: { id: args.requestId },
      data: { status: toState.requestStatus ?? args.targetStatus },
    });

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
      status: toState.requestStatus ?? args.targetStatus,
    };
  });
}

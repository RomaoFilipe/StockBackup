import { PrismaClient, User } from "@prisma/client";

export type SystemPermissionKey =
  | "requests.create"
  | "requests.view"
  | "requests.change_status"
  | "requests.approve"
  | "requests.final_approve"
  | "requests.final_reject"
  | "requests.reject"
  | "requests.sign_approval"
  | "requests.void_sign"
  | "requests.pickup_sign"
  | "requests.void_pickup_sign"
  | "requests.dispatch_presidency"
  | "assets.manage"
  | "assets.view"
  | "assets.create"
  | "assets.move"
  | "assets.dispose"
  | "assets.audit_view"
  | "finance.manage"
  | "finance.view"
  | "presidency.approve"
  | "public_requests.view"
  | "public_requests.handle"
  | "tickets.manage"
  | "users.manage"
  | "reports.view";

export type PermissionGrant = {
  key: string;
  requestingServiceId: number | null;
};

export const SYSTEM_PERMISSIONS: Array<{ key: SystemPermissionKey; name: string; description: string }> = [
  { key: "requests.create", name: "Criar requisição", description: "Permite criar requisições internas." },
  { key: "requests.view", name: "Consultar requisições", description: "Permite consultar requisições e respetivo estado." },
  { key: "requests.change_status", name: "Alterar estado da requisição", description: "Permite alterar estado manualmente." },
  { key: "requests.approve", name: "Aprovar requisição", description: "Permite aprovar requisições." },
  { key: "requests.final_approve", name: "Aprovação final (admin)", description: "Permite decisão final após aprovação de chefia." },
  { key: "requests.final_reject", name: "Rejeição final (admin)", description: "Permite rejeição final após aprovação de chefia." },
  { key: "requests.reject", name: "Rejeitar requisição", description: "Permite rejeitar requisições." },
  { key: "requests.sign_approval", name: "Assinar aprovação", description: "Permite assinar aprovação da requisição." },
  { key: "requests.void_sign", name: "Anular assinatura", description: "Permite anular assinatura de aprovação." },
  { key: "requests.pickup_sign", name: "Assinar levantamento", description: "Permite registar assinatura de levantamento." },
  { key: "requests.void_pickup_sign", name: "Anular assinatura de levantamento", description: "Permite anular assinatura de levantamento." },
  { key: "requests.dispatch_presidency", name: "Despachar para presidência", description: "Permite enviar processo para despacho presidencial." },
  { key: "assets.manage", name: "Gerir património", description: "Permite gerir ativos e património." },
  { key: "assets.view", name: "Consultar património", description: "Permite consultar ativos e histórico patrimonial." },
  { key: "assets.create", name: "Criar ativos patrimoniais", description: "Permite registar novos ativos patrimoniais." },
  { key: "assets.move", name: "Movimentar ativos", description: "Permite transferências, afetações e movimentos patrimoniais." },
  { key: "assets.dispose", name: "Abater ativos", description: "Permite abrir e decidir processos de abate patrimonial." },
  { key: "assets.audit_view", name: "Consultar auditoria patrimonial", description: "Permite consultar trilho de movimentos e auditoria patrimonial." },
  { key: "finance.manage", name: "Gerir financiamento", description: "Permite gerir financiamento e compromissos." },
  { key: "finance.view", name: "Consultar financiamento", description: "Permite consultar processos financeiros." },
  { key: "presidency.approve", name: "Aprovação da presidência", description: "Permite aprovações de nível presidência." },
  { key: "public_requests.view", name: "Consultar requerimentos externos", description: "Permite visualizar requerimentos externos." },
  { key: "public_requests.handle", name: "Tratar requerimentos externos", description: "Permite aceitar/rejeitar requerimentos externos." },
  { key: "tickets.manage", name: "Gerir tickets", description: "Permite gerir tickets e operações de suporte." },
  { key: "users.manage", name: "Gerir utilizadores", description: "Permite gerir utilizadores e respetivos acessos." },
  { key: "reports.view", name: "Consultar relatórios", description: "Permite aceder a relatórios operacionais e executivos." },
];

const PLATFORM_ADMIN_ALL_ACCESS =
  process.env.RBAC_PLATFORM_ADMIN_ALL_ACCESS === "false" ? false : true;
const ALL_SYSTEM_PERMISSION_KEYS = SYSTEM_PERMISSIONS.map((permission) => permission.key) as SystemPermissionKey[];

const SYSTEM_ROLES: Array<{
  key: string;
  name: string;
  description: string;
  permissions: SystemPermissionKey[];
}> = [
  {
    key: "PRESIDENT",
    name: "Presidência",
    description: "Perfil com poderes de aprovação de presidência.",
    permissions: [
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.final_approve",
      "requests.final_reject",
      "requests.sign_approval",
      "requests.dispatch_presidency",
      "presidency.approve",
      "finance.view",
      "assets.view",
      "assets.audit_view",
      "reports.view",
      "public_requests.view",
    ],
  },
  {
    key: "VICE_PRESIDENT",
    name: "Vice-Presidência",
    description: "Perfil de substituição formal da presidência.",
    permissions: [
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.final_approve",
      "requests.final_reject",
      "requests.sign_approval",
      "requests.dispatch_presidency",
      "presidency.approve",
      "finance.view",
      "assets.view",
      "assets.audit_view",
      "reports.view",
      "public_requests.view",
    ],
  },
  {
    key: "COUNCILOR",
    name: "Vereador",
    description: "Perfil de decisão por pelouro/unidade orgânica.",
    permissions: [
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.final_approve",
      "requests.final_reject",
      "requests.sign_approval",
      "requests.dispatch_presidency",
      "finance.view",
      "assets.view",
      "assets.audit_view",
      "reports.view",
      "public_requests.view",
    ],
  },
  {
    key: "DIVISION_HEAD",
    name: "Chefe de Divisão",
    description: "Perfil de validação e aprovação intermédia da divisão.",
    permissions: [
      "requests.create",
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.sign_approval",
      "requests.pickup_sign",
      "finance.view",
      "assets.view",
      "assets.audit_view",
      "public_requests.view",
    ],
  },
  {
    key: "FINANCE_MANAGER",
    name: "Gestor Financeiro",
    description: "Perfil de gestão financeira municipal.",
    permissions: [
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.final_approve",
      "requests.final_reject",
      "finance.view",
      "finance.manage",
      "reports.view",
    ],
  },
  {
    key: "FINANCE_OFFICER",
    name: "Técnico Financeiro",
    description: "Perfil operacional financeiro sem decisão estratégica global.",
    permissions: [
      "requests.view",
      "finance.view",
      "finance.manage",
    ],
  },
  {
    key: "ASSET_MANAGER",
    name: "Gestor de Património",
    description: "Perfil de gestão de ativos e inventário.",
    permissions: [
      "requests.view",
      "requests.change_status",
      "requests.pickup_sign",
      "requests.void_pickup_sign",
      "assets.view",
      "assets.audit_view",
      "assets.manage",
      "assets.create",
      "assets.move",
      "assets.dispose",
      "reports.view",
    ],
  },
  {
    key: "PROCUREMENT_OFFICER",
    name: "Técnico de Aprovisionamento",
    description: "Perfil para operações de compra, fornecedores e apoio a requisições.",
    permissions: [
      "requests.create",
      "requests.view",
      "assets.view",
      "assets.audit_view",
      "finance.view",
    ],
  },
  {
    key: "SERVICE_MANAGER",
    name: "Gestor de Serviço",
    description: "Perfil de coordenação por serviço requisitante.",
    permissions: [
      "requests.create",
      "requests.view",
      "requests.approve",
      "requests.reject",
      "requests.sign_approval",
      "requests.pickup_sign",
      "requests.dispatch_presidency",
      "public_requests.view",
    ],
  },
  {
    key: "EXTERNAL_REQUEST_VIEWER",
    name: "Leitor de Requerimentos Externos",
    description: "Perfil de consulta de requerimentos externos sem capacidade de decisão.",
    permissions: ["public_requests.view"],
  },
  {
    key: "EXTERNAL_REQUEST_REVIEWER",
    name: "Gestor de Requerimentos Externos",
    description: "Perfil para tratar requerimentos externos.",
    permissions: ["public_requests.view", "public_requests.handle"],
  },
  {
    key: "SUPERVISOR_UO",
    name: "Supervisor de Unidade Orgânica",
    description: "Perfil de supervisão local por unidade orgânica.",
    permissions: ["requests.create", "requests.view", "public_requests.view", "reports.view"],
  },
  {
    key: "OPERATOR_UO",
    name: "Operador de Unidade Orgânica",
    description: "Perfil operacional local com acesso limitado.",
    permissions: ["requests.create", "requests.view"],
  },
  {
    key: "AUDITOR",
    name: "Auditor",
    description: "Perfil de consulta e verificação sem permissões de alteração.",
    permissions: ["requests.view", "assets.view", "finance.view", "public_requests.view", "reports.view"],
  },
  {
    key: "SUPPORT_ADMIN",
    name: "Administrador de Plataforma",
    description: "Perfil técnico de gestão operacional da aplicação.",
    permissions: PLATFORM_ADMIN_ALL_ACCESS
      ? ALL_SYSTEM_PERMISSION_KEYS
      : ["tickets.manage", "users.manage", "reports.view"],
  },
];

function isActiveWindow(startsAt: Date | null, endsAt: Date | null, now: Date) {
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt <= now) return false;
  return true;
}

export async function ensureTenantRbacBootstrap(prisma: PrismaClient, tenantId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.accessPermission.createMany({
      data: SYSTEM_PERMISSIONS.map((permission) => ({
        tenantId,
        key: permission.key,
        name: permission.name,
        description: permission.description,
        isSystem: true,
      })),
      skipDuplicates: true,
    });

    await tx.accessRole.createMany({
      data: SYSTEM_ROLES.map((role) => ({
        tenantId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      })),
      skipDuplicates: true,
    });

    const [permissions, roles] = await Promise.all([
      tx.accessPermission.findMany({ where: { tenantId }, select: { id: true, key: true } }),
      tx.accessRole.findMany({ where: { tenantId }, select: { id: true, key: true } }),
    ]);

    const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));
    const roleByKey = new Map(roles.map((r) => [r.key, r.id]));

    const rolePermissions = SYSTEM_ROLES.flatMap((role) => {
      const roleId = roleByKey.get(role.key);
      if (!roleId) return [];

      return role.permissions
        .map((permissionKey) => {
          const permissionId = permissionByKey.get(permissionKey);
          if (!permissionId) return null;
          return {
            tenantId,
            roleId,
            permissionId,
          };
        })
        .filter(Boolean) as Array<{ tenantId: string; roleId: string; permissionId: string }>;
    });

    if (rolePermissions.length) {
      await tx.accessRolePermission.createMany({
        data: rolePermissions,
        skipDuplicates: true,
      });
    }
  });
}

export async function getUserPermissionGrants(prisma: PrismaClient, user: Pick<User, "id" | "tenantId" | "role">) {
  if (user.role === "ADMIN") {
    return [{ key: "*", requestingServiceId: null }];
  }

  const now = new Date();
  const assignments = await prisma.userRoleAssignment.findMany({
    where: {
      tenantId: user.tenantId,
      userId: user.id,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: {
      requestingServiceId: true,
      startsAt: true,
      endsAt: true,
      role: {
        select: {
          permissions: {
            select: {
              permission: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const grants: PermissionGrant[] = [];
  for (const assignment of assignments) {
    if (!isActiveWindow(assignment.startsAt, assignment.endsAt, now)) continue;

    for (const rolePerm of assignment.role.permissions) {
      grants.push({
        key: rolePerm.permission.key,
        requestingServiceId: assignment.requestingServiceId ?? null,
      });
    }
  }

  return grants;
}

export function hasPermission(grants: PermissionGrant[], permissionKey: string, requestingServiceId?: number | null) {
  for (const grant of grants) {
    if (grant.key === "*") return true;
    if (grant.key !== permissionKey) continue;
    if (grant.requestingServiceId == null) return true;
    if (requestingServiceId == null) continue;
    if (grant.requestingServiceId === requestingServiceId) return true;
  }
  return false;
}

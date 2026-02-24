import { PrismaClient, User } from "@prisma/client";

export type SystemPermissionKey =
  | "requests.change_status"
  | "requests.approve"
  | "requests.reject"
  | "requests.sign_approval"
  | "requests.void_sign"
  | "requests.pickup_sign"
  | "requests.void_pickup_sign"
  | "assets.manage"
  | "finance.manage"
  | "presidency.approve"
  | "public_requests.handle";

export type PermissionGrant = {
  key: string;
  requestingServiceId: number | null;
};

export const SYSTEM_PERMISSIONS: Array<{ key: SystemPermissionKey; name: string; description: string }> = [
  { key: "requests.change_status", name: "Alterar estado da requisição", description: "Permite alterar estado manualmente." },
  { key: "requests.approve", name: "Aprovar requisição", description: "Permite aprovar requisições." },
  { key: "requests.reject", name: "Rejeitar requisição", description: "Permite rejeitar requisições." },
  { key: "requests.sign_approval", name: "Assinar aprovação", description: "Permite assinar aprovação da requisição." },
  { key: "requests.void_sign", name: "Anular assinatura", description: "Permite anular assinatura de aprovação." },
  { key: "requests.pickup_sign", name: "Assinar levantamento", description: "Permite registar assinatura de levantamento." },
  { key: "requests.void_pickup_sign", name: "Anular assinatura de levantamento", description: "Permite anular assinatura de levantamento." },
  { key: "assets.manage", name: "Gerir património", description: "Permite gerir ativos e património." },
  { key: "finance.manage", name: "Gerir financiamento", description: "Permite gerir financiamento e compromissos." },
  { key: "presidency.approve", name: "Aprovação da presidência", description: "Permite aprovações de nível presidência." },
  { key: "public_requests.handle", name: "Tratar requerimentos externos", description: "Permite aceitar/rejeitar requerimentos externos." },
];

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
    permissions: ["presidency.approve", "requests.approve", "requests.reject", "requests.sign_approval"],
  },
  {
    key: "FINANCE_MANAGER",
    name: "Gestor Financeiro",
    description: "Perfil de gestão financeira municipal.",
    permissions: ["finance.manage", "requests.approve", "requests.reject"],
  },
  {
    key: "ASSET_MANAGER",
    name: "Gestor de Património",
    description: "Perfil de gestão de ativos e inventário.",
    permissions: ["assets.manage", "requests.change_status", "requests.pickup_sign", "requests.void_pickup_sign"],
  },
  {
    key: "SERVICE_MANAGER",
    name: "Gestor de Serviço",
    description: "Perfil de coordenação por serviço requisitante.",
    permissions: ["requests.approve", "requests.reject", "requests.sign_approval", "requests.pickup_sign"],
  },
  {
    key: "EXTERNAL_REQUEST_REVIEWER",
    name: "Gestor de Requerimentos Externos",
    description: "Perfil para tratar requerimentos externos.",
    permissions: ["public_requests.handle"],
  },
];

function isActiveWindow(startsAt: Date | null, endsAt: Date | null, now: Date) {
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt <= now) return false;
  return true;
}

export async function ensureTenantRbacBootstrap(prisma: PrismaClient, tenantId: string) {
  const [permissionCount, roleCount] = await Promise.all([
    prisma.accessPermission.count({ where: { tenantId } }),
    prisma.accessRole.count({ where: { tenantId } }),
  ]);

  if (permissionCount > 0 && roleCount > 0) return;

  await prisma.$transaction(async (tx) => {
    if (permissionCount === 0) {
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
    }

    if (roleCount === 0) {
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
    }

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

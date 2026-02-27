import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const querySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const tenantId = session.tenantId;
  const q = parsed.data.q;
  const limit = parsed.data.limit ?? 20;

  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canSeeAll = hasPermission(grants, "tickets.manage") || hasPermission(grants, "users.manage");
  const requestingServiceId = (session as any).requestingServiceId ?? null;

  if (!canSeeAll && requestingServiceId == null) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(canSeeAll ? {} : { requestingServiceId }),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: limit,
    select: { id: true, name: true, email: true, username: true, role: true, requestingServiceId: true },
  });

  return res.status(200).json(users);
}


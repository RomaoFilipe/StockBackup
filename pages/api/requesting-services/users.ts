import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  requestingServiceId: z.coerce.number().int().positive(),
  q: z.string().trim().max(120).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!session.tenantId) {
    return res.status(500).json({ error: "Session missing tenant" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters" });
  }

  const { requestingServiceId, q } = parsed.data;

  try {
    const [employees, users] = await Promise.all([
      prisma.employee.findMany({
        where: {
          tenantId: session.tenantId,
          isActive: true,
          requestingServiceId,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                  { phoneOrExtension: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          phoneOrExtension: true,
          requestingServiceId: true,
        },
      }),
      prisma.user.findMany({
        where: {
          tenantId: session.tenantId,
          isActive: true,
          requestingServiceId,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          requestingServiceId: true,
        },
      }),
    ]);

    const employeeEmails = new Set(employees.map((employee) => employee.email?.toLowerCase()).filter(Boolean));
    const legacyUsers = users
      .filter((user) => !employeeEmails.has(user.email.toLowerCase()))
      .map((user) => ({ ...user, phoneOrExtension: null }));

    return res.status(200).json([...employees, ...legacyUsers]);
  } catch (error) {
    console.error("GET /api/requesting-services/users error:", error);
    return res.status(500).json({ error: "Failed to fetch requesting-service users" });
  }
}

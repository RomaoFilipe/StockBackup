import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : 30;
    })
    .pipe(z.number().int().min(1).max(200)),
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : 1;
    })
    .pipe(z.number().int().min(1).max(10000)),
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 30;
  const page = parsed.success ? parsed.data.page : 1;
  const unreadOnly = parsed.success ? parsed.data.unreadOnly : false;

  const where = {
    tenantId: session.tenantId,
    ...(session.role === "ADMIN" ? {} : { recipientUserId: session.id }),
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            gtmiNumber: true,
            status: true,
            title: true,
            requestedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return res.status(200).json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      message: r.message,
      data: r.data,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      request: r.request
        ? {
            ...r.request,
            requestedAt: r.request.requestedAt.toISOString(),
          }
        : null,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

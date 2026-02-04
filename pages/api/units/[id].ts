import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  id: z.string().uuid(),
  asUserId: z.string().uuid().optional(),
});

const optionalTrimmedString = (maxLen: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z.string().max(maxLen).nullable()
  );

const bodySchema = z
  .object({
    serialNumber: optionalTrimmedString(120).optional(),
    partNumber: optionalTrimmedString(120).optional(),
    assetTag: optionalTrimmedString(120).optional(),
    notes: optionalTrimmedString(2000).optional(),
  })
  .strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const isAdmin = session.role === "ADMIN";
  const userId = isAdmin && parsedQuery.data.asUserId ? parsedQuery.data.asUserId : session.id;
  const unitId = parsedQuery.data.id;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const data: {
    serialNumber?: string | null;
    partNumber?: string | null;
    assetTag?: string | null;
    notes?: string | null;
  } = {};

  for (const key of ["serialNumber", "partNumber", "assetTag", "notes"] as const) {
    if (Object.prototype.hasOwnProperty.call(parsedBody.data, key)) {
      (data as any)[key] = (parsedBody.data as any)[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const prismaAny = prisma as any;
    const existing = await prismaAny.productUnit.findFirst({
      where: { id: unitId, userId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const updated = await prismaAny.productUnit.update({
      where: { id: unitId },
      data,
      select: {
        id: true,
        code: true,
        status: true,
        serialNumber: true,
        partNumber: true,
        assetTag: true,
        notes: true,
        createdAt: true,
        acquiredAt: true,
        productId: true,
        invoiceId: true,
        acquiredByUserId: true,
      },
    });

    return res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      acquiredAt: updated.acquiredAt ? updated.acquiredAt.toISOString() : null,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta as any)?.target as string[] | undefined;
      const targetString = Array.isArray(target) ? target.join(",") : "";

      const message =
        targetString.includes("serialNumber")
          ? "Este S/N já existe noutro item."
          : targetString.includes("partNumber")
            ? "Este P/N já existe noutro item."
            : targetString.includes("assetTag")
              ? "Este Asset Tag já existe noutro item."
              : "Valor duplicado.";

      return res.status(409).json({ error: message });
    }

    console.error("PATCH /api/units/[id] error:", error);
    return res.status(500).json({ error: "Failed to update unit" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};

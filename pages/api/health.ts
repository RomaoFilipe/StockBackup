import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/prisma/client";
import { logError } from "@/utils/logger";

type HealthResponse =
  | {
      ok: true;
      ts: string;
      uptimeSeconds: number;
      requestId?: string;
      db: { ok: true; latencyMs: number };
      version?: string;
      commitSha?: string;
    }
  | {
      ok: false;
      ts: string;
      uptimeSeconds: number;
      requestId?: string;
      db: { ok: false; error: string };
      version?: string;
      commitSha?: string;
    };

function getRequestId(req: NextApiRequest): string | undefined {
  const raw = req.headers["x-request-id"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      ts: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      requestId: getRequestId(req),
      db: { ok: false, error: "method_not_allowed" },
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA,
    });
  }

  const ts = new Date().toISOString();
  const requestId = getRequestId(req);

  try {
    const started = Date.now();
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1000);
    const latencyMs = Date.now() - started;

    return res.status(200).json({
      ok: true,
      ts,
      uptimeSeconds: Math.round(process.uptime()),
      requestId,
      db: { ok: true, latencyMs },
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA,
    });
  } catch (err) {
    logError("health_check_failed", { err: String(err) }, req);
    return res.status(503).json({
      ok: false,
      ts,
      uptimeSeconds: Math.round(process.uptime()),
      requestId,
      db: { ok: false, error: "db_unhealthy" },
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA,
    });
  }
}


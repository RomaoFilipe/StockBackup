import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

const getClientIp = (req: NextApiRequest): string => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }

  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string" && xri.length > 0) {
    return xri;
  }

  return req.socket?.remoteAddress || "unknown";
};

const getStore = (): Map<string, Bucket> => {
  const globalAny = globalThis as unknown as { __rateLimitStore?: Map<string, Bucket> };
  if (!globalAny.__rateLimitStore) {
    globalAny.__rateLimitStore = new Map();
  }
  return globalAny.__rateLimitStore;
};

const useDatabaseStore = () => {
  const raw = String(process.env.RATE_LIMIT_STORE || "").toLowerCase();
  return raw === "db" || raw === "database" || raw === "postgres" || raw === "postgresql";
};

const applyInMemory = (
  req: NextApiRequest,
  res: NextApiResponse,
  options: RateLimitOptions
): RateLimitResult => {
  const store = getStore();

  const now = Date.now();
  const windowMs = options.windowMs;
  const keyPrefix = options.keyPrefix || "rl";
  const key = `${keyPrefix}:${getClientIp(req)}`;

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return { ok: false, retryAfterSeconds };
  }

  current.count += 1;
  store.set(key, current);
  return { ok: true };
};

const applyDatabase = async (
  req: NextApiRequest,
  res: NextApiResponse,
  options: RateLimitOptions
): Promise<RateLimitResult> => {
  const keyPrefix = options.keyPrefix || "rl";
  const key = `${keyPrefix}:${getClientIp(req)}`;
  const windowMs = Math.max(1, Math.trunc(options.windowMs));
  const max = Math.max(1, Math.trunc(options.max));

  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + (${windowMs}::double precision * interval '1 millisecond'))
    ON CONFLICT ("key")
    DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= now() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= now()
          THEN now() + (${windowMs}::double precision * interval '1 millisecond')
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  if (!row) {
    return { ok: true };
  }

  if (row.count > max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return { ok: false, retryAfterSeconds };
  }

  // Opportunistic cleanup to keep table bounded.
  if (Math.random() < 0.01) {
    void prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < now() - interval '1 day'`;
  }

  return { ok: true };
};

export const applyRateLimit = async (
  req: NextApiRequest,
  res: NextApiResponse,
  options: RateLimitOptions
): Promise<RateLimitResult> => {
  if (!useDatabaseStore()) {
    return applyInMemory(req, res, options);
  }

  try {
    return await applyDatabase(req, res, options);
  } catch {
    // Fail open to in-memory mode if DB store is unavailable.
    return applyInMemory(req, res, options);
  }
};

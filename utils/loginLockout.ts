import { prisma } from "@/prisma/client";

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const BASE_LOCK_MINUTES = 5;
const MAX_LOCK_MINUTES = 60;

function buildKey(tenantId: string, email: string, ip: string) {
  return `${tenantId}:${email.toLowerCase().trim()}:${ip.trim() || "unknown"}`;
}

function lockMinutesForFailureCount(count: number) {
  // 5+ failures starts lockout and escalates quickly.
  if (count < 5) return 0;
  const exp = Math.min(6, count - 5);
  return Math.min(MAX_LOCK_MINUTES, BASE_LOCK_MINUTES * (2 ** exp));
}

export async function checkLoginLockout(tenantId: string, email: string, ip: string) {
  const key = buildKey(tenantId, email, ip);
  const row = await prisma.authLockout.findUnique({ where: { key } });
  if (!row || !row.lockedUntil) return null;
  const remainingMs = row.lockedUntil.getTime() - Date.now();
  if (remainingMs <= 0) return null;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export async function registerLoginFailure(tenantId: string, email: string, ip: string) {
  const key = buildKey(tenantId, email, ip);
  const now = new Date();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const existing = await prisma.authLockout.findUnique({ where: { key } });
  const shouldResetCounter = !existing || existing.lastFailedAt < windowStart;
  const failureCount = shouldResetCounter ? 1 : existing.failureCount + 1;
  const lockMinutes = lockMinutesForFailureCount(failureCount);
  const lockedUntil = lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;

  await prisma.authLockout.upsert({
    where: { key },
    create: {
      key,
      tenantId,
      email: email.toLowerCase().trim(),
      ip: ip.trim() || "unknown",
      failureCount,
      lastFailedAt: now,
      lockedUntil,
    },
    update: {
      tenantId,
      email: email.toLowerCase().trim(),
      ip: ip.trim() || "unknown",
      failureCount,
      lastFailedAt: now,
      lockedUntil,
    },
  });

  if (!lockedUntil) return null;
  const remainingMs = lockedUntil.getTime() - Date.now();
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export async function clearLoginFailures(tenantId: string, email: string, ip: string) {
  const key = buildKey(tenantId, email, ip);
  await prisma.authLockout.delete({ where: { key } }).catch(() => undefined);
}


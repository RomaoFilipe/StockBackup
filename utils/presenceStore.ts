type PresenceStatus = "ONLINE" | "AWAY" | "BUSY" | "MEETING" | "OFFLINE";
type PresenceManualStatus = "ONLINE" | "BUSY" | "MEETING" | null;

type PresenceRecord = {
  lastSeenAt: number;
  lastActiveAt: number;
  manualStatus: PresenceManualStatus;
};

const OFFLINE_AFTER_MS = 3 * 60 * 1000;
const AWAY_AFTER_MS = 60 * 1000;

const globalKey = "__stockly_presence_store_v1__";
const store: Map<string, PresenceRecord> = (globalThis as any)[globalKey] ?? new Map<string, PresenceRecord>();
(globalThis as any)[globalKey] = store;

function keyOf(tenantId: string, userId: string) {
  return `${tenantId}:${userId}`;
}

export function touchPresence(params: { tenantId: string; userId: string; active?: boolean; now?: number }) {
  const { tenantId, userId, active = false, now = Date.now() } = params;
  const key = keyOf(tenantId, userId);
  const prev = store.get(key);
  const next: PresenceRecord = {
    lastSeenAt: now,
    lastActiveAt: active ? now : prev?.lastActiveAt ?? now,
    manualStatus: prev?.manualStatus ?? null,
  };
  store.set(key, next);
  return next;
}

export function setManualPresence(params: {
  tenantId: string;
  userId: string;
  manualStatus: PresenceManualStatus;
  now?: number;
}) {
  const { tenantId, userId, manualStatus, now = Date.now() } = params;
  const key = keyOf(tenantId, userId);
  const prev = store.get(key);
  store.set(key, {
    lastSeenAt: prev?.lastSeenAt ?? now,
    lastActiveAt: prev?.lastActiveAt ?? now,
    manualStatus,
  });
}

export function getPresenceRecord(tenantId: string, userId: string) {
  return store.get(keyOf(tenantId, userId)) ?? null;
}

export function derivePresenceStatus(rec: PresenceRecord | null, now = Date.now()): PresenceStatus {
  if (!rec) return "OFFLINE";
  if (now - rec.lastSeenAt > OFFLINE_AFTER_MS) return "OFFLINE";
  if (rec.manualStatus === "BUSY") return "BUSY";
  if (rec.manualStatus === "MEETING") return "MEETING";
  if (rec.manualStatus === "ONLINE") return "ONLINE";
  if (now - rec.lastActiveAt > AWAY_AFTER_MS) return "AWAY";
  return "ONLINE";
}


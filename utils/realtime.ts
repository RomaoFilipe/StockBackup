import { EventEmitter } from "events";
import crypto from "crypto";

export type RealtimeAudience = "ADMIN" | "USER" | "ALL";

export type RealtimeEnvelope<T = any> = {
  id: string;
  type: string;
  tenantId: string;
  audience: RealtimeAudience;
  userId?: string | null;
  createdAt: string;
  payload: T;
};

const GLOBAL_KEY = "__stocklyRealtimeBus__";

type BusShape = {
  emitter: EventEmitter;
};

function getBus(): BusShape {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    g[GLOBAL_KEY] = { emitter } satisfies BusShape;
  }
  return g[GLOBAL_KEY] as BusShape;
}

export function publishRealtimeEvent<T = any>(event: Omit<RealtimeEnvelope<T>, "id" | "createdAt">) {
  const envelope: RealtimeEnvelope<T> = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  };
  getBus().emitter.emit("event", envelope);
  return envelope;
}

export function subscribeRealtimeEvents(listener: (event: RealtimeEnvelope) => void) {
  const { emitter } = getBus();
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

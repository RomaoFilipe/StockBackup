type Entry<T> = {
  expiresAt: number;
  value: T;
};

const GLOBAL_KEY = "__stocklyCacheStore__";

function getStore(): Map<string, Entry<unknown>> {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, Entry<unknown>>();
  return g[GLOBAL_KEY] as Map<string, Entry<unknown>>;
}

export function getCached<T>(key: string): T | null {
  const store = getStore();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  const store = getStore();
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs) });
}


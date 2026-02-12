import type { NextApiRequest } from "next";

type Level = "info" | "warn" | "error";

function getRequestId(req?: NextApiRequest): string | undefined {
  const raw = req?.headers?.["x-request-id"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return undefined;
}

export function log(level: Level, message: string, meta?: Record<string, unknown>, req?: NextApiRequest) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    requestId: getRequestId(req),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(message: string, meta?: Record<string, unknown>, req?: NextApiRequest) {
  log("info", message, meta, req);
}

export function logWarn(message: string, meta?: Record<string, unknown>, req?: NextApiRequest) {
  log("warn", message, meta, req);
}

export function logError(message: string, meta?: Record<string, unknown>, req?: NextApiRequest) {
  log("error", message, meta, req);
}


export type ScanIntent =
  | { kind: "unit"; code: string; source: "uuid" | "url" | "json" | "text" }
  | { kind: "request"; ref: string; source: "prefix" | "pattern" | "json" | "url" }
  | { kind: "request_id"; id: string; source: "url" | "json" }
  | { kind: "product"; sku: string; source: "prefix" | "json" }
  | { kind: "substitution"; id: string; source: "prefix" | "url" | "json" }
  | { kind: "movement"; id: string; source: "prefix" | "url" | "json" }
  | { kind: "unknown"; raw: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function normalizeReqRef(input: string) {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeSku(input: string) {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

function extractUuidFromFreeText(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (isUuid(text)) return text;

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (isUuid(parts[i])) return parts[i];
    }
    for (const [, value] of url.searchParams.entries()) {
      const decoded = decodeURIComponent(value);
      if (isUuid(decoded)) return decoded;
    }
  } catch {
    // no-op
  }

  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

function parseJsonPayload(raw: string): ScanIntent | null {
  const text = raw.trim();
  if (!text.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const type = String(parsed.type ?? parsed.kind ?? "").trim().toLowerCase();
    const id = String(parsed.id ?? parsed.uuid ?? "").trim();
    const code = String(parsed.code ?? "").trim();
    const sku = String(parsed.sku ?? "").trim();
    const request = String(parsed.request ?? parsed.req ?? parsed.gtmiNumber ?? parsed.requestNumber ?? "").trim();
    const substitutionId = String(parsed.substitutionId ?? "").trim();
    const movementId = String(parsed.movementId ?? "").trim();

    if (type === "unit" || type === "equipment") {
      const unitCode = extractUuidFromFreeText(code || id);
      if (unitCode) return { kind: "unit", code: unitCode, source: "json" };
    }

    if (type === "request") {
      if (isUuid(id)) return { kind: "request_id", id, source: "json" };
      if (request) return { kind: "request", ref: normalizeReqRef(request), source: "json" };
    }

    if (type === "product" && sku) {
      return { kind: "product", sku: normalizeSku(sku), source: "json" };
    }

    if ((type === "substitution" || type === "replace") && isUuid(substitutionId || id)) {
      return { kind: "substitution", id: substitutionId || id, source: "json" };
    }

    if (type === "movement" && isUuid(movementId || id)) {
      return { kind: "movement", id: movementId || id, source: "json" };
    }
  } catch {
    return null;
  }

  return null;
}

function parseUrlPayload(raw: string): ScanIntent | null {
  try {
    const url = new URL(raw.trim());
    const path = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));

    for (let i = 0; i < path.length; i += 1) {
      const seg = path[i].toLowerCase();
      const next = path[i + 1] ?? "";
      if (seg === "scan" && isUuid(next)) return { kind: "unit", code: next, source: "url" };
      if (seg === "requests" && isUuid(next)) return { kind: "request_id", id: next, source: "url" };
      if (seg === "substitution" && isUuid(next)) return { kind: "substitution", id: next, source: "url" };
      if (seg === "movements" && isUuid(next)) return { kind: "movement", id: next, source: "url" };
    }

    const uuidParamKeys = ["code", "uuid", "id", "unit", "unitCode", "substitutionId", "movementId"];
    for (const key of uuidParamKeys) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      if (key === "substitutionId" && isUuid(value)) return { kind: "substitution", id: value, source: "url" };
      if (key === "movementId" && isUuid(value)) return { kind: "movement", id: value, source: "url" };
      if (isUuid(value)) return { kind: "unit", code: value, source: "url" };
    }

    const req = url.searchParams.get("req") ?? url.searchParams.get("request") ?? url.searchParams.get("gtmi");
    if (req?.trim()) return { kind: "request", ref: normalizeReqRef(req), source: "url" };

    const sku = url.searchParams.get("sku");
    if (sku?.trim()) return { kind: "product", sku: normalizeSku(sku), source: "prefix" };
  } catch {
    return null;
  }

  return null;
}

export function parseScanIntent(rawInput: string): ScanIntent {
  const raw = rawInput.trim();
  if (!raw) return { kind: "unknown", raw };

  const parsedJson = parseJsonPayload(raw);
  if (parsedJson) return parsedJson;

  const parsedUrl = parseUrlPayload(raw);
  if (parsedUrl) return parsedUrl;

  const subMatch = raw.match(/^SUB\s*[:#-]?\s*([0-9a-f-]{36})$/i);
  if (subMatch && isUuid(subMatch[1])) {
    return { kind: "substitution", id: subMatch[1], source: "prefix" };
  }

  const movMatch = raw.match(/^MOV(?:EMENT)?\s*[:#-]?\s*([0-9a-f-]{36})$/i);
  if (movMatch && isUuid(movMatch[1])) {
    return { kind: "movement", id: movMatch[1], source: "prefix" };
  }

  const skuMatch = raw.match(/^SKU\s*[:=#-]?\s*([A-Za-z0-9._-]{2,120})$/i);
  if (skuMatch) {
    return { kind: "product", sku: normalizeSku(skuMatch[1]), source: "prefix" };
  }

  const reqPrefixMatch = raw.match(/^(REQ|GTMI)\s*[:#-]?\s*([A-Za-z0-9./_-]{2,120})$/i);
  if (reqPrefixMatch) {
    const combined = reqPrefixMatch[1].toUpperCase() === "GTMI"
      ? `GTMI-${reqPrefixMatch[2].replace(/^\-+/, "")}`
      : `REQ-${reqPrefixMatch[2].replace(/^\-+/, "")}`;
    return { kind: "request", ref: normalizeReqRef(combined), source: "prefix" };
  }

  if (isUuid(raw)) {
    return { kind: "unit", code: raw, source: "uuid" };
  }

  const gtmiPattern = raw.match(/GTMI-\d{4}-\d{1,8}/i);
  if (gtmiPattern) {
    return { kind: "request", ref: normalizeReqRef(gtmiPattern[0]), source: "pattern" };
  }

  const reqPattern = raw.match(/REQ[-\s/]?\d{1,8}/i);
  if (reqPattern) {
    return { kind: "request", ref: normalizeReqRef(reqPattern[0].replace(/\s+/g, "-")), source: "pattern" };
  }

  const embeddedSku = raw.match(/SKU\s*[:=#-]\s*([A-Za-z0-9._-]{2,120})/i);
  if (embeddedSku) {
    return { kind: "product", sku: normalizeSku(embeddedSku[1]), source: "prefix" };
  }

  const freeUuid = extractUuidFromFreeText(raw);
  if (freeUuid) {
    return { kind: "unit", code: freeUuid, source: "text" };
  }

  return { kind: "unknown", raw };
}

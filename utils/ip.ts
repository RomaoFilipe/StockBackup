import type { NextApiRequest } from "next";
import ipaddr from "ipaddr.js";

function normalizeIp(raw: string): string {
  const v = raw.trim();
  // IPv4-mapped IPv6 (e.g. ::ffff:192.168.0.1)
  if (v.toLowerCase().startsWith("::ffff:")) {
    return v.slice("::ffff:".length);
  }
  return v;
}

export function getClientIp(req: NextApiRequest): string | null {
  const trustProxy = String(process.env.TRUST_PROXY ?? "").toLowerCase() === "true";

  const xf = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(xf) ? xf[0] : xf;

  if (trustProxy && typeof forwarded === "string" && forwarded.trim()) {
    // The left-most value is the original client.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const ra = req.socket?.remoteAddress;
  if (typeof ra === "string" && ra.trim()) {
    return normalizeIp(ra);
  }

  return null;
}

function parseIp(ip: string): ipaddr.IPv4 | ipaddr.IPv6 {
  const normalized = normalizeIp(ip);
  if (ipaddr.isValid(normalized)) {
    return ipaddr.parse(normalized);
  }

  // Some runtimes may provide bracketed IPv6 or other oddities
  const unbracketed = normalized.replace(/^\[/, "").replace(/\]$/, "");
  if (ipaddr.isValid(unbracketed)) {
    return ipaddr.parse(unbracketed);
  }

  throw new Error("Invalid IP");
}

function toComparable(ip: ipaddr.IPv4 | ipaddr.IPv6): ipaddr.IPv4 | ipaddr.IPv6 {
  // If an IPv6 represents an IPv4 address, compare in IPv4 space.
  if (ip.kind() === "ipv6") {
    const v6 = ip as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return v6.toIPv4Address();
    }
  }
  return ip;
}

export function ipMatches(ipOrCidr: string, clientIp: string): boolean {
  const rule = ipOrCidr.trim();
  if (!rule) return false;

  let client = toComparable(parseIp(clientIp));

  // CIDR rule
  if (rule.includes("/")) {
    try {
      const [net, prefix] = ipaddr.parseCIDR(rule);
      const network = toComparable(net);
      if (network.kind() !== client.kind()) {
        return false;
      }
      return client.match([network as any, prefix]);
    } catch {
      return false;
    }
  }

  // Exact IP rule
  try {
    const target = toComparable(parseIp(rule));
    if (target.kind() !== client.kind()) return false;
    return target.toString() === client.toString();
  } catch {
    return false;
  }
}

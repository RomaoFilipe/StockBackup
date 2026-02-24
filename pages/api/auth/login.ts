import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken } from "../../../utils/auth";
import Cookies from "cookies";
import { applyRateLimit } from "@/utils/rateLimit";
import { getClientIp, ipMatches } from "@/utils/ip";
import { notifyAdmin } from "@/utils/notifications";
import { checkLoginLockout, clearLoginFailures, registerLoginFailure } from "@/utils/loginLockout";
import { logError, logInfo, logWarn } from "@/utils/logger";
import { ensureTenantRbacBootstrap } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition } from "@/utils/workflow";

function resolveTenantSlug(req: NextApiRequest): string {
  const header = req.headers["x-tenant-slug"];
  if (typeof header === "string" && header.trim()) return header.trim();

  // Optional: allow passing tenantSlug in body for non-browser clients.
  const body = req.body as any;
  if (body && typeof body === "object" && typeof body.tenantSlug === "string" && body.tenantSlug.trim()) {
    return body.tenantSlug.trim();
  }

  const env = process.env.DEFAULT_TENANT_SLUG;
  return (env && env.trim()) ? env.trim() : "default";
}

export default async function login(req: NextApiRequest, res: NextApiResponse) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Always allow same-origin requests (browser-controlled Origin/Host).
  // This avoids needing to hardcode the server URL when UI and API are served from the same host.
  const reqHostRaw = (req.headers["x-forwarded-host"] ?? req.headers.host) as string | string[] | undefined;
  const reqHost = Array.isArray(reqHostRaw) ? reqHostRaw[0] : reqHostRaw;
  const reqProtoRaw = req.headers["x-forwarded-proto"] as string | string[] | undefined;
  const reqProto = Array.isArray(reqProtoRaw) ? reqProtoRaw[0] : reqProtoRaw;
  const inferredProto = (typeof reqProto === "string" && reqProto.trim()) ? reqProto.trim() : "http";
  const sameOriginAllowed = Boolean(origin && reqHost && origin === `${inferredProto}://${reqHost}`);

  const allowedOrigins = new Set([
    "https://stockly-inventory.vercel.app",
    "https://stockly-inventory-managment-nextjs-ovlrz6kdv.vercel.app",
    "https://stockly-inventory-managment-nextjs-arnob-mahmuds-projects.vercel.app",
    "https://stockly-inventory-managment-n-git-cc3097-arnob-mahmuds-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...envOrigins,
  ]);

  // CORS: only reflect allowed origins (never echo back arbitrary Origin).
  // Add Vary to avoid cache poisoning across origins.
  res.setHeader("Vary", "Origin");
  if (origin && (sameOriginAllowed || allowedOrigins.has(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
  }

  if (req.method === "OPTIONS") {
    // If there is an Origin header and it's not allowed, deny preflight.
    if (origin && !(sameOriginAllowed || allowedOrigins.has(origin))) {
      return res.status(403).end();
    }
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic brute-force protection (in-memory per instance).
  // Note: In serverless this may not be shared across instances.
  const rl = await applyRateLimit(req, res, {
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: "login",
  });
  if (!rl.ok) {
    return res.status(429).json({
      error: "Too many login attempts. Please try again later.",
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  // If this is a cross-site request with an Origin header, enforce the allowlist.
  if (origin && !(sameOriginAllowed || allowedOrigins.has(origin))) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  // Defensive: Ensure req.body is an object
  if (!req.body || typeof req.body !== "object") {
    console.error("Invalid request body (missing or not an object)");
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    console.error("Missing email or password in request body");
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const tenantSlug = resolveTenantSlug(req);
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      // Avoid tenant/account enumeration.
      logWarn("Login denied: tenant not found", { tenantSlug }, req);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const clientIp = getClientIp(req) || "unknown";
    const lockoutSeconds = await checkLoginLockout(tenant.id, email, clientIp);
    if (lockoutSeconds) {
      res.setHeader("Retry-After", String(lockoutSeconds));
      logWarn("Login temporarily blocked", { tenantId: tenant.id, email, clientIp, lockoutSeconds }, req);
      return res.status(429).json({
        error: "Too many failed login attempts. Try again later.",
        retryAfterSeconds: lockoutSeconds,
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
    });

    if (!user || !user.isActive) {
      const retryAfter = await registerLoginFailure(tenant.id, email, clientIp);
      if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
      logWarn("Login denied: invalid user or inactive", { tenantId: tenant.id, email, clientIp }, req);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const retryAfter = await registerLoginFailure(tenant.id, email, clientIp);
      if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
      logWarn("Login denied: invalid password", { tenantId: tenant.id, userId: user.id, clientIp }, req);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await ensureTenantRbacBootstrap(prisma, tenant.id);
    await ensureRequestWorkflowDefinition(prisma, tenant.id);

    const allowed = await prisma.allowedIp.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, ipOrCidr: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });

    const allowBootstrap =
      process.env.ALLOWLIST_BOOTSTRAP_ADMIN === "true" ||
      (process.env.ALLOWLIST_BOOTSTRAP_ADMIN == null && process.env.NODE_ENV !== "production");

    // Bootstrap mode (optional): if no allowlist exists yet for this tenant, allow an ADMIN to log in
    // and automatically seed the allowlist with the current IP. This prevents initial lockout.
    if (allowBootstrap && allowed.length === 0 && user.role === "ADMIN") {
      try {
        await prisma.allowedIp.create({
          data: {
            tenantId: tenant.id,
            ipOrCidr: clientIp,
            isActive: true,
            note: "Bootstrap: first admin login seeded this IP",
            createdByUserId: user.id,
          },
        });
      } catch (e) {
        // If a concurrent request seeded already, continue anyway.
        console.warn("Bootstrap allowlist seed failed:", e);
      }
    }

    // Skip IP allowlist check for normal USER role (they can login from any IP).
    if (user.role !== "USER") {
      const ipAllowed =
        (allowBootstrap && allowed.length === 0 && user.role === "ADMIN") ||
        allowed.some((a) => ipMatches(a.ipOrCidr, clientIp));
      if (!ipAllowed) {
        const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
        const since = new Date(Date.now() - 15 * 60 * 1000);

        const recent = await prisma.ipAccessRequest.findFirst({
          where: {
            tenantId: tenant.id,
            email,
            ip: clientIp,
            status: "PENDING",
            createdAt: { gte: since },
          },
          select: { id: true },
        });

        if (!recent) {
          await prisma.ipAccessRequest.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              email,
              ip: clientIp,
              userAgent,
              status: "PENDING",
            },
          });

          try {
            const sinceAlert = new Date(Date.now() - 15 * 60 * 1000);
            const pendingCount = await prisma.ipAccessRequest.count({
              where: {
                tenantId: tenant.id,
                status: "PENDING",
                createdAt: { gte: sinceAlert },
              },
            });
            if (pendingCount >= 5) {
              await notifyAdmin({
                tenantId: tenant.id,
                kind: "SECURITY_ALERT",
                title: "Alerta de segurança: múltiplos pedidos de IP",
                message: `${pendingCount} pedidos pendentes de IP nos últimos 15 minutos.`,
                data: {
                  type: "ip_requests_spike",
                  pendingCount,
                  windowMinutes: 15,
                  latestIp: clientIp,
                  latestEmail: email,
                },
              });
            }
          } catch (alertError) {
            console.warn("Security alert notification failed:", alertError);
          }
        }

        logWarn("Login denied: IP not allowed", { tenantId: tenant.id, userId: user.id, clientIp }, req);
        return res.status(403).json({
          code: "IP_NOT_ALLOWED",
          message: "IP não autorizado. Pedido enviado para aprovação.",
        });
      }
    }

    if (!user.id) {
      logError("Login error: user missing id", { email }, req);
      return res.status(500).json({ error: "User data corrupted: id missing" });
    }

    await clearLoginFailures(tenant.id, email, clientIp);

    const token = generateToken(user.id, user.role, user.updatedAt.getTime());

    if (!token) {
      logError("Login error: failed generating token", { userId: user.id }, req);
      return res
        .status(500)
        .json({ error: "Failed to generate session token" });
    }

    // Determine if the connection is secure (HTTPS)
    // Avoid relying on NODE_ENV: running `next start` locally over http would otherwise set Secure cookies that browsers drop.
    const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "");
    const isSecure = forwardedProto === "https" || Boolean((req.socket as any)?.encrypted);

    const cookies = new Cookies(req, res, { secure: isSecure });
    cookies.set("session_id", token, {
      httpOnly: true,
      secure: isSecure, // Browsers require Secure when SameSite=None
      sameSite: isSecure ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    // Also expose a non-httpOnly cookie with the user's role so middleware can enforce route-level access
    try {
      cookies.set("user_role", user.role ?? "", {
        httpOnly: false,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 1000,
      });
      cookies.set("csrf_token", crypto.randomBytes(32).toString("base64url"), {
        httpOnly: false,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 1000,
      });
    } catch (e) {
      // ignore cookie set failures
    }

    res.status(200).json({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    });
    logInfo("Login success", { tenantId: tenant.id, userId: user.id, clientIp }, req);
  } catch (error) {
    logError("Login error", { error: error instanceof Error ? error.message : String(error) }, req);
    res.status(500).json({ error: "Internal server error" });
  }
}

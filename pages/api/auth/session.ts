import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import Cookies from "cookies";
import crypto from "crypto";
import { prisma } from "@/prisma/client";
import { ensureTenantRbacBootstrap, getUserPermissionGrants } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition } from "@/utils/workflow";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const user = await getSessionServer(req, res);
    const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "");
    const isSecure = forwardedProto === "https" || Boolean((req.socket as any)?.encrypted);
    const cookies = new Cookies(req, res, { secure: isSecure });
    
    if (!user) {
      cookies.set("session_id", "", {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 0,
      });
      cookies.set("user_role", "", {
        httpOnly: false,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 0,
      });
      cookies.set("csrf_token", "", {
        httpOnly: false,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 0,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    cookies.set("user_role", user.role ?? "", {
      httpOnly: false,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 1000,
    });
    if (!req.cookies["csrf_token"]) {
      cookies.set("csrf_token", crypto.randomBytes(32).toString("base64url"), {
        httpOnly: false,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 1000,
      });
    }

    await ensureTenantRbacBootstrap(prisma, (user as any).tenantId);
    await ensureRequestWorkflowDefinition(prisma, (user as any).tenantId);
    const permissionGrants = await getUserPermissionGrants(prisma, {
      id: user.id,
      tenantId: (user as any).tenantId,
      role: user.role,
    });
    const permissions = Array.from(
      new Set(permissionGrants.map((grant) => grant.key).filter((key) => key !== "*"))
    );

    // Return user data without sensitive information
    res.status(200).json({
      id: user.id,
      tenantId: (user as any).tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: (user as any).isActive,
      mustChangePassword: (user as any).mustChangePassword || false,
      requestingServiceId: (user as any).requestingServiceId || null,
      permissions,
      permissionGrants,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}

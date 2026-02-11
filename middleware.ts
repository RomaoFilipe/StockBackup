import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Admin route: require session (role ADMIN) and optionally restrict by allowed IPs
  if (path === "/admin" || path.startsWith("/admin/")) {
    // Call internal session endpoint to validate session and role.
    try {
      const sessionRes = await fetch(new URL("/api/auth/session", request.url), {
        method: "GET",
        headers: request.headers,
        // Ensure we don't cache an auth response
        cache: "no-store",
      });

      if (!sessionRes.ok) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", path);
        return NextResponse.redirect(loginUrl);
      }

      const sessionData = await sessionRes.json();
      const role = sessionData?.role;
      if (role !== "ADMIN") {
        // Not an admin -> send to home
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }

      // Optional IP allowlist. Set ADMIN_ALLOWED_IPS in env as comma-separated list.
      const allowed = process.env.ADMIN_ALLOWED_IPS || "";
      if (allowed.trim()) {
        const allowedList = allowed.split(",").map((s) => s.trim()).filter(Boolean);

        const xff = request.headers.get("x-forwarded-for");
        const xri = request.headers.get("x-real-ip");
        const clientIp = xff ? xff.split(",")[0].trim() : xri || "unknown";

        if (!allowedList.includes(clientIp)) {
          const url = request.nextUrl.clone();
          url.pathname = "/admin/ip-approval";
          return NextResponse.redirect(url);
        }
      }
    } catch (err) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Define protected routes that require authentication
  const protectedRoutes = ["/api-docs", "/api-status", "/business-insights", "/users", "/storage", "/DB", "/equipamentos"];

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  );

  if (isProtectedRoute) {
    // Get the session token from cookies
    const sessionToken = request.cookies.get("session_id")?.value;

    // If no session token, redirect to login
    if (
      !sessionToken ||
      sessionToken === "null" ||
      sessionToken === "undefined"
    ) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};

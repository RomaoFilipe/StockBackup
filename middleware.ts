import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function ensureRequestId(request: NextRequest) {
  const existing = request.headers.get("x-request-id");
  return existing && existing.trim() ? existing.trim() : crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

function isUnsafeMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function getExpectedOrigin(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

function hasValidCsrfToken(request: NextRequest) {
  const cookieToken = request.cookies.get("csrf_token")?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 20 || headerToken.length < 20) return false;
  return cookieToken === headerToken;
}

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;
  const requestId = ensureRequestId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // API CSRF protection:
  // For authenticated cookie-based unsafe requests, require same-origin Origin.
  // If Origin is missing (scripts/non-browser), require double-submit CSRF token.
  if (path.startsWith("/api/") && isUnsafeMethod(request.method)) {
    const sessionToken = request.cookies.get("session_id")?.value;
    if (sessionToken && sessionToken !== "null" && sessionToken !== "undefined") {
      const origin = request.headers.get("origin");
      const expectedOrigin = getExpectedOrigin(request);

      if (origin && expectedOrigin && origin === expectedOrigin) {
        return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
      }

      if (!hasValidCsrfToken(request)) {
        return withRequestId(NextResponse.json({ error: "Invalid CSRF protection" }, { status: 403 }), requestId);
      }
    }
    return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
  }

  // Legacy route: /admin is now /DB
  if (path === "/admin" || path.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/DB";
    url.search = request.nextUrl.search;
    return withRequestId(NextResponse.redirect(url), requestId);
  }

  // Define protected routes that require authentication
  const protectedRoutes = [
    "/api-docs",
    "/api-status",
    "/business-insights",
    "/users",
    "/storage",
    "/DB",
    "/equipamentos",
    "/",
    "/requests",
    "/scan",
  ];

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => path === route || path.startsWith(`${route}/`));

  if (isProtectedRoute) {
    // Get the session token from cookies
    const sessionToken = request.cookies.get("session_id")?.value;

    // If no session token, redirect to login
    if (!sessionToken || sessionToken === "null" || sessionToken === "undefined") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }
  }

  return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};

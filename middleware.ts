import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Legacy route: /admin is now /DB
  if (path === "/admin" || path.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/DB";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  // Define protected routes that require authentication
  const protectedRoutes = ["/api-docs", "/api-status", "/business-insights", "/users", "/storage", "/DB"];

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

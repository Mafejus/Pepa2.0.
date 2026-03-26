import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes and static assets — skip middleware entirely
  // (API routes handle their own auth; internal server-to-server fetches must not be blocked)
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Public page routes
  if (pathname.startsWith("/login")) {
    return NextResponse.next()
  }

  // Check for NextAuth session cookie (both dev and prod variants)
  const token =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Only run on page routes — not on API, static assets, or images
  matcher: ["/((?!api|_next/static|_next/image|favicon).*)"],
}

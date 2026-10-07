import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware – redirects unauthenticated users to /login.
 * Checks for the NextAuth session cookie directly (no Prisma import)
 * so it works on the Edge runtime.
 */
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/device/pair")) {
    return NextResponse.next();
  }

  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/device/pair|_next|sw\\.js$|logo\\.png$|favicon\\.png$|manifest\\.webmanifest$|favicon\\.ico|robots\\.txt).*)",
  ],
};

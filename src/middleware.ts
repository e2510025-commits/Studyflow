import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware – only activates when AUTH_ENABLED=true.
 * Checks for the NextAuth session cookie directly (no Prisma import)
 * so it works on the Edge runtime.
 */
export function middleware(req: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === "true";

  if (!authEnabled) {
    return NextResponse.next();
  }

  // Check for session cookie (NextAuth v5 uses __Secure-authjs.session-token in prod,
  // authjs.session-token in dev)
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
    "/((?!login|api/auth|_next|favicon\\.ico|robots\\.txt|ranking).*)",
  ],
};

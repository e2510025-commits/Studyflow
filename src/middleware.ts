import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminUid } from "@/lib/admin";
import { toAppUid } from "@/lib/identity";

/**
 * Auth middleware – redirects unauthenticated users to /login.
 * Checks for the NextAuth session cookie directly (no Prisma import)
 * so it works on the Edge runtime.
 */
export async function middleware(req: NextRequest) {
  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const pathname = req.nextUrl.pathname;
  const isAdminApiPath = pathname.startsWith("/api/admin");

  if (isAdminApiPath) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    const rawUid =
      (token?.id as string | undefined) ||
      (token?.sub as string | undefined) ||
      "";
    const uid = toAppUid(rawUid);
    if (!isAdminUid(uid)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next|favicon\\.ico|robots\\.txt).*)",
  ],
};

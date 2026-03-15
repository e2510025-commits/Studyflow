import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isAdminUid } from "@/lib/admin";
import { toAppUid } from "@/lib/identity";

export async function requireAdmin() {
  const session = await auth();
  const rawUid = session?.user?.id || "";
  const appUid = toAppUid(rawUid);

  if (!appUid || !isAdminUid(appUid)) {
    return {
      ok: false as const,
      appUid: "",
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    appUid,
    response: null,
  };
}

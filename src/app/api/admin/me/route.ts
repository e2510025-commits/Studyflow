export const runtime = "edge";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminGuard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ ok: true, uid: guard.appUid });
}


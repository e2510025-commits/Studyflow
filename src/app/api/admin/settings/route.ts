import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminGuard";
import { fetchAppVersion, saveAppVersion } from "@/lib/firestore/appConfig";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const version = await fetchAppVersion();
  return NextResponse.json({ version });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { version?: string };
  const version = String(body.version || "").trim();

  if (!version) {
    return NextResponse.json({ error: "version required" }, { status: 400 });
  }

  await saveAppVersion(version);
  return NextResponse.json({ ok: true });
}

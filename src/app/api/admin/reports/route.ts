export const runtime = "edge";
import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { requireAdmin } from "@/lib/server/adminGuard";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const snap = await getDocs(
    query(collection(db, "violationReports"), orderBy("createdAt", "desc"), limit(300))
  );

  const reports = snap.docs.map((row) => {
    const data = row.data();
    return {
      id: row.id,
      targetType: String(data.targetType || "timeline"),
      targetId: String(data.targetId || ""),
      targetUid: String(data.targetUid || ""),
      targetBody: String(data.targetBody || ""),
      reporterUid: String(data.reporterUid || ""),
      reporterName: String(data.reporterName || "Anonymous"),
      reason: String(data.reason || ""),
      detail: String(data.detail || ""),
      status: String(data.status || "open"),
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      reviewedAt: data.reviewedAt ? toIso(data.reviewedAt) : "",
      reviewedBy: String(data.reviewedBy || ""),
      adminNote: String(data.adminNote || ""),
    };
  });

  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    reportId?: string;
    status?: ReportStatus;
    adminNote?: string;
  };

  const reportId = String(body.reportId || "").trim();
  const status = body.status;
  const adminNote = String(body.adminNote || "").trim().slice(0, 400);

  if (!reportId || !status || !["open", "reviewing", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setDoc(
    doc(db, "violationReports", reportId),
    {
      status,
      adminNote,
      reviewedBy: guard.appUid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}


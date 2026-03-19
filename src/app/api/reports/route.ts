export const runtime = "edge";
import { NextResponse } from "next/server";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveSessionUser } from "@/lib/server/sessionUser";

type ViolationTargetType = "timeline" | "global_chat";

const TARGET_COLLECTIONS: Record<ViolationTargetType, string> = {
  timeline: "timelinePosts",
  global_chat: "globalStreamMessages",
};

function trimText(value: unknown, max: number): string {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    targetType?: ViolationTargetType;
    targetId?: string;
    reason?: string;
    detail?: string;
  };

  const targetType = body.targetType;
  const targetId = trimText(body.targetId, 160);
  const reason = trimText(body.reason, 120);
  const detail = trimText(body.detail, 1200);

  if (!targetType || !(targetType in TARGET_COLLECTIONS) || !targetId || !reason) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const targetRef = doc(db, TARGET_COLLECTIONS[targetType], targetId);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }

  const targetData = targetSnap.data();
  const targetUid = String(targetData.uid || targetData.userId || "");
  if (!targetUid) {
    return NextResponse.json({ error: "target_uid_missing" }, { status: 400 });
  }
  if (targetUid === sessionUser.uid) {
    return NextResponse.json({ error: "cannot_report_self" }, { status: 400 });
  }

  await addDoc(collection(db, "violationReports"), {
    targetType,
    targetId,
    targetUid,
    targetBody: String(targetData.body || "").slice(0, 280),
    reporterUid: sessionUser.uid,
    reporterName: sessionUser.name || "Anonymous",
    reason,
    detail,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}


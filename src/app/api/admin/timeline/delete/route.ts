import { NextResponse } from "next/server";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

const TIMELINE_POSTS = "timelinePosts";
const ADMIN_TIMELINE_DELETION_LOGS = "adminTimelineDeletionLogs";

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { postId?: string };
  const postId = (body.postId || "").trim();
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const ref = doc(db, TIMELINE_POSTS, postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data = snap.data();
  const deletedAt = new Date().toISOString();

  await addDoc(collection(db, ADMIN_TIMELINE_DELETION_LOGS), {
    postId,
    postUid: String(data.uid || data.userId || ""),
    postUserName: String(data.name || "匿名"),
    postUserAvatar: String(data.avatar || "👤"),
    postBody: String(data.body || ""),
    postImageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
    postCreatedAt: toIso(data.createdAt),
    deletedAt,
    deletedByUid: guard.appUid,
    deletedByAdminUid: guard.appUid,
    createdAt: serverTimestamp(),
  });

  await updateDoc(ref, {
    body: "",
    imageUrl: "",
    isDeleted: true,
    editedAt: deletedAt,
    deletedAt,
    deletedByUid: guard.appUid,
    deletedByAdminUid: guard.appUid,
  });

  return NextResponse.json({ ok: true });
}

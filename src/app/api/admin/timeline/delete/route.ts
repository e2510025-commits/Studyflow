import { NextResponse } from "next/server";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

const TIMELINE_POSTS = "timelinePosts";

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

  await updateDoc(ref, {
    body: "",
    imageUrl: "",
    isDeleted: true,
    editedAt: new Date().toISOString(),
    deletedByAdminUid: guard.appUid,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { isAdminUid } from "@/lib/admin";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import type { BulletinCategory } from "@/types";

const BULLETIN_POSTS = "bulletinPosts";
const ALLOWED_CATEGORIES: BulletinCategory[] = ["qa", "tips", "chat", "ops"];

export async function POST(request: Request) {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    content?: string;
    category?: BulletinCategory;
  };

  const title = (body.title || "").trim().slice(0, 120);
  const content = (body.content || "").trim().slice(0, 6000);
  const category = ALLOWED_CATEGORIES.includes(body.category as BulletinCategory)
    ? (body.category as BulletinCategory)
    : "tips";

  if (!title || !content) {
    return NextResponse.json({ error: "title/content required" }, { status: 400 });
  }

  if (category === "ops" && !isAdminUid(sessionUser.uid)) {
    return NextResponse.json({ error: "forbidden_ops_category" }, { status: 403 });
  }

  await addDoc(collection(db, BULLETIN_POSTS), {
    uid: sessionUser.uid,
    name: sanitizeDisplayName(sessionUser.name || "匿名"),
    avatar: sanitizeAvatar(sessionUser.avatar || "👤"),
    title,
    content,
    category,
    helpfulCount: 0,
    replyCount: 0,
    resolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    postId?: string;
    resolved?: boolean;
  };

  const postId = (body.postId || "").trim();
  const resolved = Boolean(body.resolved);

  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const postRef = doc(db, BULLETIN_POSTS, postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const postData = postSnap.data();
  const authorUid = String(postData.uid || "");
  const category = String(postData.category || "");

  if (category !== "qa") {
    return NextResponse.json({ error: "only_qa_supported" }, { status: 400 });
  }

  if (authorUid !== sessionUser.uid && !isAdminUid(sessionUser.uid)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await setDoc(
    postRef,
    {
      resolved,
      resolvedAt: resolved ? serverTimestamp() : null,
      resolvedBy: resolved ? sessionUser.uid : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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

  const profileSnap = await getDoc(doc(db, "userProfiles", sessionUser.uid));
  const isOfficial = profileSnap.exists() ? Boolean(profileSnap.data().isOfficial) : false;

  await addDoc(collection(db, BULLETIN_POSTS), {
    uid: sessionUser.uid,
    name: sanitizeDisplayName(sessionUser.name || "匿名"),
    avatar: sanitizeAvatar(sessionUser.avatar || "👤"),
    isOfficial,
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
    action?: "resolve" | "edit";
    postId?: string;
    resolved?: boolean;
    title?: string;
    content?: string;
  };

  const postId = (body.postId || "").trim();
  const action = body.action || "resolve";
  const resolved = Boolean(body.resolved);
  const title = (body.title || "").trim().slice(0, 120);
  const content = (body.content || "").trim().slice(0, 6000);

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

  if (authorUid !== sessionUser.uid && !isAdminUid(sessionUser.uid)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "edit") {
    if (!title || !content) {
      return NextResponse.json({ error: "title/content required" }, { status: 400 });
    }
    await setDoc(
      postRef,
      {
        title,
        content,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (category !== "qa") {
    return NextResponse.json({ error: "only_qa_supported" }, { status: 400 });
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

export async function DELETE(request: Request) {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    postId?: string;
  };

  const postId = (body.postId || "").trim();
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const postRef = doc(db, BULLETIN_POSTS, postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const authorUid = String(postSnap.data().uid || "");
  if (authorUid !== sessionUser.uid && !isAdminUid(sessionUser.uid)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await deleteDoc(postRef);
  return NextResponse.json({ ok: true });
}

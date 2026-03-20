import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { requireAdmin } from "@/lib/server/adminGuard";

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const uid = (searchParams.get("uid") || "").trim();

  if (uid) {
    const threadRef = doc(db, "supportThreads", uid);
    const threadSnap = await getDoc(threadRef);
    if (!threadSnap.exists()) {
      return NextResponse.json({ thread: null, messages: [] });
    }

    const messagesSnap = await getDocs(
      query(collection(threadRef, "messages"), orderBy("createdAt", "asc"))
    );

    await setDoc(
      threadRef,
      { unreadByAdmin: false, updatedAt: serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({
      thread: {
        uid,
        ...(threadSnap.data() || {}),
      },
      messages: messagesSnap.docs.map((d) => {
        const row = d.data();
        return {
          id: d.id,
          fromRole: row.fromRole === "admin" ? "admin" : "user",
          message: row.message || "",
          createdAt: toIso(row.createdAt),
        };
      }),
    });
  }

  const threadsSnap = await getDocs(
    query(collection(db, "supportThreads"), orderBy("updatedAt", "desc"), limit(300))
  );

  return NextResponse.json({
    threads: threadsSnap.docs.map((d) => {
      const row = d.data();
      return {
        uid: d.id,
        userName: row.userName || "Anonymous",
        userAvatar: row.userAvatar || "🙂",
        status: row.status || "open",
        lastMessage: row.lastMessage || "",
        lastMessageBy: row.lastMessageBy || "user",
        lastMessageAt: toIso(row.lastMessageAt),
        unreadByAdmin: Boolean(row.unreadByAdmin),
      };
    }),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as {
    action?: "reply" | "setStatus";
    uid?: string;
    message?: string;
    status?: "open" | "closed";
  };

  const uid = (body.uid || "").trim();
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }

  const threadRef = doc(db, "supportThreads", uid);
  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) {
    return NextResponse.json({ error: "thread not found" }, { status: 404 });
  }

  if (body.action === "setStatus") {
    const status = body.status === "closed" ? "closed" : "open";
    await setDoc(
      threadRef,
      { status, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reply") {
    const message = (body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    await addDoc(collection(threadRef, "messages"), {
      fromRole: "admin",
      message,
      createdAt: serverTimestamp(),
      by: guard.appUid,
    });

    await setDoc(
      threadRef,
      {
        status: "open",
        lastMessage: message,
        lastMessageBy: "admin",
        lastMessageAt: serverTimestamp(),
        unreadByUser: true,
        unreadByAdmin: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await addDoc(collection(db, "notifications"), {
      toUid: uid,
      type: "support_reply",
      title: "New support reply",
      body: message,
      read: false,
      link: "/support",
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}


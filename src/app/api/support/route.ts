import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import { resolveSessionUser } from "@/lib/server/sessionUser";

export const runtime = "edge";

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET() {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const threadRef = doc(db, "supportThreads", user.uid);
  const threadSnap = await getDoc(threadRef);
  const thread = threadSnap.exists() ? threadSnap.data() : null;

  const messagesSnap = await getDocs(
    query(collection(threadRef, "messages"), orderBy("createdAt", "asc"))
  );

  const messages = messagesSnap.docs.map((d) => {
    const row = d.data();
    return {
      id: d.id,
      fromRole: row.fromRole === "admin" ? "admin" : "user",
      message: row.message || "",
      createdAt: toIso(row.createdAt),
    };
  });

  if (threadSnap.exists()) {
    await setDoc(
      threadRef,
      {
        unreadByUser: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return NextResponse.json(
    {
      thread: thread
        ? {
            status: thread.status || "open",
            lastMessage: thread.lastMessage || "",
            updatedAt: toIso(thread.updatedAt),
            unreadByUser: Boolean(thread.unreadByUser),
          }
        : null,
      messages,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=15",
      },
    }
  );
}

export async function POST(request: Request) {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string };
  const message = (body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const safeName = sanitizeDisplayName(user.name);
  const safeAvatar = sanitizeAvatar(user.avatar);
  const threadRef = doc(db, "supportThreads", user.uid);

  await setDoc(
    threadRef,
    {
      uid: user.uid,
      userName: safeName,
      userAvatar: safeAvatar,
      status: "open",
      lastMessage: message,
      lastMessageBy: "user",
      lastMessageAt: serverTimestamp(),
      unreadByAdmin: true,
      unreadByUser: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(collection(threadRef, "messages"), {
    fromRole: "user",
    message,
    createdAt: serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

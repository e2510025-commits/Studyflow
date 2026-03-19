export const runtime = "edge";
import { NextResponse } from "next/server";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(100));
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title || "",
      body: data.body || "",
      createdBy: data.createdBy || "",
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
      scheduledAt: data.scheduledAt?.toDate?.()?.toISOString?.() || "",
      notifyAsMissionStart: Boolean(data.notifyAsMissionStart),
    };
  });
  return NextResponse.json({ announcements: rows });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    scheduledAt?: string;
    notifyAsMissionStart?: boolean;
  };
  const title = (body.title || "").trim();
  const content = (body.body || "").trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

  if (!title || !content) {
    return NextResponse.json({ error: "title/body required" }, { status: 400 });
  }

  await addDoc(collection(db, "announcements"), {
    title,
    body: content,
    createdBy: guard.appUid,
    createdAt: serverTimestamp(),
    scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
    notifyAsMissionStart: Boolean(body.notifyAsMissionStart),
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as {
    id?: string;
    title?: string;
    body?: string;
    scheduledAt?: string;
    notifyAsMissionStart?: boolean;
  };
  const id = (body.id || "").trim();
  const title = (body.title || "").trim();
  const content = (body.body || "").trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!id || !title || !content) {
    return NextResponse.json({ error: "id/title/body required" }, { status: 400 });
  }

  await setDoc(
    doc(db, "announcements", id),
    {
      title,
      body: content,
      updatedBy: guard.appUid,
      updatedAt: serverTimestamp(),
      scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
      notifyAsMissionStart: Boolean(body.notifyAsMissionStart),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as { id?: string };
  const id = (body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await deleteDoc(doc(db, "announcements", id));
  return NextResponse.json({ ok: true });
}


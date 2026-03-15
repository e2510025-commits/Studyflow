import { NextResponse } from "next/server";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

export async function GET() {
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
    };
  });
  return NextResponse.json({ announcements: rows });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as { title?: string; body?: string };
  const title = (body.title || "").trim();
  const content = (body.body || "").trim();

  if (!title || !content) {
    return NextResponse.json({ error: "title/body required" }, { status: 400 });
  }

  await addDoc(collection(db, "announcements"), {
    title,
    body: content,
    createdBy: guard.appUid,
    createdAt: serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

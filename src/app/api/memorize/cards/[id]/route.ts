import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore/lite";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cardRef = doc(db, "flashCards", id);
    const cardDoc = await getDoc(cardRef);

    if (!cardDoc.exists() || cardDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.front !== undefined) updates.front = String(body.front).trim();
    if (body.back !== undefined) updates.back = String(body.back).trim();
    if (body.hint !== undefined) updates.hint = String(body.hint).trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    updates.updatedAt = Timestamp.now();
    await updateDoc(cardRef, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cardRef = doc(db, "flashCards", id);
    const cardDoc = await getDoc(cardRef);

    if (!cardDoc.exists() || cardDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await deleteDoc(cardRef);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

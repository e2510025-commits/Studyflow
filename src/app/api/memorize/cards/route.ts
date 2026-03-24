import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, doc, setDoc, Timestamp } from "firebase/firestore/lite";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deckId, front, back, hint } = await req.json();

    const cardRef = doc(collection(db, "flashCards"));
    await setDoc(cardRef, {
      uid: sessionUser.uid,
      deckId,
      front,
      back,
      hint: hint || "",
      status: "new",
      nextReviewAt: Timestamp.now(),
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ card: { id: cardRef.id } });
  } catch (error) {
    console.error("Failed to create card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

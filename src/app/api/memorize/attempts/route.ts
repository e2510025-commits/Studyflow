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

    const { questionId, userAnswers, isCorrect, duration } = await req.json();

    const attemptRef = doc(collection(db, "questionAttempts"));
    await setDoc(attemptRef, {
      uid: sessionUser.uid,
      questionId,
      userAnswers,
      isCorrect,
      duration,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ attempt: { id: attemptRef.id } });
  } catch (error) {
    console.error("Failed to save attempt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

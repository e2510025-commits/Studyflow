import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore/lite";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cardsQuery = query(
      collection(db, "flashCards"),
      where("deckId", "==", deckId),
      where("uid", "==", sessionUser.uid)
    );
    const cardsSnap = await getDocs(cardsQuery);

    const now = new Date();
    const dueCards = cardsSnap.docs
      .filter((cardDoc) => {
        const cardData = cardDoc.data();
        return !cardData.nextReviewAt || cardData.nextReviewAt.toDate() <= now;
      })
      .map((cardDoc) => {
        const cardData = cardDoc.data();
        return {
          id: cardDoc.id,
          front: cardData.front,
          back: cardData.back,
          hint: cardData.hint || null,
        };
      });

    return NextResponse.json({ cards: dueCards });
  } catch (error) {
    console.error("Failed to fetch review cards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

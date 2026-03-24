import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { doc, getDoc, updateDoc, setDoc, collection, Timestamp } from "firebase/firestore/lite";

function calculateNextReview(
  rating: number,
  easeFactor: number,
  interval: number,
  repetitions: number
) {
  let newEaseFactor = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  if (rating >= 3) {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
    newEaseFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }

  newEaseFactor = Math.max(1.3, newEaseFactor);

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt: Timestamp.fromDate(nextReviewAt),
  };
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cardId, rating, duration } = await req.json();

    const cardDoc = await getDoc(doc(db, "flashCards", cardId));

    if (!cardDoc.exists()) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const cardData = cardDoc.data();
    const { easeFactor, interval, repetitions, nextReviewAt } = calculateNextReview(
      rating,
      cardData.easeFactor || 2.5,
      cardData.interval || 0,
      cardData.repetitions || 0
    );

    let status = cardData.status;
    if (repetitions >= 3 && easeFactor >= 2.5) {
      status = "mastered";
    } else if (repetitions > 0) {
      status = "learning";
    } else {
      status = "new";
    }

    await updateDoc(doc(db, "flashCards", cardId), {
      easeFactor,
      interval,
      repetitions,
      nextReviewAt,
      status,
      updatedAt: Timestamp.now(),
    });

    const reviewRef = doc(collection(db, "cardReviews"));
    await setDoc(reviewRef, {
      uid: sessionUser.uid,
      cardId,
      rating,
      duration,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

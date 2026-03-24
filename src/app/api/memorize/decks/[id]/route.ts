import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore/lite";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckDoc = await getDoc(doc(db, "memoryDecks", params.id));

    if (!deckDoc.exists() || deckDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const deckData = deckDoc.data();
    const deck = {
      id: deckDoc.id,
      name: deckData.name,
      description: deckData.description,
      color: deckData.color,
    };

    const cardsQuery = query(
      collection(db, "flashCards"),
      where("deckId", "==", params.id),
      orderBy("createdAt", "desc")
    );
    const cardsSnap = await getDocs(cardsQuery);

    const cards = cardsSnap.docs.map((cardDoc) => {
      const cardData = cardDoc.data();
      return {
        id: cardDoc.id,
        front: cardData.front,
        back: cardData.back,
        status: cardData.status,
        nextReviewAt: cardData.nextReviewAt?.toDate().toISOString() || null,
      };
    });

    return NextResponse.json({ deck, cards });
  } catch (error) {
    console.error("Failed to fetch deck:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

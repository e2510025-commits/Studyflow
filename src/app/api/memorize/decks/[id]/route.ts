import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, orderBy } from "firebase/firestore/lite";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckDoc = await getDoc(doc(db, "memoryDecks", id));

    if (!deckDoc.exists() || deckDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const deckData = deckDoc.data();
    const deck = {
      id: deckDoc.id,
      name: deckData.name,
      description: deckData.description || "",
      color: deckData.color,
      createdAt: deckData.createdAt?.toDate().toISOString() || null,
      userName: sessionUser.name,
    };

    const cardsQuery = query(
      collection(db, "flashCards"),
      where("deckId", "==", id),
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

    const deckDoc = await getDoc(doc(db, "memoryDecks", id));

    if (!deckDoc.exists() || deckDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "memoryDecks", id), updates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update deck:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckDoc = await getDoc(doc(db, "memoryDecks", id));

    if (!deckDoc.exists() || deckDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Delete all cards in the deck
    const cardsQuery = query(
      collection(db, "flashCards"),
      where("deckId", "==", id)
    );
    const cardsSnap = await getDocs(cardsQuery);
    await Promise.all(cardsSnap.docs.map((cardDoc) => deleteDoc(cardDoc.ref)));

    // Delete the deck
    await deleteDoc(doc(db, "memoryDecks", id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete deck:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

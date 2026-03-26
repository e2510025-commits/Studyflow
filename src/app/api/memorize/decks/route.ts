import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, query, where, getDocs, orderBy, doc, setDoc, Timestamp } from "firebase/firestore/lite";

export async function GET() {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decksSnap;
    try {
      const decksQuery = query(
        collection(db, "memoryDecks"),
        where("uid", "==", sessionUser.uid),
        orderBy("createdAt", "desc")
      );
      decksSnap = await getDocs(decksQuery);
    } catch (queryError) {
      console.warn("Failed ordered deck query, fallback to unordered query:", queryError);
      const fallbackQuery = query(collection(db, "memoryDecks"), where("uid", "==", sessionUser.uid));
      decksSnap = await getDocs(fallbackQuery);
    }

    const decksWithStats = await Promise.all(
      decksSnap.docs.map(async (deckDoc) => {
        const deckData = deckDoc.data();
        const cardsQuery = query(
          collection(db, "flashCards"),
          where("deckId", "==", deckDoc.id)
        );
        const cardsSnap = await getDocs(cardsQuery);

        const now = new Date();
        let dueCount = 0;
        let masteredCount = 0;

        cardsSnap.docs.forEach((cardDoc) => {
          const cardData = cardDoc.data();
          if (!cardData.nextReviewAt || cardData.nextReviewAt.toDate() <= now) {
            dueCount++;
          }
          if (cardData.status === "mastered") {
            masteredCount++;
          }
        });

        return {
          id: deckDoc.id,
          name: deckData.name || "",
          description: deckData.description || "",
          color: deckData.color || "#3b82f6",
          subjectId: deckData.subjectId || null,
          createdAt: deckData.createdAt?.toDate().toISOString() || null,
          userName: sessionUser.name,
          cardCount: cardsSnap.size,
          dueCount,
          masteredCount,
        };
      })
    );

    decksWithStats.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const totalDue = decksWithStats.reduce((sum, d) => sum + d.dueCount, 0);

    return NextResponse.json({ decks: decksWithStats, totalDue });
  } catch (error) {
    console.error("Failed to fetch decks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, color, isPublic, subjectId } = await req.json();

    const deckRef = doc(collection(db, "memoryDecks"));
    await setDoc(deckRef, {
      uid: sessionUser.uid,
      name,
      description: description || "",
      color: color || "#3b82f6",
      isPublic: isPublic || false,
      subjectId: subjectId || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      deckId: deckRef.id,
      deck: { id: deckRef.id, name, description, color, subjectId: subjectId || null },
    });
  } catch (error) {
    console.error("Failed to create deck:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

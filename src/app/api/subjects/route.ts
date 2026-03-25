import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, query, where, getDocs } from "firebase/firestore/lite";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's subjects from Firestore
    const subjectsQuery = query(
      collection(db, "subjects"),
      where("uid", "==", sessionUser.uid)
    );
    const subjectsSnap = await getDocs(subjectsQuery);

    const subjects = subjectsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        color: data.color,
        icon: data.icon || "📚",
      };
    });

    return NextResponse.json({ subjects });
  } catch (error) {
    console.error("Failed to fetch subjects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

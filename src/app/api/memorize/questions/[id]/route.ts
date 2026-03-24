import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { doc, getDoc } from "firebase/firestore/lite";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questionDoc = await getDoc(doc(db, "fillInBlankQuestions", id));

    if (!questionDoc.exists() || questionDoc.data().uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const questionData = questionDoc.data();
    const question = {
      id: questionDoc.id,
      title: questionData.title,
      content: questionData.content,
      answers: questionData.answers,
      mode: questionData.mode,
    };

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Failed to fetch question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

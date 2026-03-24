import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, doc, setDoc, Timestamp, query, where, getDocs, orderBy } from "firebase/firestore/lite";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questionsQuery = query(
      collection(db, "fillInBlankQuestions"),
      where("uid", "==", sessionUser.uid),
      orderBy("createdAt", "desc")
    );
    const questionsSnap = await getDocs(questionsQuery);

    const questions = await Promise.all(
      questionsSnap.docs.map(async (questionDoc) => {
        const questionData = questionDoc.data();
        
        const attemptsQuery = query(
          collection(db, "questionAttempts"),
          where("questionId", "==", questionDoc.id)
        );
        const attemptsSnap = await getDocs(attemptsQuery);
        
        const attempts = attemptsSnap.docs.map((doc) => ({
          isCorrect: doc.data().isCorrect,
        }));

        return {
          id: questionDoc.id,
          title: questionData.title,
          content: questionData.content,
          answers: questionData.answers,
          mode: questionData.mode,
          createdAt: questionData.createdAt?.toDate().toISOString(),
          attempts,
        };
      })
    );

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Failed to fetch questions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, answers, mode } = await req.json();

    const questionRef = doc(collection(db, "fillInBlankQuestions"));
    await setDoc(questionRef, {
      uid: sessionUser.uid,
      title,
      content,
      answers,
      mode: mode || "sequential",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ question: { id: questionRef.id } });
  } catch (error) {
    console.error("Failed to create question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

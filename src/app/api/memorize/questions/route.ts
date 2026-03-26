import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";
import { db } from "@/lib/firebase-server";
import { collection, doc, setDoc, Timestamp, query, where, getDocs, orderBy } from "firebase/firestore/lite";

type QuestionEntry = {
  title: string;
  content: string;
  answers: string[];
  mode?: "sequential" | "all-at-once";
};

export async function GET() {
  try {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let questionsSnap;
    try {
      const questionsQuery = query(
        collection(db, "fillInBlankQuestions"),
        where("uid", "==", sessionUser.uid),
        orderBy("createdAt", "desc")
      );
      questionsSnap = await getDocs(questionsQuery);
    } catch (queryError) {
      console.warn("Failed ordered query, fallback to unordered query:", queryError);
      const fallbackQuery = query(
        collection(db, "fillInBlankQuestions"),
        where("uid", "==", sessionUser.uid)
      );
      questionsSnap = await getDocs(fallbackQuery);
    }

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

    questions.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

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

    const body = await req.json();
    const entries: QuestionEntry[] = Array.isArray(body?.entries)
      ? body.entries
      : [{
          title: body?.title,
          content: body?.content,
          answers: body?.answers,
          mode: body?.mode,
        }];

    if (!entries.length) {
      return NextResponse.json({ error: "No entries to save" }, { status: 400 });
    }

    const normalizedEntries = entries
      .map((entry) => ({
        title: String(entry.title ?? "").trim(),
        content: String(entry.content ?? "").trim(),
        answers: Array.isArray(entry.answers)
          ? entry.answers.map((answer) => String(answer).trim()).filter(Boolean)
          : [],
        mode: entry.mode === "all-at-once" ? "all-at-once" : "sequential",
      }))
      .filter((entry) => entry.title && entry.content && entry.answers.length > 0);

    if (!normalizedEntries.length) {
      return NextResponse.json({ error: "No valid entries" }, { status: 400 });
    }

    const createdIds: string[] = [];

    for (const entry of normalizedEntries) {
      const questionRef = doc(collection(db, "fillInBlankQuestions"));
      await setDoc(questionRef, {
        uid: sessionUser.uid,
        title: entry.title,
        content: entry.content,
        answers: entry.answers,
        mode: entry.mode,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      createdIds.push(questionRef.id);
    }

    return NextResponse.json({
      count: createdIds.length,
      questions: createdIds.map((id) => ({ id })),
      question: { id: createdIds[0] },
    });
  } catch (error) {
    console.error("Failed to create question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

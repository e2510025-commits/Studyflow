import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";

const MAX_ATTEMPTS = 6;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function hashCode(email: string, code: string) {
  const pepper = process.env.EMAIL_VERIFICATION_SECRET || "study-timer-email-code";
  const input = `${email}:${code}:${pepper}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; code?: string };
    const email = normalizeEmail(body.email || "");
    const code = String(body.code || "").trim();

    if (!email || !code) {
      return NextResponse.json({ error: "メールアドレスと認証コードを入力してください" }, { status: 400 });
    }

    const verifyRef = doc(db, "emailVerificationCodes", email);
    const snap = await getDoc(verifyRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: "認証コードが見つかりません。再送してください" }, { status: 404 });
    }

    const data = snap.data();
    const now = Date.now();
    const attempts = Number(data.attempts || 0);
    const expiresAtMs = Number(data.expiresAtMs || 0);

    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "試行回数が上限に達しました。再送してください" }, { status: 429 });
    }

    if (now > expiresAtMs) {
      return NextResponse.json({ error: "認証コードの有効期限が切れています。再送してください" }, { status: 400 });
    }

    const expected = String(data.codeHash || "");
    const provided = await hashCode(email, code);

    if (!expected || expected !== provided) {
      await setDoc(
        verifyRef,
        {
          attempts: attempts + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
    }

    await setDoc(
      verifyRef,
      {
        verified: true,
        verifiedAtMs: now,
        attempts: attempts + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("verify-code error", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

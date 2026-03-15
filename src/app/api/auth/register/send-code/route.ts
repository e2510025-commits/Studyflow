import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { createHash } from "node:crypto";
import { db } from "@/lib/firebase";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(email: string, code: string) {
  const pepper = process.env.EMAIL_VERIFICATION_SECRET || "study-timer-email-code";
  return createHash("sha256").update(`${email}:${code}:${pepper}`).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const rawEmail = body.email || "";
    const email = normalizeEmail(rawEmail);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!resendKey || !from) {
      return NextResponse.json(
        { error: "メール送信設定が未完了です（RESEND_API_KEY / EMAIL_FROM）" },
        { status: 503 }
      );
    }

    const usersRef = collection(db, "users");
    const existing = await getDocs(query(usersRef, where("email", "==", email)));
    if (!existing.empty) {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
    }

    const verifyRef = doc(db, "emailVerificationCodes", email);
    const existingCode = await getDoc(verifyRef);
    const now = Date.now();

    if (existingCode.exists()) {
      const current = existingCode.data();
      const sentAtMs = Number(current.sentAtMs || 0);
      if (now - sentAtMs < RESEND_COOLDOWN_MS) {
        return NextResponse.json(
          { error: "認証コードは1分ごとに再送できます。少し待ってからお試しください" },
          { status: 429 }
        );
      }
    }

    const code = createCode();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "[StudyFlow] メール認証コード",
        html: `<div style="font-family: sans-serif; line-height: 1.7;">
<h2>StudyFlow メール認証</h2>
<p>以下の認証コードを入力してください（10分間有効）</p>
<p style="font-size: 28px; letter-spacing: 0.25em; font-weight: 700;">${code}</p>
<p>このコードに心当たりがない場合は破棄してください。</p>
</div>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Send mail failed:", detail);
      return NextResponse.json({ error: "認証メールの送信に失敗しました" }, { status: 500 });
    }

    await setDoc(
      verifyRef,
      {
        email,
        codeHash: hashCode(email, code),
        sentAtMs: now,
        expiresAtMs: now + CODE_TTL_MS,
        attempts: 0,
        verified: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("send-code error", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

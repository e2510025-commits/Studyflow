import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, updateDoc } from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";

type PairBody = {
  code?: unknown;
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  let body: PairBody;
  try {
    body = (await req.json()) as PairBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawCode = typeof body.code === "string" ? body.code : "";
  const code = normalizeCode(rawCode);

  if (!code || code.length < 6 || code.length > 16) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const codeRef = doc(db, "devicePairingCodes", code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  const data = codeSnap.data() as {
    uid?: string;
    email?: string;
    used?: boolean;
    expiresAtMs?: number;
  };

  const now = Date.now();
  if (typeof data.expiresAtMs !== "number" || data.expiresAtMs <= now) {
    await updateDoc(codeRef, {
      used: true,
      invalidatedAtMs: now,
      invalidatedReason: "expired",
    }).catch(() => {});
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  if (data.used) {
    return NextResponse.json({ error: "code_used" }, { status: 409 });
  }

  if (typeof data.uid !== "string" || !data.uid) {
    return NextResponse.json({ error: "invalid_code_payload" }, { status: 500 });
  }

  await updateDoc(codeRef, {
    used: true,
    consumedAtMs: now,
  });

  return NextResponse.json({
    ok: true,
    uid: data.uid,
    email: typeof data.email === "string" ? data.email : "",
  });
}

import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { resolveSessionUser } from "@/lib/server/sessionUser";

const CODE_LENGTH = 8;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXPIRES_MINUTES = 10;

function makeCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[index];
  }
  return code;
}

async function invalidatePreviousCodes(uid: string) {
  const now = Date.now();
  const snap = await getDocs(query(collection(db, "devicePairingCodes"), where("uid", "==", uid)));
  for (const row of snap.docs) {
    const data = row.data() as { used?: boolean; expiresAtMs?: number };
    if (data.used) continue;
    if (typeof data.expiresAtMs === "number" && data.expiresAtMs <= now) continue;
    await updateDoc(row.ref, {
      used: true,
      invalidatedAtMs: now,
      invalidatedReason: "superseded",
    }).catch(() => {});
  }
}

export async function GET() {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const snap = await getDocs(query(collection(db, "devicePairingCodes"), where("uid", "==", sessionUser.uid)));

  const active = snap.docs
    .map((row) => row.data() as { code?: string; used?: boolean; expiresAtMs?: number })
    .find((row) => {
      if (typeof row.code !== "string") return false;
      if (row.used) return false;
      if (typeof row.expiresAtMs !== "number") return false;
      return row.expiresAtMs > now;
    });

  if (!active) {
    return NextResponse.json({ ok: true, code: null, expiresAtMs: null });
  }

  return NextResponse.json({
    ok: true,
    code: active.code,
    expiresAtMs: active.expiresAtMs,
  });
}

export async function POST() {
  const sessionUser = await resolveSessionUser();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await invalidatePreviousCodes(sessionUser.uid);

  const code = makeCode();
  const now = Date.now();
  const expiresAtMs = now + EXPIRES_MINUTES * 60_000;

  await setDoc(doc(db, "devicePairingCodes", code), {
    code,
    uid: sessionUser.uid,
    email: sessionUser.email || "",
    issuedAt: serverTimestamp(),
    issuedAtMs: now,
    expiresAtMs,
    used: false,
    consumedAtMs: null,
    invalidatedAtMs: null,
  });

  return NextResponse.json({
    ok: true,
    code,
    expiresAtMs,
    expiresInSec: Math.floor((expiresAtMs - now) / 1000),
  });
}

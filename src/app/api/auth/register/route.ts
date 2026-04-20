import { NextResponse } from "next/server";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import bcrypt from "bcryptjs";
import { toAppUid } from "@/lib/identity";
import { sanitizeDisplayName } from "@/lib/identity";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードは必須です" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // メールアドレス重複チェック
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedEmail));
    const existing = await getDocs(q);
    if (!existing.empty) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    const safeName = sanitizeDisplayName(normalizedEmail.split("@")[0]);

    const hashedPassword = await bcrypt.hash(password, 12);
    const docRef = await addDoc(usersRef, {
      name: safeName,
      email: normalizedEmail,
      password: hashedPassword,
      image: "👤",
      emailVerified: true,
      createdAt: serverTimestamp(),
    });

    const appUid = toAppUid(docRef.id);
    await setDoc(
      doc(db, "userProfiles", appUid),
      {
        uid: appUid,
        name: safeName,
        avatar: "👤",
        bio: "",
        visibility: "public",
        dailyGoal: 7200,
        totalPoints: 0,
        bonusPoints: 0,
        profileSetupDone: false,
        showFollowCount: true,
        showFollowerCount: true,
        showFriendCount: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      id: appUid,
      name: safeName,
      email: normalizedEmail,
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import bcrypt from "bcryptjs";
import { toAppUid } from "@/lib/identity";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードは必須です" },
        { status: 400 }
      );
    }

    // メールアドレス重複チェック
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const existing = await getDocs(q);
    if (!existing.empty) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const docRef = await addDoc(usersRef, {
      name: name || email.split("@")[0],
      email,
      password: hashedPassword,
      createdAt: serverTimestamp(),
    });

    const appUid = toAppUid(docRef.id);
    await setDoc(
      doc(db, "userProfiles", appUid),
      {
        uid: appUid,
        name: name || email.split("@")[0],
        avatar: "👤",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      id: appUid,
      name: name || email.split("@")[0],
      email,
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

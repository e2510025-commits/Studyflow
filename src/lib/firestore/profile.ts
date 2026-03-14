import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function saveDisplayProfile(params: {
  uid: string;
  name: string;
  avatar: string;
}) {
  await setDoc(
    doc(db, "userProfiles", params.uid),
    {
      uid: params.uid,
      name: params.name,
      avatar: params.avatar,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", params.uid),
    {
      name: params.name,
      image: params.avatar,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchDisplayProfile(uid: string): Promise<{
  name: string;
  avatar: string;
} | null> {
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    name: data.name || "",
    avatar: data.avatar || "🎓",
  };
}

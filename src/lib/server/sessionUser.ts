import { auth } from "@/lib/auth/auth";
import { toAppUid } from "@/lib/identity";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  avatar: string;
}

export async function resolveSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const email = session.user.email || "";
  const id = session.user.id || "";

  if (id) {
    return {
      uid: toAppUid(id),
      email,
      name: session.user.name || "匿名",
      avatar: session.user.image || "👤",
    };
  }

  if (!email) return null;

  const userSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(1))
  );
  if (userSnap.empty) return null;

  const userData = userSnap.docs[0].data();
  return {
    uid: toAppUid(userSnap.docs[0].id),
    email,
    name: userData.name || session.user.name || "匿名",
    avatar: userData.image || session.user.image || "👤",
  };
}

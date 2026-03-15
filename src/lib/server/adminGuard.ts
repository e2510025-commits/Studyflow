import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isAdminUid } from "@/lib/admin";
import { toAppUid } from "@/lib/identity";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

async function resolveSessionAppUid() {
  const session = await auth();
  const rawUid = session?.user?.id || "";
  if (rawUid) {
    return toAppUid(rawUid);
  }

  const email = session?.user?.email || "";
  if (!email) return "";

  const userSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(1))
  );
  if (userSnap.empty) return "";
  return toAppUid(userSnap.docs[0].id);
}

export async function requireAdmin() {
  const appUid = await resolveSessionAppUid();

  if (!appUid || !isAdminUid(appUid)) {
    return {
      ok: false as const,
      appUid: "",
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    appUid,
    response: null,
  };
}

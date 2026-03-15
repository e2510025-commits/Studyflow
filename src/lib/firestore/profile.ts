import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import type { ProfileVisibility, PublicProfile } from "@/types";

export async function saveDisplayProfile(params: {
  uid: string;
  name: string;
  avatar: string;
  bio?: string;
  visibility?: ProfileVisibility;
  dailyGoal?: number;
  totalPoints?: number;
  bonusPoints?: number;
  profileSetupDone?: boolean;
}) {
  const safeName = sanitizeDisplayName(params.name);
  const safeAvatar = sanitizeAvatar(params.avatar);
  const payload: Record<string, unknown> = {
    uid: params.uid,
    name: safeName,
    avatar: safeAvatar,
    bio: (params.bio || "").trim().slice(0, 280),
    visibility: params.visibility || "public",
    dailyGoal: typeof params.dailyGoal === "number" ? params.dailyGoal : 0,
    totalPoints: typeof params.totalPoints === "number" ? params.totalPoints : 0,
    bonusPoints: typeof params.bonusPoints === "number" ? params.bonusPoints : 0,
    updatedAt: serverTimestamp(),
  };
  if (typeof params.profileSetupDone === "boolean") {
    payload.profileSetupDone = params.profileSetupDone;
  }

  await setDoc(
    doc(db, "userProfiles", params.uid),
    payload,
    { merge: true }
  );

  await setDoc(
    doc(db, "users", params.uid),
    {
      name: safeName,
      image: safeAvatar,
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
    name: sanitizeDisplayName(data.name),
    avatar: sanitizeAvatar(data.avatar || "🎓"),
  };
}

export async function fetchPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;
  const data = snap.data();

  return {
    uid,
    name: sanitizeDisplayName(data.name),
    avatar: sanitizeAvatar(data.avatar),
    bio: typeof data.bio === "string" ? data.bio : "",
    isOfficial: Boolean(data.isOfficial),
    visibility: (["public", "friends", "private"].includes(data.visibility)
      ? data.visibility
      : "public") as ProfileVisibility,
    dailyGoal: typeof data.dailyGoal === "number" ? data.dailyGoal : 0,
    totalPoints: typeof data.totalPoints === "number" ? data.totalPoints : 0,
    bonusPoints: typeof data.bonusPoints === "number" ? data.bonusPoints : 0,
    profileSetupDone: typeof data.profileSetupDone === "boolean" ? data.profileSetupDone : true,
  };
}

export async function canViewProfile(targetUid: string, viewerUid: string): Promise<boolean> {
  if (!viewerUid || targetUid === viewerUid) return true;

  const profile = await fetchPublicProfile(targetUid);
  if (!profile) return false;
  if (profile.visibility === "public") return true;
  if (profile.visibility === "private") return false;

  const relationSnap = await getDocs(
    query(
      collection(db, "friends"),
      where("ownerUid", "==", targetUid),
      where("uid", "==", viewerUid)
    )
  );
  return !relationSnap.empty;
}

export async function fetchUserStudyStats(uid: string): Promise<{
  totalSeconds: number;
  totalSessions: number;
}> {
  const snap = await getDocs(
    query(collection(db, "studyLogs"), where("userUid", "==", uid))
  );

  let totalSeconds = 0;
  for (const d of snap.docs) {
    const data = d.data();
    totalSeconds += typeof data.duration === "number" ? data.duration : 0;
  }

  return {
    totalSeconds,
    totalSessions: snap.size,
  };
}

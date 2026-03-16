import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import type { Friend, ProfileVisibility, PublicProfile } from "@/types";

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
  equippedBadges?: string[];
  statusMessage?: string;
  headerImage?: string;
  deviceLabel?: string;
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
  if (Array.isArray(params.equippedBadges)) {
    payload.equippedBadges = params.equippedBadges.slice(0, 3);
  }
  if (typeof params.statusMessage === "string") {
    payload.statusMessage = params.statusMessage.trim().slice(0, 120);
  }
  if (typeof params.headerImage === "string") {
    payload.headerImage = params.headerImage.slice(0, 2_000_000);
  }
  if (typeof params.deviceLabel === "string") {
    payload.deviceLabel = params.deviceLabel.trim().slice(0, 40);
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
    badges: Array.isArray(data.badges) ? data.badges.filter((b: unknown) => typeof b === "string") : [],
    achievementUnlockedAt:
      typeof data.achievementUnlockedAt === "object" && data.achievementUnlockedAt
        ? (data.achievementUnlockedAt as Record<string, string>)
        : {},
    equippedBadges: Array.isArray(data.equippedBadges)
      ? data.equippedBadges.filter((b: unknown) => typeof b === "string").slice(0, 3)
      : [],
    statusMessage: typeof data.statusMessage === "string" ? data.statusMessage : "",
    headerImage: typeof data.headerImage === "string" ? data.headerImage : "",
    deviceLabel: typeof data.deviceLabel === "string" ? data.deviceLabel : "",
  };
}

export async function updateEquippedBadges(uid: string, badges: string[]) {
  await setDoc(
    doc(db, "userProfiles", uid),
    {
      equippedBadges: badges.slice(0, 3),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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

export async function fetchUserFriendsPreview(uid: string, take = 16): Promise<Friend[]> {
  const snap = await getDocs(
    query(collection(db, "friends"), where("ownerUid", "==", uid), limit(Math.max(1, take)))
  );

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: String(data.uid || ""),
      name: sanitizeDisplayName(data.name),
      avatar: sanitizeAvatar(data.avatar),
      addedAt:
        typeof data.addedAt?.toDate === "function"
          ? data.addedAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  });
}

export async function fetchUserHeatmap(uid: string, days = 84): Promise<Record<string, number>> {
  const snap = await getDocs(query(collection(db, "studyLogs"), where("userUid", "==", uid)));
  const now = Date.now();
  const fromMs = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const map: Record<string, number> = {};

  snap.docs.forEach((d) => {
    const data = d.data();
    const raw = data.createdAt;
    const dt =
      raw && typeof raw.toDate === "function"
        ? raw.toDate()
        : typeof raw === "string"
        ? new Date(raw)
        : null;
    if (!dt) return;
    const ms = dt.getTime();
    if (Number.isNaN(ms) || ms < fromMs) return;
    const key = dt.toISOString().slice(0, 10);
    map[key] = (map[key] || 0) + Number(data.duration || 0);
  });

  return map;
}

function cheerDocId(targetUid: string, fromUid: string): string {
  return `${targetUid}_${fromUid}`;
}

export async function fetchProfileCheerSummary(targetUid: string, viewerUid?: string): Promise<{ count: number; cheeredByViewer: boolean }> {
  const countSnap = await getDocs(query(collection(db, "profileCheers"), where("targetUid", "==", targetUid)));
  if (!viewerUid) return { count: countSnap.size, cheeredByViewer: false };

  const mySnap = await getDoc(doc(db, "profileCheers", cheerDocId(targetUid, viewerUid)));
  return {
    count: countSnap.size,
    cheeredByViewer: mySnap.exists(),
  };
}

export async function setProfileCheer(targetUid: string, fromUid: string, cheer: boolean): Promise<void> {
  if (!targetUid || !fromUid || targetUid === fromUid) return;
  const ref = doc(db, "profileCheers", cheerDocId(targetUid, fromUid));
  if (cheer) {
    await setDoc(
      ref,
      {
        targetUid,
        fromUid,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }
  await deleteDoc(ref);
}

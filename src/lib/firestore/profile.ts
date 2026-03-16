import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import type { Friend, ProfileVisibility, PublicProfile } from "@/types";

export interface FollowListUser {
  uid: string;
  name: string;
  avatar: string;
  addedAt: string;
}

export interface FollowListsResult {
  following: FollowListUser[];
  followers: FollowListUser[];
  friends: FollowListUser[];
  followingSet: Set<string>;
  followerSet: Set<string>;
  friendSet: Set<string>;
}

export interface ProfileActivityItem {
  id: string;
  type: "badge" | "study";
  createdAt: string;
  label: string;
  detail?: string;
}

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
  showFollowCount?: boolean;
  showFollowerCount?: boolean;
  showFriendCount?: boolean;
  helpfulReceived?: number;
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
  if (typeof params.showFollowCount === "boolean") {
    payload.showFollowCount = params.showFollowCount;
  }
  if (typeof params.showFollowerCount === "boolean") {
    payload.showFollowerCount = params.showFollowerCount;
  }
  if (typeof params.showFriendCount === "boolean") {
    payload.showFriendCount = params.showFriendCount;
  }
  if (typeof params.helpfulReceived === "number") {
    payload.helpfulReceived = Math.max(0, Math.floor(params.helpfulReceived));
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
    showFollowCount: typeof data.showFollowCount === "boolean" ? data.showFollowCount : true,
    showFollowerCount: typeof data.showFollowerCount === "boolean" ? data.showFollowerCount : true,
    showFriendCount: typeof data.showFriendCount === "boolean" ? data.showFriendCount : true,
    helpfulReceived: typeof data.helpfulReceived === "number" ? data.helpfulReceived : 0,
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

export function subscribeFollowCounts(
  uid: string,
  callback: (counts: { following: number; followers: number }) => void
) {
  if (!uid) {
    callback({ following: 0, followers: 0 });
    return () => {};
  }

  let following = 0;
  let followers = 0;
  const emit = () => callback({ following, followers });

  const unsubFollowing = onSnapshot(
    query(collection(db, "follows"), where("ownerUid", "==", uid)),
    (snapshot) => {
      following = snapshot.size;
      emit();
    },
    () => {
      following = 0;
      emit();
    }
  );

  const unsubFollowers = onSnapshot(
    query(collection(db, "follows"), where("targetUid", "==", uid)),
    (snapshot) => {
      followers = snapshot.size;
      emit();
    },
    () => {
      followers = 0;
      emit();
    }
  );

  return () => {
    unsubFollowing();
    unsubFollowers();
  };
}

export function subscribeFriendCount(uid: string, callback: (count: number) => void) {
  if (!uid) {
    callback(0);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, "friends"), where("ownerUid", "==", uid)),
    (snapshot) => callback(snapshot.size),
    () => callback(0)
  );
}

async function fetchProfilesByUids(uids: string[]): Promise<Map<string, { name: string; avatar: string }>> {
  const map = new Map<string, { name: string; avatar: string }>();
  if (uids.length === 0) return map;

  await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "userProfiles", uid));
        if (!snap.exists()) return;
        const data = snap.data();
        map.set(uid, {
          name: sanitizeDisplayName(data.name),
          avatar: sanitizeAvatar(data.avatar),
        });
      } catch {
        // skip profile fetch failure
      }
    })
  );

  return map;
}

export async function fetchFollowLists(uid: string, take = 300): Promise<FollowListsResult> {
  if (!uid) {
    return {
      following: [],
      followers: [],
      friends: [],
      followingSet: new Set<string>(),
      followerSet: new Set<string>(),
      friendSet: new Set<string>(),
    };
  }

  const safeTake = Math.max(10, Math.min(1000, Math.floor(take)));
  const [followingSnap, followerSnap, friendsSnap] = await Promise.all([
    getDocs(query(collection(db, "follows"), where("ownerUid", "==", uid), limit(safeTake))),
    getDocs(query(collection(db, "follows"), where("targetUid", "==", uid), limit(safeTake))),
    getDocs(query(collection(db, "friends"), where("ownerUid", "==", uid), limit(safeTake))),
  ]);

  const followingSet = new Set<string>();
  const followerSet = new Set<string>();
  const friendSet = new Set<string>();
  followingSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.targetUid) followingSet.add(String(data.targetUid));
  });
  followerSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.ownerUid) followerSet.add(String(data.ownerUid));
  });
  friendsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.uid) friendSet.add(String(data.uid));
  });

  const allUids = Array.from(new Set([...followingSet, ...followerSet, ...friendSet]));
  const profileMap = await fetchProfilesByUids(allUids);

  const following: FollowListUser[] = followingSnap.docs.map((d) => {
    const data = d.data();
    const targetUid = String(data.targetUid || "");
    const profile = profileMap.get(targetUid);
    return {
      uid: targetUid,
      name: profile?.name || sanitizeDisplayName(data.name || "匿名"),
      avatar: profile?.avatar || sanitizeAvatar(data.avatar || "👤"),
      addedAt:
        typeof data.createdAt?.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  });

  const followers: FollowListUser[] = followerSnap.docs.map((d) => {
    const data = d.data();
    const ownerUid = String(data.ownerUid || "");
    const profile = profileMap.get(ownerUid);
    return {
      uid: ownerUid,
      name: profile?.name || "匿名",
      avatar: profile?.avatar || "👤",
      addedAt:
        typeof data.createdAt?.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  });

  const friends: FollowListUser[] = friendsSnap.docs.map((d) => {
    const data = d.data();
    const friendUid = String(data.uid || "");
    const profile = profileMap.get(friendUid);
    return {
      uid: friendUid,
      name: profile?.name || sanitizeDisplayName(data.name || "匿名"),
      avatar: profile?.avatar || sanitizeAvatar(data.avatar || "👤"),
      addedAt:
        typeof data.addedAt?.toDate === "function"
          ? data.addedAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  });

  return { following, followers, friends, followingSet, followerSet, friendSet };
}

function followDocId(ownerUid: string, targetUid: string): string {
  return `${ownerUid}_${targetUid}`;
}

export async function isFollowing(ownerUid: string, targetUid: string): Promise<boolean> {
  if (!ownerUid || !targetUid || ownerUid === targetUid) return false;
  const snap = await getDoc(doc(db, "follows", followDocId(ownerUid, targetUid)));
  return snap.exists();
}

export function subscribeFollowState(
  ownerUid: string,
  targetUid: string,
  callback: (following: boolean) => void
) {
  if (!ownerUid || !targetUid || ownerUid === targetUid) {
    callback(false);
    return () => {};
  }

  return onSnapshot(
    doc(db, "follows", followDocId(ownerUid, targetUid)),
    (snapshot) => callback(snapshot.exists()),
    () => callback(false)
  );
}

export async function setFollow(ownerUid: string, targetUid: string, follow: boolean): Promise<void> {
  if (!ownerUid || !targetUid || ownerUid === targetUid) return;
  const ref = doc(db, "follows", followDocId(ownerUid, targetUid));
  if (follow) {
    await setDoc(
      ref,
      {
        ownerUid,
        targetUid,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }
  await deleteDoc(ref);
}

export async function fetchRecentProfileActivity(uid: string, take = 8): Promise<ProfileActivityItem[]> {
  if (!uid) return [];
  const safeTake = Math.max(3, Math.min(20, Math.floor(take)));

  const [profileSnap, logsSnap, subjectsSnap] = await Promise.all([
    getDoc(doc(db, "userProfiles", uid)),
    getDocs(query(collection(db, "studyLogs"), where("userUid", "==", uid))),
    getDocs(query(collection(db, "userSubjects"), where("ownerUid", "==", uid))),
  ]);

  const subjectNameMap = new Map<string, string>();
  subjectsSnap.docs.forEach((d) => {
    const data = d.data();
    subjectNameMap.set(d.id, String(data.name || "学習"));
  });

  const activities: ProfileActivityItem[] = [];

  const unlockMap =
    profileSnap.exists() && typeof profileSnap.data().achievementUnlockedAt === "object"
      ? (profileSnap.data().achievementUnlockedAt as Record<string, string>)
      : {};

  Object.entries(unlockMap).forEach(([badgeId, at]) => {
    const date = new Date(at);
    activities.push({
      id: `badge_${badgeId}`,
      type: "badge",
      createdAt: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
      label: "勲章を獲得",
      detail: badgeId,
    });
  });

  logsSnap.docs.forEach((d) => {
    const data = d.data();
    const createdAtRaw = data.createdAt;
    const createdAt =
      createdAtRaw && typeof createdAtRaw.toDate === "function"
        ? createdAtRaw.toDate().toISOString()
        : typeof createdAtRaw === "string"
        ? createdAtRaw
        : new Date().toISOString();
    const subjectLabel = subjectNameMap.get(String(data.subjectId || "")) || "学習";
    const durationMinutes = Math.max(1, Math.floor(Number(data.duration || 0) / 60));
    activities.push({
      id: `study_${d.id}`,
      type: "study",
      createdAt,
      label: `${subjectLabel} を完了`,
      detail: `${durationMinutes}分` ,
    });
  });

  return activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, safeTake);
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

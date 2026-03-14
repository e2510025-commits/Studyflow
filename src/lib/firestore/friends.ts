import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Friend } from "@/types";
import { sanitizeAvatar, sanitizeDisplayName, toAppUid } from "@/lib/identity";

const FRIENDS_COLLECTION = "friends";

/**
 * ユーザーのフレンドリストをリアルタイム購読
 */
export function subscribeFriends(
  userUid: string,
  callback: (friends: Friend[]) => void
) {
  const q = query(
    collection(db, FRIENDS_COLLECTION),
    where("ownerUid", "==", userUid)
  );

  return onSnapshot(q, (snapshot) => {
    const friends: Friend[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: data.uid,
        name: data.name,
        avatar: data.avatar,
        addedAt:
          data.addedAt instanceof Timestamp
            ? data.addedAt.toDate().toISOString()
            : data.addedAt,
      };
    });
    callback(friends);
  });
}

/**
 * フレンドを Firestore に追加
 */
export async function addFriendToFirestore(
  ownerUid: string,
  friend: Omit<Friend, "addedAt">
): Promise<void> {
  await addDoc(collection(db, FRIENDS_COLLECTION), {
    ownerUid,
    ...friend,
    addedAt: serverTimestamp(),
  });
}

/**
 * フレンドを削除
 */
export async function removeFriendFromFirestore(
  ownerUid: string,
  friendUid: string
): Promise<void> {
  const q = query(
    collection(db, FRIENDS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("uid", "==", friendUid)
  );
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, FRIENDS_COLLECTION, d.id))));
}

export async function searchUsersForFriend(
  keyword: string,
  myUid: string,
  existingFriendUids: string[]
): Promise<Array<Omit<Friend, "addedAt">>> {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return [];

  const blocked = new Set([myUid, ...existingFriendUids]);
  const resultMap = new Map<string, Omit<Friend, "addedAt">>();

  const pushCandidate = (candidate: Omit<Friend, "addedAt">) => {
    if (!candidate.uid) return;
    if (blocked.has(candidate.uid)) return;
    if (resultMap.has(candidate.uid)) return;
    resultMap.set(candidate.uid, {
      uid: candidate.uid,
      name: sanitizeDisplayName(candidate.name),
      avatar: sanitizeAvatar(candidate.avatar),
    });
  };

  // Fast-path: direct UID lookup for 10-digit UID searches
  if (/^\d{10}$/.test(normalized)) {
    const direct = await getDoc(doc(db, "userProfiles", normalized));
    if (direct.exists()) {
      const data = direct.data();
      pushCandidate({
        uid: normalized,
        name: data.name || "匿名",
        avatar: data.avatar || "👤",
      });
    }
  }

  const profileSnapshot = await getDocs(
    query(collection(db, "userProfiles"), limit(1000))
  );

  profileSnapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name || "匿名",
        avatar: data.avatar || "👤",
      };
    })
    .forEach((u) => {
      if (
        u.uid.toLowerCase().includes(normalized) ||
        u.name.toLowerCase().includes(normalized)
      ) {
        pushCandidate(u);
      }
    });

  // Fallback source: users collection (helps users who haven't created userProfiles yet)
  const usersSnapshot = await getDocs(query(collection(db, "users"), limit(1000)));
  usersSnapshot.docs.forEach((d) => {
    const data = d.data();
    const appUid = toAppUid(d.id);
    const name = sanitizeDisplayName(data.name || data.displayName || "匿名");
    const avatar = sanitizeAvatar(data.image || data.avatar || "👤");

    if (appUid.includes(normalized) || name.toLowerCase().includes(normalized)) {
      pushCandidate({ uid: appUid, name, avatar });
    }
  });

  return Array.from(resultMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .slice(0, 20);
}

export async function getUserProfileByUid(
  uid: string
): Promise<Omit<Friend, "addedAt"> | null> {
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;

  const d = snap.data();
  return {
    uid,
    name: sanitizeDisplayName(d.name),
    avatar: sanitizeAvatar(d.avatar),
  };
}

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

  const profileSnapshot = await getDocs(
    query(collection(db, "userProfiles"), limit(200))
  );

  return profileSnapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name || "匿名",
        avatar: data.avatar || "👤",
      };
    })
    .filter((u) => {
      if (u.uid === myUid) return false;
      if (existingFriendUids.includes(u.uid)) return false;
      return (
        u.uid.toLowerCase().includes(normalized) ||
        u.name.toLowerCase().includes(normalized)
      );
    })
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
    name: d.name || "匿名",
    avatar: d.avatar || "👤",
  };
}

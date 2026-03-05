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
  const { getDocs } = await import("firebase/firestore");
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, FRIENDS_COLLECTION, d.id))));
}

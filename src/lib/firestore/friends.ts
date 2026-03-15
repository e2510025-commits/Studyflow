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
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Friend, FriendRequest } from "@/types";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

const FRIENDS_COLLECTION = "friends";
const FRIEND_REQUESTS_COLLECTION = "friendRequests";

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
        name: sanitizeDisplayName(data.name),
        avatar: sanitizeAvatar(data.avatar),
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

export async function sendFriendRequest(params: {
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  toUid: string;
}): Promise<void> {
  if (params.fromUid === params.toUid) return;

  const alreadyFriends = await getDocs(
    query(
      collection(db, FRIENDS_COLLECTION),
      where("ownerUid", "==", params.fromUid),
      where("uid", "==", params.toUid),
      limit(1)
    )
  );
  if (!alreadyFriends.empty) return;

  const existingReq = await getDocs(
    query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where("fromUid", "==", params.fromUid),
      where("toUid", "==", params.toUid),
      where("status", "==", "pending"),
      limit(1)
    )
  );
  if (!existingReq.empty) return;

  await addDoc(collection(db, FRIEND_REQUESTS_COLLECTION), {
    fromUid: params.fromUid,
    fromName: sanitizeDisplayName(params.fromName),
    fromAvatar: sanitizeAvatar(params.fromAvatar),
    toUid: params.toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export function subscribeIncomingFriendRequests(
  myUid: string,
  callback: (requests: FriendRequest[]) => void
) {
  const q = query(
    collection(db, FRIEND_REQUESTS_COLLECTION),
    where("toUid", "==", myUid),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromUid: data.fromUid,
        fromName: sanitizeDisplayName(data.fromName),
        fromAvatar: sanitizeAvatar(data.fromAvatar),
        toUid: data.toUid,
        status: data.status,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      } satisfies FriendRequest;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    callback(requests);
  });
}

export function subscribeOutgoingFriendRequests(
  myUid: string,
  callback: (requests: FriendRequest[]) => void
) {
  const q = query(
    collection(db, FRIEND_REQUESTS_COLLECTION),
    where("fromUid", "==", myUid),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromUid: data.fromUid,
        fromName: sanitizeDisplayName(data.fromName),
        fromAvatar: sanitizeAvatar(data.fromAvatar),
        toUid: data.toUid,
        status: data.status,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      } satisfies FriendRequest;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    callback(requests);
  });
}

export async function respondFriendRequest(
  requestId: string,
  action: "accept" | "decline"
): Promise<void> {
  const reqRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const data = reqSnap.data();
  if (data.status !== "pending") return;

  const batch = writeBatch(db);
  batch.set(
    reqRef,
    {
      status: action === "accept" ? "accepted" : "declined",
      respondedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (action === "accept") {
    const fromProfile = await getUserProfileByUid(data.fromUid);
    const toProfile = await getUserProfileByUid(data.toUid);

    const fromRef = doc(collection(db, FRIENDS_COLLECTION));
    const toRef = doc(collection(db, FRIENDS_COLLECTION));

    batch.set(fromRef, {
      ownerUid: data.fromUid,
      uid: data.toUid,
      name: sanitizeDisplayName(toProfile?.name || "匿名"),
      avatar: sanitizeAvatar(toProfile?.avatar || "👤"),
      addedAt: serverTimestamp(),
    });
    batch.set(toRef, {
      ownerUid: data.toUid,
      uid: data.fromUid,
      name: sanitizeDisplayName(fromProfile?.name || data.fromName || "匿名"),
      avatar: sanitizeAvatar(fromProfile?.avatar || data.fromAvatar || "👤"),
      addedAt: serverTimestamp(),
    });
  }

  await batch.commit();
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

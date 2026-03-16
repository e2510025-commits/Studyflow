import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const USER_PRESENCE_COLLECTION = "userPresence";
const ONLINE_ALIVE_THRESHOLD_MS = 1000 * 60 * 2;

function chunk<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

export async function updateUserPresence(userUid: string, isOnline: boolean) {
  if (!userUid) return;
  await setDoc(
    doc(db, USER_PRESENCE_COLLECTION, userUid),
    {
      userUid,
      isOnline,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeUsersOnlineStatus(
  userUids: string[],
  callback: (onlineUidSet: Set<string>) => void
) {
  const unique = Array.from(new Set(userUids.filter(Boolean)));
  if (unique.length === 0) {
    callback(new Set());
    return () => {};
  }

  const unsubscribers: Array<() => void> = [];
  const stateMap = new Map<string, Set<string>>();

  const emit = () => {
    const merged = new Set<string>();
    for (const set of stateMap.values()) {
      set.forEach((uid) => merged.add(uid));
    }
    callback(merged);
  };

  chunk(unique, 10).forEach((uids, index) => {
    const chunkKey = `chunk_${index}`;
    stateMap.set(chunkKey, new Set());
    const q = query(
      collection(db, USER_PRESENCE_COLLECTION),
      where("userUid", "in", uids)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const online = new Set<string>();
        snapshot.docs.forEach((row) => {
          const data = row.data();
          const updatedAt = data.updatedAt;
          if (!(updatedAt instanceof Timestamp)) return;
          const alive = now - updatedAt.toDate().getTime() <= ONLINE_ALIVE_THRESHOLD_MS;
          if (data.isOnline && alive && data.userUid) {
            online.add(String(data.userUid));
          }
        });
        stateMap.set(chunkKey, online);
        emit();
      },
      () => {
        stateMap.set(chunkKey, new Set());
        emit();
      }
    );

    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

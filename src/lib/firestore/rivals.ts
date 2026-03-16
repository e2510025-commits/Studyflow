import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const RIVALS_COLLECTION = "rivals";

export interface RivalEntry {
  id: string;
  ownerUid: string;
  rivalUid: string;
  createdAt: string;
}

export function subscribeRivals(ownerUid: string, callback: (rows: RivalEntry[]) => void) {
  if (!ownerUid) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, RIVALS_COLLECTION), where("ownerUid", "==", ownerUid));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerUid: String(data.ownerUid || ""),
        rivalUid: String(data.rivalUid || ""),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      } satisfies RivalEntry;
    });
    callback(rows);
  });
}

export async function addRival(ownerUid: string, rivalUid: string) {
  if (!ownerUid || !rivalUid || ownerUid === rivalUid) return;
  const exists = await getDocs(
    query(
      collection(db, RIVALS_COLLECTION),
      where("ownerUid", "==", ownerUid),
      where("rivalUid", "==", rivalUid)
    )
  );
  if (!exists.empty) return;

  await addDoc(collection(db, RIVALS_COLLECTION), {
    ownerUid,
    rivalUid,
    createdAt: serverTimestamp(),
  });
}

export async function removeRival(ownerUid: string, rivalUid: string) {
  const snapshot = await getDocs(
    query(
      collection(db, RIVALS_COLLECTION),
      where("ownerUid", "==", ownerUid),
      where("rivalUid", "==", rivalUid)
    )
  );

  await Promise.all(snapshot.docs.map((row) => deleteDoc(row.ref)));
}

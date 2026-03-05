import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StudyLog } from "@/types";

const LOGS_COLLECTION = "studyLogs";

/**
 * ユーザーのスタディログをリアルタイム購読
 * @returns unsubscribe 関数
 */
export function subscribeStudyLogs(
  userUid: string,
  callback: (logs: StudyLog[]) => void
) {
  const q = query(
    collection(db, LOGS_COLLECTION),
    where("userUid", "==", userUid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const logs: StudyLog[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        subjectId: data.subjectId,
        duration: data.duration,
        memo: data.memo ?? "",
        focusRating: data.focusRating,
        focusBonus: data.focusBonus,
        points: data.points,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      };
    });
    callback(logs);
  });
}

/**
 * スタディログを Firestore に追加
 */
export async function addStudyLogToFirestore(
  userUid: string,
  log: Omit<StudyLog, "id" | "createdAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, LOGS_COLLECTION), {
    userUid,
    ...log,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * スタディログを削除
 */
export async function deleteStudyLogFromFirestore(logId: string): Promise<void> {
  await deleteDoc(doc(db, LOGS_COLLECTION, logId));
}

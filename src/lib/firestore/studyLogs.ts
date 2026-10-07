import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
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
    where("userUid", "==", userUid)
  );

  return onSnapshot(q, (snapshot) => {
    const logs: StudyLog[] = snapshot.docs.map((d) => {
      const data = d.data();
      const createdAtIso =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === "string"
          ? data.createdAt
          : new Date().toISOString();
      return {
        id: d.id,
        subjectId: data.subjectId,
        duration: data.duration,
        memo: data.memo ?? "",
        focusRating: data.focusRating,
        focusBonus: data.focusBonus,
        points: data.points,
        createdAt: createdAtIso,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(logs);
  });
}

/**
 * スタディログを Firestore に追加
 * オプションで userProfile を渡すとランキング用プロフィールも更新
 */
export async function addStudyLogToFirestore(
  userUid: string,
  log: Omit<StudyLog, "id" | "createdAt">,
  userProfile?: { name: string; avatar: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, LOGS_COLLECTION), {
    userUid,
    ...log,
    createdAt: serverTimestamp(),
  });

  // ランキング用プロフィールも保存
  if (userProfile) {
    setDoc(
      doc(db, "userProfiles", userUid),
      { uid: userUid, name: userProfile.name, avatar: userProfile.avatar, updatedAt: new Date() },
      { merge: true }
    ).catch(() => {});
  }


  return docRef.id;
}

/**
 * 実行中セッションを同一ドキュメントに保存/更新
 * (終了前でもランキングやポイント反映を進めるための upsert)
 */
export async function upsertStudyLogById(
  userUid: string,
  logId: string,
  log: Omit<StudyLog, "id" | "createdAt">,
  options?: {
    userProfile?: { name: string; avatar: string };
    createdAt?: Date;
    /** @deprecated 実績機能終了。互換性のため引数のみ保持。 */
    recomputeAchievements?: boolean;
  }
): Promise<void> {
  const logData = {
    userUid,
    subjectId: log.subjectId,
    duration: log.duration,
    memo: log.memo || "",
    focusRating: log.focusRating,
    focusBonus: log.focusBonus,
    points: log.points,
    createdAt: options?.createdAt ? Timestamp.fromDate(options.createdAt) : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    doc(db, LOGS_COLLECTION, logId),
    logData,
    { merge: true }
  );

  if (options?.userProfile) {
    await setDoc(
      doc(db, "userProfiles", userUid),
      {
        uid: userUid,
        name: options.userProfile.name,
        avatar: options.userProfile.avatar,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }

}

/**
 * スタディログを削除
 */
export async function deleteStudyLogFromFirestore(logId: string): Promise<void> {
  await deleteDoc(doc(db, LOGS_COLLECTION, logId));
}

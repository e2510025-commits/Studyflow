import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const ACTIVE_SESSIONS = "activeStudySessions";

function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase();
}

export async function upsertActiveStudySession(params: {
  userUid: string;
  subjectName: string;
  isActive: boolean;
}) {
  const normalizedSubject = normalizeSubjectName(params.subjectName);
  await setDoc(
    doc(db, ACTIVE_SESSIONS, params.userUid),
    {
      userUid: params.userUid,
      subjectName: params.subjectName,
      normalizedSubject,
      isActive: params.isActive,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeActiveSubjectCount(
  subjectName: string,
  callback: (count: number) => void
) {
  const normalizedSubject = normalizeSubjectName(subjectName);
  if (!normalizedSubject) {
    callback(0);
    return () => {};
  }

  const q = query(
    collection(db, ACTIVE_SESSIONS),
    where("normalizedSubject", "==", normalizedSubject),
    where("isActive", "==", true)
  );

  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const aliveThresholdMs = 1000 * 60 * 10;

    const activeCount = snapshot.docs.filter((d) => {
      const updatedAt = d.data().updatedAt;
      if (!(updatedAt instanceof Timestamp)) {
        return false;
      }
      return now - updatedAt.toDate().getTime() <= aliveThresholdMs;
    }).length;

    callback(activeCount);
  });
}

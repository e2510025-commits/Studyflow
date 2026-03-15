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
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

const ACTIVE_SESSIONS = "activeStudySessions";

function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase();
}

export async function upsertActiveStudySession(params: {
  userUid: string;
  subjectName: string;
  isActive: boolean;
  userName?: string;
  userAvatar?: string;
}) {
  const normalizedSubject = normalizeSubjectName(params.subjectName);
  await setDoc(
    doc(db, ACTIVE_SESSIONS, params.userUid),
    {
      userUid: params.userUid,
      userName: sanitizeDisplayName(params.userName || "匿名"),
      userAvatar: sanitizeAvatar(params.userAvatar || "👤"),
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

export interface ActiveStudyUser {
  userUid: string;
  userName: string;
  userAvatar: string;
}

export function subscribeActiveSubjectRoom(
  subjectName: string,
  callback: (payload: { count: number; users: ActiveStudyUser[] }) => void
) {
  const normalizedSubject = normalizeSubjectName(subjectName);
  if (!normalizedSubject) {
    callback({ count: 0, users: [] });
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

    const users = snapshot.docs
      .map((d) => d.data())
      .filter((row) => {
        const updatedAt = row.updatedAt;
        if (!(updatedAt instanceof Timestamp)) {
          return false;
        }
        return now - updatedAt.toDate().getTime() <= aliveThresholdMs;
      })
      .map((row) => ({
        userUid: String(row.userUid || ""),
        userName: sanitizeDisplayName(row.userName || "匿名"),
        userAvatar: sanitizeAvatar(row.userAvatar || "👤"),
      }))
      .filter((u) => u.userUid);

    callback({ count: users.length, users });
  });
}

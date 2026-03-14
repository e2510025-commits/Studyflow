import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SUBJECTS } from "@/lib/utils";
import type { Subject } from "@/types";

const USER_SUBJECTS_COLLECTION = "userSubjects";

export function subscribeUserSubjects(
  userUid: string,
  callback: (subjects: Subject[]) => void
) {
  const q = query(
    collection(db, USER_SUBJECTS_COLLECTION),
    where("ownerUid", "==", userUid)
  );

  return onSnapshot(q, (snapshot) => {
    const subjects = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        color: data.color,
        icon: data.icon,
      } satisfies Subject;
    });

    callback(subjects);
  });
}

export async function ensureDefaultUserSubjects(userUid: string): Promise<void> {
  const q = query(
    collection(db, USER_SUBJECTS_COLLECTION),
    where("ownerUid", "==", userUid)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_SUBJECTS.map((subject) =>
      addDoc(collection(db, USER_SUBJECTS_COLLECTION), {
        ownerUid: userUid,
        ...subject,
        createdAt: serverTimestamp(),
      })
    )
  );
}

export async function addUserSubject(
  userUid: string,
  payload: Omit<Subject, "id">
): Promise<void> {
  await addDoc(collection(db, USER_SUBJECTS_COLLECTION), {
    ownerUid: userUid,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserSubject(
  subjectId: string,
  payload: Omit<Subject, "id">
): Promise<void> {
  await setDoc(
    doc(db, USER_SUBJECTS_COLLECTION, subjectId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteUserSubject(subjectId: string): Promise<void> {
  await deleteDoc(doc(db, USER_SUBJECTS_COLLECTION, subjectId));
}

export async function fetchUserSubjectsByNamePrefix(
  userUid: string,
  queryText: string
): Promise<Subject[]> {
  const q = query(
    collection(db, USER_SUBJECTS_COLLECTION),
    where("ownerUid", "==", userUid)
  );
  const snapshot = await getDocs(q);
  const normalized = queryText.trim().toLowerCase();

  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        color: data.color,
        icon: data.icon,
      } satisfies Subject;
    })
    .filter((s) => s.name.toLowerCase().includes(normalized));
}

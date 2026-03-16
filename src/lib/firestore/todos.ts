import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserTodo {
  id: string;
  ownerUid: string;
  title: string;
  subjectId?: string;
  targetPages?: number;
  done: boolean;
  createdAt: string;
  updatedAt?: string;
}

const TODOS_COLLECTION = "userTodos";

export function subscribeUserTodos(ownerUid: string, callback: (rows: UserTodo[]) => void) {
  if (!ownerUid) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, TODOS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerUid,
        title: String(data.title || ""),
        subjectId: data.subjectId ? String(data.subjectId) : undefined,
        targetPages: typeof data.targetPages === "number" ? data.targetPages : undefined,
        done: Boolean(data.done),
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : undefined,
      } satisfies UserTodo;
    });
    callback(rows);
  });
}

export async function createUserTodo(params: {
  ownerUid: string;
  title: string;
  subjectId?: string;
  targetPages?: number;
}) {
  if (!params.ownerUid || !params.title.trim()) return;
  await addDoc(collection(db, TODOS_COLLECTION), {
    ownerUid: params.ownerUid,
    title: params.title.trim(),
    subjectId: params.subjectId || "",
    targetPages: params.targetPages || 0,
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markTodoDone(todoId: string, done: boolean) {
  if (!todoId) return;
  await setDoc(
    doc(db, TODOS_COLLECTION, todoId),
    {
      done,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

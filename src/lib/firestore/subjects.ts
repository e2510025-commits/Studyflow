import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const SUBJECT_CATALOG = "subjectCatalog";

function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase();
}

function toSubjectDocId(name: string): string {
  return normalizeSubjectName(name).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/gi, "-");
}

export async function upsertSubjectCatalog(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const normalized = normalizeSubjectName(trimmed);
  const docId = toSubjectDocId(trimmed) || normalized;

  await setDoc(
    doc(db, SUBJECT_CATALOG, docId),
    {
      name: trimmed,
      normalizedName: normalized,
      useCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchSubjectCatalog(limitCount = 300): Promise<string[]> {
  const q = query(
    collection(db, SUBJECT_CATALOG),
    orderBy("useCount", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  const names = snapshot.docs
    .map((d) => d.data().name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);

  return Array.from(new Set(names));
}

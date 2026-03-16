import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PomodoroConfig } from "@/types";

const PRESETS_COLLECTION = "pomodoroPresets";

export interface PomodoroPreset {
  id: string;
  ownerUid: string;
  name: string;
  config: PomodoroConfig;
  createdAt: string;
}

export function subscribePomodoroPresets(
  ownerUid: string,
  callback: (rows: PomodoroPreset[]) => void
) {
  if (!ownerUid) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, PRESETS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerUid: String(data.ownerUid || ""),
        name: String(data.name || "プリセット"),
        config: {
          workDuration: Number(data.config?.workDuration || 1500),
          shortBreakDuration: Number(data.config?.shortBreakDuration || 300),
          longBreakDuration: Number(data.config?.longBreakDuration || 900),
          sessionsBeforeLongBreak: Number(data.config?.sessionsBeforeLongBreak || 4),
          autoStartBreaks: Boolean(data.config?.autoStartBreaks),
          autoStartWork: Boolean(data.config?.autoStartWork),
        },
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      } satisfies PomodoroPreset;
    });
    callback(rows);
  });
}

export async function savePomodoroPreset(ownerUid: string, name: string, config: PomodoroConfig) {
  if (!ownerUid || !name.trim()) return;
  await addDoc(collection(db, PRESETS_COLLECTION), {
    ownerUid,
    name: name.trim(),
    config,
    createdAt: serverTimestamp(),
  });
}

export async function deletePomodoroPreset(id: string) {
  if (!id) return;
  await deleteDoc(doc(db, PRESETS_COLLECTION, id));
}

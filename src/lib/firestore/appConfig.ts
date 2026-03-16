import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const APP_CONFIG_COLLECTION = "appConfig";
const APP_CONFIG_DOC = "general";
const DEFAULT_APP_VERSION = "1.0.0";

export function subscribeAppVersion(callback: (version: string) => void) {
  const ref = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC);
  return onSnapshot(
    ref,
    (snapshot) => {
      const version = snapshot.exists() ? String(snapshot.data().version || "") : "";
      callback(version.trim() || DEFAULT_APP_VERSION);
    },
    () => {
      callback(DEFAULT_APP_VERSION);
    }
  );
}

export async function fetchAppVersion(): Promise<string> {
  const ref = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return DEFAULT_APP_VERSION;
  const value = String(snapshot.data().version || "").trim();
  return value || DEFAULT_APP_VERSION;
}

export async function saveAppVersion(version: string): Promise<void> {
  const ref = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC);
  await setDoc(
    ref,
    {
      version: version.trim() || DEFAULT_APP_VERSION,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

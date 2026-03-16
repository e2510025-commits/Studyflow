import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy,
  getDocs,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Announcement, AppNotification } from "@/types";

const ANNOUNCEMENTS_COLLECTION = "announcements";
const NOTIFICATIONS_COLLECTION = "notifications";

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeAnnouncements(callback: (rows: Announcement[]) => void) {
  const q = query(collection(db, ANNOUNCEMENTS_COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const rows = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          body: data.body || "",
          createdBy: data.createdBy || "",
          createdAt: toIso(data.createdAt),
          scheduledAt: data.scheduledAt ? toIso(data.scheduledAt) : undefined,
        } satisfies Announcement;
      })
      .filter((row) => {
        if (!row.scheduledAt) return true;
        return new Date(row.scheduledAt).getTime() <= now;
      });
    callback(rows);
  });
}

export function subscribeUserNotifications(
  uid: string,
  callback: (rows: AppNotification[]) => void
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("toUid", "==", uid)
  );

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || "announcement",
          title: data.title || "",
          body: data.body || "",
          toUid: data.toUid || uid,
          link: data.link || "",
          read: Boolean(data.read),
          createdAt: toIso(data.createdAt),
        } satisfies AppNotification;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    callback(rows);
  });
}

export async function sendUserNotification(params: {
  toUid: string;
  type: AppNotification["type"];
  title: string;
  body: string;
  link?: string;
}) {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    toUid: params.toUid,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link || "",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationAsRead(notificationId: string) {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    read: true,
  });
}

export async function fetchRecentAnnouncements(limitCount = 20): Promise<Announcement[]> {
  const q = query(collection(db, ANNOUNCEMENTS_COLLECTION), orderBy("createdAt", "desc"), limit(limitCount));
  const snapshot = await getDocs(q);
  const now = Date.now();
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || "",
        body: data.body || "",
        createdBy: data.createdBy || "",
        createdAt: toIso(data.createdAt),
        scheduledAt: data.scheduledAt ? toIso(data.scheduledAt) : undefined,
      } satisfies Announcement;
    })
    .filter((row) => {
      if (!row.scheduledAt) return true;
      return new Date(row.scheduledAt).getTime() <= now;
    });
}

import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { resolveSessionUser } from "@/lib/server/sessionUser";

interface DueAnnouncement {
  id: string;
  title: string;
  body: string;
  dispatchedAt?: unknown;
}

export async function POST() {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueAnnouncementsSnap = await getDocs(
    query(
      collection(db, "announcements"),
      where("notifyAsMissionStart", "==", true),
      where("scheduledAt", "<=", Timestamp.fromDate(now))
    )
  );

  const dueAnnouncements = dueAnnouncementsSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: String(data.title || ""),
        body: String(data.body || ""),
        dispatchedAt: data.dispatchedAt,
      } satisfies DueAnnouncement;
    })
    .filter((row) => !row.dispatchedAt);

  if (dueAnnouncements.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  const usersSnap = await getDocs(collection(db, "userProfiles"));
  const userUids = usersSnap.docs.map((d) => d.id).filter(Boolean);

  let notificationCount = 0;

  for (const announcement of dueAnnouncements) {
    const title = String(announcement.title || "New mission announcement");
    const body = String(announcement.body || "A new mission has started.");

    await Promise.all(
      userUids.map(async (uid) => {
        await addDoc(collection(db, "notifications"), {
          toUid: uid,
          type: "announcement",
          title,
          body,
          link: "/missions",
          read: false,
          createdAt: serverTimestamp(),
        });
        notificationCount += 1;
      })
    );

    await setDoc(
      doc(db, "announcements", announcement.id),
      {
        dispatchedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return NextResponse.json({
    ok: true,
    dispatched: dueAnnouncements.length,
    notifications: notificationCount,
  });
}


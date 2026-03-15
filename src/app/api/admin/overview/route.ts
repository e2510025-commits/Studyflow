import { NextResponse } from "next/server";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    usersSnap,
    profilesSnap,
    logsSnap,
    chatsSnap,
    friendsSnap,
    groupsSnap,
    announcementsSnap,
    notificationsSnap,
    activeLogsSnap,
  ] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "userProfiles")),
    getDocs(collection(db, "studyLogs")),
    getDocs(collection(db, "chatMessages")),
    getDocs(collection(db, "friends")),
    getDocs(collection(db, "groupChats")),
    getDocs(collection(db, "announcements")),
    getDocs(collection(db, "notifications")),
    getDocs(
      query(collection(db, "studyLogs"), where("createdAt", ">=", Timestamp.fromDate(oneDayAgo)))
    ),
  ]);

  const activeUserSet = new Set<string>();
  activeLogsSnap.forEach((d) => {
    const uid = d.data().userUid;
    if (uid) activeUserSet.add(uid);
  });

  return NextResponse.json({
    users: usersSnap.size,
    profiles: profilesSnap.size,
    activeUsers24h: activeUserSet.size,
    studyLogs: logsSnap.size,
    chatMessages: chatsSnap.size,
    friends: friendsSnap.size,
    groups: groupsSnap.size,
    announcements: announcementsSnap.size,
    notifications: notificationsSnap.size,
  });
}

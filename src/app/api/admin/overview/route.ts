import { NextResponse } from "next/server";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

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
    recentWeekLogsSnap,
    previousWeekLogsSnap,
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
    getDocs(
      query(collection(db, "studyLogs"), where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)))
    ),
    getDocs(
      query(
        collection(db, "studyLogs"),
        where("createdAt", ">=", Timestamp.fromDate(fourteenDaysAgo)),
        where("createdAt", "<", Timestamp.fromDate(sevenDaysAgo))
      )
    ),
  ]);

  const activeUserSet = new Set<string>();
  activeLogsSnap.forEach((d) => {
    const uid = d.data().userUid;
    if (uid) activeUserSet.add(uid);
  });

  const recentWeekMap = new Map<string, number>();
  const previousWeekMap = new Map<string, number>();

  recentWeekLogsSnap.forEach((d) => {
    const data = d.data();
    const uid = String(data.userUid || "");
    if (!uid) return;
    recentWeekMap.set(uid, (recentWeekMap.get(uid) || 0) + Number(data.duration || 0));
  });

  previousWeekLogsSnap.forEach((d) => {
    const data = d.data();
    const uid = String(data.userUid || "");
    if (!uid) return;
    previousWeekMap.set(uid, (previousWeekMap.get(uid) || 0) + Number(data.duration || 0));
  });

  const dropAlerts = Array.from(previousWeekMap.entries())
    .map(([uid, prevDuration]) => {
      const recentDuration = recentWeekMap.get(uid) || 0;
      const dropRate = prevDuration > 0 ? (prevDuration - recentDuration) / prevDuration : 0;
      return { uid, prevDuration, recentDuration, dropRate };
    })
    .filter((row) => row.prevDuration >= 3600 && row.dropRate >= 0.6)
    .sort((a, b) => b.dropRate - a.dropRate)
    .slice(0, 20);

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
    droppingUsers: dropAlerts.length,
    dropAlerts,
  });
}

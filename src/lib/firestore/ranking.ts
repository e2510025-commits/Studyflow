import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

/* ─── Types ──────────────────────────────────────── */

export interface AggregatedUser {
  userId: string;
  totalDuration: number;
  totalPoints: number;
  sessions: number;
}

export interface RankingUser extends AggregatedUser {
  name: string;
  avatar: string;
  rank: number;
}

export interface RankHistoryPoint {
  date: string;
  rank: number;
  totalHours: number;
}

function compareByStudyDuration(a: AggregatedUser, b: AggregatedUser): number {
  if (b.totalDuration !== a.totalDuration) return b.totalDuration - a.totalDuration;
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.sessions !== a.sessions) return b.sessions - a.sessions;
  return a.userId.localeCompare(b.userId);
}

/* ─── User Profiles ──────────────────────────────── */

const PROFILES = "userProfiles";

/** Save / update user profile (called on log save & ranking page mount) */
export async function saveUserProfile(
  uid: string,
  name: string,
  avatar: string
) {
  const safeName = sanitizeDisplayName(name);
  const safeAvatar = sanitizeAvatar(avatar);
  await setDoc(
    doc(db, PROFILES, uid),
    { uid, name: safeName, avatar: safeAvatar, updatedAt: new Date() },
    { merge: true }
  );
}

/** Batch-fetch profiles by UID list */
export async function getProfilesBatch(
  uids: string[]
): Promise<Map<string, { name: string; avatar: string; isOfficial?: boolean; equippedBadges?: string[] }>> {
  const map = new Map<string, { name: string; avatar: string; isOfficial?: boolean; equippedBadges?: string[] }>();
  if (uids.length === 0) return map;

  // Parallel individual reads (Firestore has no native "get multiple by id" in client SDK)
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, PROFILES, uid));
        if (snap.exists()) {
          const d = snap.data();
          map.set(uid, {
            name: sanitizeDisplayName(d.name),
            avatar: sanitizeAvatar(d.avatar),
            isOfficial: Boolean(d.isOfficial),
            equippedBadges: Array.isArray(d.equippedBadges)
              ? d.equippedBadges.filter((x: unknown) => typeof x === "string").slice(0, 3)
              : [],
          });
        }
      } catch {
        /* skip */
      }
    })
  );

  return map;
}

/* ─── Period helpers ──────────────────────────────── */

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday-based week
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diff
      );
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(0);
  }
}

/* ─── Ranking aggregation ────────────────────────── */

/**
 * Fetch ALL studyLogs for a period, aggregate by userUid,
 * and return sorted array (descending by totalDuration).
 */
export async function fetchRankingData(
  period: "today" | "week" | "month" | "all"
): Promise<AggregatedUser[]> {
  const periodStart = getPeriodStart(period);

  const logsRef = collection(db, "studyLogs");
  const rewardsRef = collection(db, "missionRewards");
  const q =
    period === "all"
      ? query(logsRef)
      : query(
          logsRef,
          where("createdAt", ">=", Timestamp.fromDate(periodStart))
        );
  const rewardsQuery =
    period === "all"
      ? query(rewardsRef)
      : query(
          rewardsRef,
          where("createdAt", ">=", Timestamp.fromDate(periodStart))
        );

  const [snapshot, rewardSnapshot] = await Promise.all([getDocs(q), getDocs(rewardsQuery)]);

  // Aggregate
  const userMap = new Map<
    string,
    { totalDuration: number; totalPoints: number; sessions: number }
  >();

  for (const d of snapshot.docs) {
    const data = d.data();
    const uid: string | undefined = data.userUid;
    if (!uid) continue;

    const existing = userMap.get(uid) || {
      totalDuration: 0,
      totalPoints: 0,
      sessions: 0,
    };
    existing.totalDuration += data.duration || 0;
    existing.totalPoints +=
      data.points ?? Math.floor((data.duration || 0) / 60);
    existing.sessions += 1;
    userMap.set(uid, existing);
  }

  for (const d of rewardSnapshot.docs) {
    const data = d.data();
    const uid: string | undefined = data.uid;
    if (!uid) continue;

    const existing = userMap.get(uid) || {
      totalDuration: 0,
      totalPoints: 0,
      sessions: 0,
    };
    existing.totalPoints += Number(data.points || 0);
    userMap.set(uid, existing);
  }

  return Array.from(userMap.entries())
    .map(([uid, stats]) => ({ userId: uid, ...stats }))
    .sort(compareByStudyDuration);
}

async function fetchRankingDataByDateRange(params: {
  startAt?: Date;
  endBefore?: Date;
}): Promise<AggregatedUser[]> {
  const logsRef = collection(db, "studyLogs");
  const rewardsRef = collection(db, "missionRewards");

  const logConstraints: QueryConstraint[] = [];
  const rewardConstraints: QueryConstraint[] = [];
  if (params.startAt) {
    logConstraints.push(where("createdAt", ">=", Timestamp.fromDate(params.startAt)));
    rewardConstraints.push(where("createdAt", ">=", Timestamp.fromDate(params.startAt)));
  }
  if (params.endBefore) {
    logConstraints.push(where("createdAt", "<", Timestamp.fromDate(params.endBefore)));
    rewardConstraints.push(where("createdAt", "<", Timestamp.fromDate(params.endBefore)));
  }

  const [snapshot, rewardSnapshot] = await Promise.all([
    getDocs(query(logsRef, ...logConstraints)),
    getDocs(query(rewardsRef, ...rewardConstraints)),
  ]);

  const userMap = new Map<string, { totalDuration: number; totalPoints: number; sessions: number }>();

  for (const d of snapshot.docs) {
    const data = d.data();
    const uid: string | undefined = data.userUid;
    if (!uid) continue;
    const existing = userMap.get(uid) || { totalDuration: 0, totalPoints: 0, sessions: 0 };
    existing.totalDuration += data.duration || 0;
    existing.totalPoints += data.points ?? Math.floor((data.duration || 0) / 60);
    existing.sessions += 1;
    userMap.set(uid, existing);
  }

  for (const d of rewardSnapshot.docs) {
    const data = d.data();
    const uid: string | undefined = data.uid;
    if (!uid) continue;
    const existing = userMap.get(uid) || { totalDuration: 0, totalPoints: 0, sessions: 0 };
    existing.totalPoints += Number(data.points || 0);
    userMap.set(uid, existing);
  }

  return Array.from(userMap.entries())
    .map(([userId, stats]) => ({ userId, ...stats }))
    .sort(compareByStudyDuration);
}

export async function fetchDailyRankMap(dayOffset: number): Promise<Map<string, number>> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset + 1);

  const rows = await fetchRankingDataByDateRange({
    startAt: start,
    endBefore: end,
  });

  const rankMap = new Map<string, number>();
  rows.forEach((row, index) => {
    rankMap.set(row.userId, index + 1);
  });
  return rankMap;
}

export async function fetchUserRankHistory(
  uid: string,
  days = 14
): Promise<RankHistoryPoint[]> {
  const safeDays = Math.min(Math.max(3, Math.floor(days)), 60);
  const points: RankHistoryPoint[] = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const start = new Date(day);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);

    const rows = await fetchRankingDataByDateRange({
      startAt: start,
      endBefore: end,
    });

    const rank = rows.findIndex((row) => row.userId === uid);
    const mine = rows.find((row) => row.userId === uid);

    if (rank >= 0 && mine) {
      points.push({
        date: start.toISOString(),
        rank: rank + 1,
        totalHours: Math.round((mine.totalDuration / 3600) * 10) / 10,
      });
    }
  }

  return points;
}

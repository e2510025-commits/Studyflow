import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  Timestamp,
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
): Promise<Map<string, { name: string; avatar: string }>> {
  const map = new Map<string, { name: string; avatar: string }>();
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
 * and return sorted array (descending by totalPoints).
 */
export async function fetchRankingData(
  period: "today" | "week" | "month" | "all"
): Promise<AggregatedUser[]> {
  const periodStart = getPeriodStart(period);

  const logsRef = collection(db, "studyLogs");
  const q =
    period === "all"
      ? query(logsRef)
      : query(
          logsRef,
          where("createdAt", ">=", Timestamp.fromDate(periodStart))
        );

  const snapshot = await getDocs(q);

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

  return Array.from(userMap.entries())
    .map(([uid, stats]) => ({ userId: uid, ...stats }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

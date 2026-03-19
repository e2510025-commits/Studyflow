import { NextResponse } from "next/server";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "edge";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { name: string; avatar: string; expiresAt: number }>();

async function getProfile(uid: string) {
  const cached = profileCache.get(uid);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { name: cached.name, avatar: cached.avatar };
  }

  let name = "匿名";
  let avatar = "👤";
  try {
    const snap = await getDoc(doc(db, "userProfiles", uid));
    if (snap.exists()) {
      const d = snap.data();
      name = d.name || "匿名";
      avatar = d.avatar || "👤";
    }
  } catch {
    // Keep default fallback values when profile lookup fails.
  }

  profileCache.set(uid, { name, avatar, expiresAt: now + PROFILE_CACHE_TTL_MS });
  return { name, avatar };
}

/**
 * GET /api/ranking
 *
 * Query params:
 *   userId  – current user UID (to compute their rank)
 *   period  – "today" | "week" | "month" | "all" (default "all")
 *   limit   – page size (default 100, max 500)
 *   offset  – pagination offset (default 0)
 *
 * Response:
 * {
 *   ranking: [{ userId, name, avatar, totalDuration, totalPoints, sessions, rank }],
 *   myRank, myTotal, totalUsers,
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const period = searchParams.get("period") || "all";
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
    const offset = Number(searchParams.get("offset") || 0);

    /* ── Period start ──────────────────────────────── */
    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case "today":
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week": {
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        break;
      }
      case "month":
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        periodStart = new Date(0);
    }

    /* ── Aggregate studyLogs from Firestore ────────── */
    const logsRef = collection(db, "studyLogs");
    const rewardsRef = collection(db, "missionRewards");
    const q =
      period === "all"
        ? query(logsRef)
        : query(logsRef, where("createdAt", ">=", Timestamp.fromDate(periodStart)));
    const rewardsQuery =
      period === "all"
        ? query(rewardsRef)
        : query(rewardsRef, where("createdAt", ">=", Timestamp.fromDate(periodStart)));

    const [snapshot, rewardSnapshot] = await Promise.all([getDocs(q), getDocs(rewardsQuery)]);

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

    const sorted = Array.from(userMap.entries())
      .map(([uid, stats]) => ({ userId: uid, ...stats }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const totalUsers = sorted.length;
    const page = sorted.slice(offset, offset + limit);

    /* ── Enrich with user profiles ─────────────────── */
    const ranking = await Promise.all(
      page.map(async (entry, i) => {
        const { name, avatar } = await getProfile(entry.userId);
        return {
          userId: entry.userId,
          name,
          avatar,
          totalDuration: entry.totalDuration,
          totalPoints: entry.totalPoints,
          sessions: entry.sessions,
          rank: offset + i + 1,
        };
      })
    );

    /* ── My rank ───────────────────────────────────── */
    let myRank = 0;
    let myTotal = 0;
    if (userId) {
      const myIndex = sorted.findIndex((u) => u.userId === userId);
      if (myIndex >= 0) {
        myRank = myIndex + 1;
        myTotal = sorted[myIndex].totalDuration;
      } else {
        myRank = totalUsers + 1;
      }
    }

    return NextResponse.json(
      { ranking, myRank, myTotal, totalUsers },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Ranking API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranking" },
      { status: 500 }
    );
  }
}

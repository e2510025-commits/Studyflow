import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/ranking
 *
 * Returns the ranking of users by total study time.
 * Query params:
 *   - userId: current user's id (to compute their rank)
 *   - period: "today" | "week" | "month" | "all" (default "all")
 *   - limit:  number of top users to return (default 20)
 *
 * Response:
 * {
 *   ranking: [{ userId, name, image, totalDuration, rank }],
 *   myRank: number,
 *   myTotal: number,
 *   totalUsers: number,
 * }
 *
 * Ranking algorithm:
 *   SELECT userId, SUM(duration) AS totalDuration
 *   FROM StudyLog
 *   WHERE createdAt >= <periodStart>
 *   GROUP BY userId
 *   ORDER BY totalDuration DESC
 *
 *   User rank = COUNT of users with totalDuration > myTotal + 1
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const period = searchParams.get("period") || "all";
    const limit = Math.min(Number(searchParams.get("limit") || 20), 100);

    // Determine period start date
    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case "today":
        periodStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        break;
      case "week": {
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday-based week
        periodStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - diff
        );
        break;
      }
      case "month":
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        periodStart = new Date(0);
    }

    // Aggregate study time per user within the period
    const aggregated = await prisma.studyLog.groupBy({
      by: ["userId"],
      _sum: { duration: true },
      where: { createdAt: { gte: periodStart } },
      orderBy: { _sum: { duration: "desc" } },
    });

    // Enrich top N with user info
    const topUserIds = aggregated.slice(0, limit).map((a) => a.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, image: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const ranking = aggregated.slice(0, limit).map((a, i) => {
      const user = userMap.get(a.userId);
      return {
        userId: a.userId,
        name: user?.name || "匿名",
        image: user?.image || null,
        totalDuration: a._sum.duration || 0,
        rank: i + 1,
      };
    });

    // Compute authenticated user's rank
    let myRank = 0;
    let myTotal = 0;
    if (userId) {
      const myEntry = aggregated.find((a) => a.userId === userId);
      myTotal = myEntry?._sum.duration || 0;

      // Rank = number of users with higher total + 1
      myRank =
        aggregated.filter((a) => (a._sum.duration || 0) > myTotal).length + 1;

      // If user has no logs at all, rank is last+1
      if (!myEntry) myRank = aggregated.length + 1;
    }

    return NextResponse.json({
      ranking,
      myRank,
      myTotal,
      totalUsers: aggregated.length,
    });
  } catch (error) {
    console.error("Ranking API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranking" },
      { status: 500 }
    );
  }
}

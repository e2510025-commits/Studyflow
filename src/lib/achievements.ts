import type { StudyLog } from "@/types";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: "total" | "streak" | "subject" | "special";
  rarity: "common" | "rare" | "epic" | "legendary";
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "total_100h",
    title: "Century Scholar",
    description: "合計100時間の学習を達成",
    category: "total",
    rarity: "epic",
  },
  {
    id: "streak_7d",
    title: "7-Day Streak",
    description: "7日連続で学習",
    category: "streak",
    rarity: "rare",
  },
  {
    id: "sessions_100",
    title: "Session Master",
    description: "100セッション達成",
    category: "total",
    rarity: "epic",
  },
  {
    id: "focus_30",
    title: "Deep Focus",
    description: "集中ボーナス付き学習を30回達成",
    category: "special",
    rarity: "rare",
  },
  {
    id: "math_20h",
    title: "Math Vanguard",
    description: "数学を合計20時間学習",
    category: "subject",
    rarity: "rare",
  },
  {
    id: "white_day_secret",
    title: "White Protocol",
    description: "特定の記念日に学習を実施",
    category: "special",
    rarity: "legendary",
    secret: true,
  },
];

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longestStreak(logs: StudyLog[]): number {
  const days = Array.from(new Set(logs.map((log) => toDateKey(log.createdAt)))).sort();
  if (days.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(days[i - 1]);
    const now = new Date(days[i]);
    const diffDays = Math.round((now.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function evaluateAchievements(logs: StudyLog[]): string[] {
  const badges: string[] = [];
  const totalSeconds = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const sessions = logs.length;
  const focusSessions = logs.filter((log) => Boolean(log.focusBonus)).length;
  const streak = longestStreak(logs);
  const mathSeconds = logs
    .filter((log) => /math|数学/i.test(log.memo || ""))
    .reduce((sum, log) => sum + (log.duration || 0), 0);
  const hasSecretDate = logs.some((log) => {
    const d = new Date(log.createdAt);
    return d.getMonth() === 2 && d.getDate() === 14; // 3/14
  });

  if (totalSeconds >= 100 * 3600) badges.push("total_100h");
  if (streak >= 7) badges.push("streak_7d");
  if (sessions >= 100) badges.push("sessions_100");
  if (focusSessions >= 30) badges.push("focus_30");
  if (mathSeconds >= 20 * 3600) badges.push("math_20h");
  if (hasSecretDate) badges.push("white_day_secret");

  return badges;
}

export function getAchievementMeta(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((row) => row.id === id);
}

import type { StudyLog } from "@/types";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "total_100h",
    title: "Century Scholar",
    description: "合計100時間の学習を達成",
  },
  {
    id: "streak_7d",
    title: "7-Day Streak",
    description: "7日連続で学習",
  },
  {
    id: "sessions_100",
    title: "Session Master",
    description: "100セッション達成",
  },
  {
    id: "focus_30",
    title: "Deep Focus",
    description: "集中ボーナス付き学習を30回達成",
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

  if (totalSeconds >= 100 * 3600) badges.push("total_100h");
  if (streak >= 7) badges.push("streak_7d");
  if (sessions >= 100) badges.push("sessions_100");
  if (focusSessions >= 30) badges.push("focus_30");

  return badges;
}

export function getAchievementMeta(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((row) => row.id === id);
}

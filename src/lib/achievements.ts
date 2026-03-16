import type { StudyLog } from "@/types";
import type { AchievementCategory, AchievementTemplate } from "@/types";

export interface AchievementDefinition extends AchievementTemplate {}

export const DEFAULT_ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  { id: "total", label: "総学習時間", order: 0 },
  { id: "streak", label: "継続記録", order: 1 },
  { id: "subject", label: "特定科目", order: 2 },
  { id: "special", label: "特殊任務", order: 3 },
];

export const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "total_100h",
    title: "Century Scholar",
    description: "合計100時間の学習を達成",
    category: "total",
    rarity: "epic",
    triggerType: "total_study_hours",
    triggerValue: 100,
    iconBase: "hex",
    iconColor: "#22d3ee",
    iconSymbol: "trophy",
    active: true,
  },
  {
    id: "streak_7d",
    title: "7-Day Streak",
    description: "7日連続で学習",
    category: "streak",
    rarity: "rare",
    triggerType: "streak_days",
    triggerValue: 7,
    iconBase: "hex",
    iconColor: "#22c55e",
    iconSymbol: "flame",
    active: true,
  },
  {
    id: "sessions_100",
    title: "Session Master",
    description: "100セッション達成",
    category: "total",
    rarity: "epic",
    triggerType: "study_sessions",
    triggerValue: 100,
    iconBase: "hex",
    iconColor: "#a78bfa",
    iconSymbol: "book",
    active: true,
  },
  {
    id: "focus_30",
    title: "Deep Focus",
    description: "集中ボーナス付き学習を30回達成",
    category: "special",
    rarity: "rare",
    triggerType: "focus_sessions",
    triggerValue: 30,
    iconBase: "hex",
    iconColor: "#f59e0b",
    iconSymbol: "spark",
    active: true,
  },
  {
    id: "math_20h",
    title: "Math Vanguard",
    description: "数学を合計20時間学習",
    category: "subject",
    rarity: "rare",
    triggerType: "subject_study_hours",
    triggerValue: 20,
    subjectLabel: "数学",
    iconBase: "hex",
    iconColor: "#38bdf8",
    iconSymbol: "book",
    active: true,
  },
  {
    id: "white_day_secret",
    title: "White Protocol",
    description: "特定の記念日に学習を実施",
    category: "special",
    rarity: "legendary",
    secret: true,
    triggerType: "special_date",
    triggerValue: 1,
    iconBase: "hex",
    iconColor: "#67e8f9",
    iconSymbol: "crown",
    active: true,
  },
];

export const ACHIEVEMENTS: AchievementDefinition[] = DEFAULT_ACHIEVEMENTS;

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

function resolveLogStats(logs: StudyLog[]) {
  const totalSeconds = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const sessions = logs.length;
  const focusSessions = logs.filter((log) => Boolean(log.focusBonus)).length;
  const streak = longestStreak(logs);
  const hasSecretDate = logs.some((log) => {
    const d = new Date(log.createdAt);
    return d.getMonth() === 2 && d.getDate() === 14; // 3/14
  });

  return {
    totalHours: totalSeconds / 3600,
    sessions,
    focusSessions,
    streak,
    hasSecretDate,
  };
}

function subjectHours(logs: StudyLog[], subjectLabel: string): number {
  const key = subjectLabel.trim();
  if (!key) return 0;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "i");
  return (
    logs
      .filter((log) => re.test(log.memo || ""))
      .reduce((sum, log) => sum + (log.duration || 0), 0) / 3600
  );
}

export function evaluateAchievements(
  logs: StudyLog[],
  definitions: AchievementDefinition[] = ACHIEVEMENTS
): string[] {
  const badges: string[] = [];
  const stats = resolveLogStats(logs);

  definitions.forEach((def) => {
    if (def.active === false) return;
    const triggerValue = Math.max(1, Number(def.triggerValue || 1));
    const trigger = def.triggerType || "total_study_hours";

    if (trigger === "total_study_hours" && stats.totalHours >= triggerValue) {
      badges.push(def.id);
      return;
    }
    if (trigger === "streak_days" && stats.streak >= triggerValue) {
      badges.push(def.id);
      return;
    }
    if (
      trigger === "subject_study_hours" &&
      subjectHours(logs, def.subjectLabel || "数学") >= triggerValue
    ) {
      badges.push(def.id);
      return;
    }
    if (trigger === "study_sessions" && stats.sessions >= triggerValue) {
      badges.push(def.id);
      return;
    }
    if (trigger === "focus_sessions" && stats.focusSessions >= triggerValue) {
      badges.push(def.id);
      return;
    }
    if (trigger === "special_date" && stats.hasSecretDate) {
      badges.push(def.id);
    }
  });

  return badges;
}

export function getAchievementMeta(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((row) => row.id === id);
}

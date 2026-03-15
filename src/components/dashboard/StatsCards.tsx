"use client";

import React, { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useLiveStudyLogs } from "@/components/dashboard/useLiveStudyLogs";
import { motion } from "framer-motion";
import { Clock, TrendingUp, Flame, Target } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  isWithinInterval,
  startOfDay,
  differenceInCalendarDays,
  eachDayOfInterval,
  subDays,
} from "date-fns";
import { ja } from "date-fns/locale";
import { formatHoursMinutes, getTodayLogs, getTotalDuration } from "@/lib/utils";

export default function StatsCards() {
  const { userProfile } = useStore();
  const studyLogs = useLiveStudyLogs();

  const stats = useMemo(() => {
    const now = new Date();
    const todayLogs = getTodayLogs(studyLogs);
    const todayTotal = getTotalDuration(todayLogs);

    // This week total
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const thisWeekLogs = studyLogs.filter((l) =>
      isWithinInterval(new Date(l.createdAt), { start: weekStart, end: weekEnd })
    );
    const thisWeekTotal = getTotalDuration(thisWeekLogs);

    // Last week total
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekLogs = studyLogs.filter((l) =>
      isWithinInterval(new Date(l.createdAt), {
        start: lastWeekStart,
        end: lastWeekEnd,
      })
    );
    const lastWeekTotal = getTotalDuration(lastWeekLogs);

    // Week over week percentage
    const weekChange =
      lastWeekTotal > 0
        ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
        : thisWeekTotal > 0
        ? 100
        : 0;

    // Streak calculation
    let streak = 0;
    const today = startOfDay(now);
    for (let i = 0; i < 365; i++) {
      const day = subDays(today, i);
      const dayStr = format(day, "yyyy-MM-dd");
      const hasLog = studyLogs.some(
        (l) => format(new Date(l.createdAt), "yyyy-MM-dd") === dayStr
      );
      if (hasLog) {
        streak++;
      } else if (i > 0) {
        break;
      } else {
        // Today has no log yet, check yesterday
        continue;
      }
    }

    // Daily goal progress
    const goalProgress =
      userProfile.dailyGoal > 0
        ? Math.min(100, Math.round((todayTotal / userProfile.dailyGoal) * 100))
        : 0;

    return {
      todayTotal,
      thisWeekTotal,
      weekChange,
      streak,
      goalProgress,
    };
  }, [studyLogs, userProfile.dailyGoal]);

  const cards = [
    {
      label: "今日の学習",
      value: formatHoursMinutes(stats.todayTotal),
      sub: `目標の${stats.goalProgress}%`,
      icon: Clock,
      color: "#6366f1",
      progress: stats.goalProgress,
    },
    {
      label: "今週の合計",
      value: formatHoursMinutes(stats.thisWeekTotal),
      sub:
        stats.weekChange >= 0
          ? `先週比 +${stats.weekChange}%`
          : `先週比 ${stats.weekChange}%`,
      icon: TrendingUp,
      color: stats.weekChange >= 0 ? "#10b981" : "#ef4444",
      progress: null,
    },
    {
      label: "連続学習",
      value: `${stats.streak}日`,
      sub: stats.streak > 0 ? "継続中！" : "今日から始めよう",
      icon: Flame,
      color: "#f59e0b",
      progress: null,
    },
    {
      label: "獲得ポイント",
      value: `${useStore.getState().userProfile.totalPoints}`,
      sub: "1分 = 1pt",
      icon: Target,
      color: "#ec4899",
      progress: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                {card.label}
              </span>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${card.color}20`, color: card.color }}
              >
                <Icon size={20} />
              </div>
            </div>
            <div
              className="text-3xl font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {card.value}
            </div>
            <span className="text-sm" style={{ color: card.color }}>
              {card.sub}
            </span>
            {card.progress !== null && (
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "var(--muted-bg)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: card.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${card.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

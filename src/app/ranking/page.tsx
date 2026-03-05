"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
} from "date-fns";

type RankingPeriod = "today" | "week" | "month" | "all";

/* ─── Mock demo users for ranking display ─────────── */
const DEMO_USERS = [
  { id: "demo-1", name: "はるか", avatar: "🧑‍🎓", streak: 45 },
  { id: "demo-2", name: "けんた", avatar: "👨‍💻", streak: 32 },
  { id: "demo-3", name: "さくら", avatar: "👩‍🔬", streak: 28 },
  { id: "demo-4", name: "りょう", avatar: "📚", streak: 21 },
  { id: "demo-5", name: "みなみ", avatar: "✍️", streak: 18 },
  { id: "demo-6", name: "たいき", avatar: "🎯", streak: 15 },
  { id: "demo-7", name: "あおい", avatar: "💡", streak: 12 },
  { id: "demo-8", name: "こうき", avatar: "🔬", streak: 9 },
  { id: "demo-9", name: "ゆうな", avatar: "📖", streak: 7 },
  { id: "demo-10", name: "しょうた", avatar: "⚡", streak: 5 },
];

/* Generate semi-random study data for demo users */
function generateDemoData(period: RankingPeriod) {
  const baseMultiplier: Record<RankingPeriod, number> = {
    today: 1,
    week: 7,
    month: 30,
    all: 120,
  };

  return DEMO_USERS.map((user, index) => {
    // Top users study more, with some randomization baked in via seed
    const baseDuration =
      (10 - index) * 900 * baseMultiplier[period] +
      ((index * 137 + 42) % 600) * baseMultiplier[period];
    const duration = Math.max(baseDuration, 300);
    // Points = minutes with random bonus factor (some users get focus bonus)
    const basePoints = Math.floor(duration / 60);
    const bonusFactor = (index % 3 === 0) ? 1.2 : 1.0; // every 3rd user got focus bonus
    const points = Math.floor(basePoints * bonusFactor);

    return {
      ...user,
      duration,
      points,
      sessions: Math.floor(baseDuration / 1500) + 1,
    };
  }).sort((a, b) => b.points - a.points);
}

/* ─── Medal colors ───────────────────────────────────── */
const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];


export default function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>("today");
  const { studyLogs, userProfile } = useStore();

  /* ── Calculate own stats ─────────────────────────── */
  const myStats = useMemo(() => {
    const now = new Date();
    let filterDate: Date;
    switch (period) {
      case "today":
        filterDate = startOfDay(now);
        break;
      case "week":
        filterDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        filterDate = startOfMonth(now);
        break;
      case "all":
        filterDate = new Date(0);
        break;
    }

    const filteredLogs = studyLogs.filter((log) =>
      isAfter(new Date(log.createdAt), filterDate)
    );
    const totalDuration = filteredLogs.reduce(
      (sum, log) => sum + log.duration,
      0
    );
    const totalPoints = filteredLogs.reduce(
      (sum, log) => sum + (log.points ?? Math.floor(log.duration / 60)),
      0
    );
    const sessions = filteredLogs.length;

    return { duration: totalDuration, points: totalPoints, sessions };
  }, [period, studyLogs]);

  /* ── Combined ranking ─────────────────────────────── */
  const ranking = useMemo(() => {
    const demoData = generateDemoData(period);

    // Insert "me" into the list
    const me = {
      id: "me",
      name: userProfile.name || "あなた",
      avatar: "🎓",
      streak: 0,
      duration: myStats.duration,
      points: myStats.points,
      sessions: myStats.sessions,
    };

    const combined = [...demoData, me].sort(
      (a, b) => b.points - a.points
    );
    return combined;
  }, [period, myStats, userProfile.name]);

  const myRank = ranking.findIndex((u) => u.id === "me") + 1;

  /* ── Period tabs ───────────────────────────────────── */
  const periods: { key: RankingPeriod; label: string }[] = [
    { key: "today", label: "今日" },
    { key: "week", label: "今週" },
    { key: "month", label: "今月" },
    { key: "all", label: "全期間" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy size={32} style={{ color: "#FFD700" }} />
          <h1
            className="text-3xl sm:text-4xl font-black"
            style={{ color: "var(--foreground)" }}
          >
            ランキング
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          ポイントで競い合おう（集中ボーナス ×1.2 あり）
        </p>
      </motion.div>

      {/* Period Tabs */}
      <motion.div
        className="flex items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background:
                period === p.key ? "var(--accent-light)" : "var(--muted-bg)",
              color: period === p.key ? "var(--accent)" : "var(--muted)",
              border:
                period === p.key
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            {p.label}
            {period === p.key && (
              <motion.div
                layoutId="ranking-tab"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "var(--accent-light)",
                  border: "2px solid var(--accent)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{p.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Full ranking list */}
      <motion.div
        className="glass-card overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: "var(--card-border)" }}
        >
          <Users size={18} style={{ color: "var(--accent)" }} />
          <h2
            className="text-base font-bold"
            style={{ color: "var(--foreground)" }}
          >
            全体ランキング
          </h2>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
          {ranking.map((user, index) => {
            const rank = index + 1;
            const isMe = user.id === "me";
            const isTop3 = rank <= 3;

            return (
              <motion.div
                key={user.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors"
                style={{
                  background: isMe
                    ? "var(--accent-light)"
                    : "transparent",
                  borderColor: "var(--card-border)",
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * Math.min(index, 10) }}
              >
                {/* Rank number */}
                <div className="w-10 text-center">
                  {isTop3 ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center mx-auto text-white font-black text-sm"
                      style={{ background: RANK_COLORS[rank - 1] }}
                    >
                      {rank}
                    </div>
                  ) : (
                    <span
                      className="text-lg font-bold"
                      style={{ color: "var(--muted)" }}
                    >
                      {rank}
                    </span>
                  )}
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background: isMe ? "var(--accent)" : "var(--muted-bg)",
                    }}
                  >
                    {isMe ? "🎓" : user.avatar}
                  </div>
                  <div className="min-w-0">
                    <span
                      className="text-sm font-bold truncate block"
                      style={{
                        color: isMe ? "var(--accent)" : "var(--foreground)",
                      }}
                    >
                      {isMe ? `${user.name} (あなた)` : user.name}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      {user.sessions} セッション
                    </span>
                  </div>
                </div>

                {/* Points + Duration */}
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-base font-black font-mono"
                    style={{
                      color: isMe ? "var(--accent)" : "var(--foreground)",
                    }}
                  >
                    {user.points.toLocaleString()} pt
                  </span>
                  <br />
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--muted)" }}
                  >
                    ({formatHoursMinutes(user.duration)})
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* My rank fixed card */}
      <motion.div
        className="glass-card p-5 sticky bottom-4"
        style={{
          background: "var(--accent-light)",
          border: "2px solid var(--accent)",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            🎓
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-lg font-black"
                style={{ color: "var(--accent)" }}
              >
                #{myRank}
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {userProfile.name || "あなた"}
              </span>
            </div>
            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: "var(--muted)" }}
            >
              <span className="flex items-center gap-1">
                <Flame size={12} />
                {myStats.points.toLocaleString()} pt
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatHoursMinutes(myStats.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Target size={12} />
                {myStats.sessions} セッション
              </span>
            </div>
          </div>
          <div className="text-right">
            {myRank <= 3 && (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black"
                style={{ background: RANK_COLORS[myRank - 1] }}
              >
                {myRank}
              </div>
            )}
            {myRank > 3 && (
              <div className="flex flex-col items-end">
                <TrendingUp size={18} style={{ color: "var(--accent)" }} />
                <span
                  className="text-[10px] font-medium mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  トップを目指そう!
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

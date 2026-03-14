"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Users,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import {
  fetchRankingData,
  saveUserProfile,
  getProfilesBatch,
  type AggregatedUser,
} from "@/lib/firestore/ranking";

type RankingPeriod = "today" | "week" | "month" | "all";

/* ─── Medal colours ────────────────────────────────── */
const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PAGE_SIZE = 100;

function Avatar({
  avatar,
  size = 40,
  background,
}: {
  avatar: string;
  size?: number;
  background: string;
}) {
  const isImage =
    typeof avatar === "string" &&
    (avatar.startsWith("http") || avatar.startsWith("data:"));

  if (isImage) {
    return (
      <img
        src={avatar}
        alt="avatar"
        className="rounded-full object-cover"
        style={{ width: size, height: size, background }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-lg flex-shrink-0"
      style={{ width: size, height: size, background }}
    >
      {avatar || "👤"}
    </div>
  );
}

export default function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>("today");
  const { userProfile } = useStore();

  /* ── State ─────────────────────────────────────── */
  const [rawData, setRawData] = useState<AggregatedUser[]>([]);
  const [profiles, setProfiles] = useState<
    Map<string, { name: string; avatar: string }>
  >(new Map());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /* ── Save own profile once ─────────────────────── */
  const savedRef = useRef(false);
  useEffect(() => {
    if (!savedRef.current && userProfile.uid && userProfile.name) {
      savedRef.current = true;
      saveUserProfile(
        userProfile.uid,
        userProfile.name,
        userProfile.avatar
      ).catch(() => {});
    }
  }, [userProfile.uid, userProfile.name, userProfile.avatar]);

  /* ── Fetch ranking when period changes ─────────── */
  const loadRanking = useCallback(async () => {
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    try {
      const data = await fetchRankingData(period);
      setRawData(data);

      // Fetch profiles for first page + own uid
      const uids = data.slice(0, PAGE_SIZE).map((u) => u.userId);
      if (userProfile.uid && !uids.includes(userProfile.uid)) {
        uids.push(userProfile.uid);
      }
      const profs = await getProfilesBatch(uids);
      setProfiles(profs);
    } catch (err) {
      console.error("ランキング取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [period, userProfile.uid]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  /* ── Load more ─────────────────────────────────── */
  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextSlice = rawData.slice(visibleCount, visibleCount + PAGE_SIZE);
      const newUids = nextSlice
        .map((u) => u.userId)
        .filter((uid) => !profiles.has(uid));

      if (newUids.length > 0) {
        const newProfs = await getProfilesBatch(newUids);
        setProfiles((prev) => {
          const merged = new Map(prev);
          newProfs.forEach((v, k) => merged.set(k, v));
          return merged;
        });
      }
      setVisibleCount((prev) => prev + PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [visibleCount, rawData, profiles]);

  /* ── Derived data ──────────────────────────────── */
  const visibleRanking = rawData.slice(0, visibleCount).map((u, i) => ({
    ...u,
    rank: i + 1,
    name: sanitizeDisplayName(profiles.get(u.userId)?.name || "匿名"),
    avatar: sanitizeAvatar(profiles.get(u.userId)?.avatar || "👤"),
  }));

  const hasMore = visibleCount < rawData.length;
  const totalUsers = rawData.length;

  const myIndex = rawData.findIndex((u) => u.userId === userProfile.uid);
  const myRank = myIndex >= 0 ? myIndex + 1 : totalUsers + 1;
  const myStats =
    myIndex >= 0
      ? rawData[myIndex]
      : { totalDuration: 0, totalPoints: 0, sessions: 0 };

  /* ── Period tabs ───────────────────────────────── */
  const periods: { key: RankingPeriod; label: string }[] = [
    { key: "today", label: "今日" },
    { key: "week", label: "今週" },
    { key: "month", label: "今月" },
    { key: "all", label: "全期間" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────── */}
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
          全ユーザーの学習ポイントでリアルタイム順位を表示
        </p>
      </motion.div>

      {/* ── Period Tabs ─────────────────────────────── */}
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
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
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
          </button>
        ))}
      </motion.div>

      {/* ── My Stats Cards ──────────────────────────── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="glass-card p-4 text-center">
          <Trophy
            size={20}
            style={{ color: "#FFD700", margin: "0 auto" }}
          />
          <div
            className="text-2xl font-black mt-1"
            style={{ color: "var(--accent)" }}
          >
            #{myRank}
          </div>
          <div
            className="text-[10px] font-medium"
            style={{ color: "var(--muted)" }}
          >
            あなたの順位
          </div>
        </div>

        <div className="glass-card p-4 text-center">
          <Flame
            size={20}
            style={{ color: "var(--accent)", margin: "0 auto" }}
          />
          <div
            className="text-2xl font-black mt-1"
            style={{ color: "var(--foreground)" }}
          >
            {myStats.totalPoints.toLocaleString()}
          </div>
          <div
            className="text-[10px] font-medium"
            style={{ color: "var(--muted)" }}
          >
            ポイント
          </div>
        </div>

        <div className="glass-card p-4 text-center">
          <Clock
            size={20}
            style={{ color: "var(--accent)", margin: "0 auto" }}
          />
          <div
            className="text-2xl font-black mt-1"
            style={{ color: "var(--foreground)" }}
          >
            {formatHoursMinutes(myStats.totalDuration)}
          </div>
          <div
            className="text-[10px] font-medium"
            style={{ color: "var(--muted)" }}
          >
            学習時間
          </div>
        </div>
      </motion.div>

      {/* ── Loading / Empty / Ranking list ──────────── */}
      {loading ? (
        <motion.div
          className="flex flex-col items-center justify-center py-16 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2
            size={32}
            className="animate-spin"
            style={{ color: "var(--accent)" }}
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            ランキングを読み込み中...
          </span>
        </motion.div>
      ) : visibleRanking.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center py-16 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Users size={48} style={{ color: "var(--muted)" }} />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            まだランキングデータがありません
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            学習を始めると自動でランキングに反映されます
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="glass-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          {/* List header */}
          <div
            className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: "var(--accent)" }} />
              <h2
                className="text-base font-bold"
                style={{ color: "var(--foreground)" }}
              >
                全体ランキング
              </h2>
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--muted)" }}
            >
              {totalUsers} 人参加中
            </span>
          </div>

          {/* Rows */}
          <div
            className="divide-y"
            style={{ borderColor: "var(--card-border)" }}
          >
            <AnimatePresence mode="popLayout">
              {visibleRanking.map((user) => {
                const isMe = user.userId === userProfile.uid;
                const isTop3 = user.rank <= 3;

                return (
                  <motion.div
                    key={user.userId}
                    className="flex items-center gap-4 px-5 py-4 transition-colors"
                    style={{
                      background: isMe
                        ? "var(--accent-light)"
                        : "transparent",
                      borderColor: "var(--card-border)",
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: Math.min(user.rank * 0.02, 0.5),
                    }}
                  >
                    {/* Rank */}
                    <div className="w-10 text-center flex-shrink-0">
                      {isTop3 ? (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center mx-auto text-white font-black text-sm"
                          style={{
                            background: RANK_COLORS[user.rank - 1],
                          }}
                        >
                          {user.rank}
                        </div>
                      ) : (
                        <span
                          className="text-lg font-bold"
                          style={{ color: "var(--muted)" }}
                        >
                          {user.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        avatar={user.avatar}
                        background={isMe ? "var(--accent)" : "var(--muted-bg)"}
                      />
                      <div className="min-w-0">
                        <span
                          className="text-sm font-bold truncate block"
                          style={{
                            color: isMe
                              ? "var(--accent)"
                              : "var(--foreground)",
                          }}
                        >
                          {isMe
                            ? `${user.name} (あなた)`
                            : user.name}
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
                          color: isMe
                            ? "var(--accent)"
                            : "var(--foreground)",
                        }}
                      >
                        {user.totalPoints.toLocaleString()} pt
                      </span>
                      <br />
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--muted)" }}
                      >
                        ({formatHoursMinutes(user.totalDuration)})
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ── Load-more button ──────────────────── */}
          {hasMore && (
            <div
              className="px-5 py-4 border-t"
              style={{ borderColor: "var(--card-border)" }}
            >
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--accent)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    さらに100件表示（残り{" "}
                    {rawData.length - visibleCount} 件）
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Sticky my-rank card ────────────────────── */}
      {!loading && (
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
              {userProfile.avatar || "🎓"}
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
                  {myStats.totalPoints.toLocaleString()} pt
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatHoursMinutes(myStats.totalDuration)}
                </span>
                <span className="flex items-center gap-1">
                  <Target size={12} />
                  {myStats.sessions} セッション
                </span>
              </div>
            </div>
            <div className="text-right">
              {myRank <= 3 ? (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black"
                  style={{
                    background: RANK_COLORS[myRank - 1],
                  }}
                >
                  {myRank}
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <TrendingUp
                    size={18}
                    style={{ color: "var(--accent)" }}
                  />
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
      )}
    </div>
  );
}

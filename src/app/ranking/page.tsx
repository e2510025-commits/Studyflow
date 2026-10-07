"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Users,
  ChevronDown,
  Loader2,
  BadgeCheck,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import { subscribeActiveStudyUsers } from "@/lib/firestore/focusRoom";
import {
  fetchDailyRankMap,
  fetchRankingData,
  saveUserProfile,
  getProfilesBatch,
  type AggregatedUser,
} from "@/lib/firestore/ranking";
import { addRival, removeRival, subscribeRivals } from "@/lib/firestore/rivals";
import QuickProfileCard from "@/components/profile/QuickProfileCard";

type RankingPeriod = "today" | "week" | "month" | "all";

/* ─── Medal colours ────────────────────────────────── */
const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PAGE_SIZE = 100;

function Avatar({
  avatar,
  size = 40,
  background,
  glowColor,
}: {
  avatar: string;
  size?: number;
  background?: string;
  glowColor?: string;
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
        style={{ width: size, height: size, background: "transparent", boxShadow: glowColor ? `0 0 0 2px ${glowColor}` : "none" }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-lg flex-shrink-0"
      style={{ width: size, height: size, background: background || "var(--muted-bg)", boxShadow: glowColor ? `0 0 0 2px ${glowColor}` : "none" }}
    >
      {avatar || "👤"}
    </div>
  );
}

export default function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>("today");
  const userProfile = useStore((state) => state.userProfile);
  const friends = useStore((state) => state.friends);
  const subjects = useStore((state) => state.subjects);

  /* ── State ─────────────────────────────────────── */
  const [rawData, setRawData] = useState<AggregatedUser[]>([]);
  const [profiles, setProfiles] = useState<
    Map<string, { name: string; avatar: string; isOfficial?: boolean; equippedBadges?: string[] }>
  >(new Map());
  const [dailyTrend, setDailyTrend] = useState<Map<string, number>>(new Map());
  const [rivalUids, setRivalUids] = useState<Set<string>>(new Set());
  const [rivalOnly, setRivalOnly] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [rivalBusy, setRivalBusy] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [quickProfileUid, setQuickProfileUid] = useState<string | null>(null);
  const [activeStudySet, setActiveStudySet] = useState<Set<string>>(new Set());

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
    const generation = ++requestGeneration.current;
    setLoading(true); setError(""); setVisibleCount(PAGE_SIZE);
    try {
      const data = await fetchRankingData(period, selectedSubject);
      if (generation !== requestGeneration.current) return;
      setRawData(data);
      // Daily movement is for all subjects; do not show an unrelated trend in a subject filter.
      const [todayRankMap, yesterdayRankMap] = selectedSubject ? [new Map<string, number>(), new Map<string, number>()] : await Promise.all([
        fetchDailyRankMap(0).catch(() => new Map<string, number>()),
        fetchDailyRankMap(1).catch(() => new Map<string, number>()),
      ]);
      if (generation !== requestGeneration.current) return;
      const trendMap = new Map<string, number>();
      data.forEach((row, idx) => {
        const yesterdayRank = yesterdayRankMap.get(row.userId);
        if (yesterdayRank) trendMap.set(row.userId, yesterdayRank - (todayRankMap.get(row.userId) || idx + 1));
      });
      setDailyTrend(trendMap);
      const uids = data.slice(0, PAGE_SIZE).map((row) => row.userId);
      if (userProfile.uid && !uids.includes(userProfile.uid)) uids.push(userProfile.uid);
      const profs = await getProfilesBatch(uids);
      if (generation === requestGeneration.current) setProfiles(profs);
    } catch {
      if (generation === requestGeneration.current) setError("ランキングを読み込めませんでした。再読み込みしてください。");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [period, userProfile.uid, selectedSubject]);

  useEffect(() => {
    void loadRanking();
    return () => { requestGeneration.current += 1; };
  }, [loadRanking]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadRanking();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadRanking]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeRivals(userProfile.uid, (rows) => {
      setRivalUids(new Set(rows.map((row) => row.rivalUid)));
    });
  }, [userProfile.uid]);

  useEffect(() => {
    return subscribeActiveStudyUsers((rows) => {
      setActiveStudySet(new Set(rows.map((r) => r.userUid)));
    });
  }, []);

  /* ── Load more ─────────────────────────────────── */
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    const generation = requestGeneration.current;
    setLoadingMore(true); setActionError("");
    try {
      const source = rivalOnly
        ? rawData.filter((u) => u.userId === userProfile.uid || rivalUids.has(u.userId))
        : rawData;
      const nextSlice = source.slice(visibleCount, visibleCount + PAGE_SIZE);
      const newUids = nextSlice
        .map((u) => u.userId)
        .filter((uid) => !profiles.has(uid));

      if (newUids.length > 0) {
        const newProfs = await getProfilesBatch(newUids);
        if (generation !== requestGeneration.current) return;
        setProfiles((prev) => {
          const merged = new Map(prev);
          newProfs.forEach((v, k) => merged.set(k, v));
          return merged;
        });
      }
      if (generation === requestGeneration.current) setVisibleCount((prev) => prev + PAGE_SIZE);
    } catch { setActionError("追加のプロフィールを読み込めませんでした。再試行してください。"); } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, visibleCount, rawData, rivalOnly, userProfile.uid, rivalUids, profiles]);

  /* ── Derived data ──────────────────────────────── */
  const filteredData = rivalOnly
    ? rawData.filter((u) => u.userId === userProfile.uid || rivalUids.has(u.userId))
    : rawData;

  const visibleRanking = filteredData.slice(0, visibleCount).map((u, i) => ({
    ...u,
    rank: i + 1,
    name: sanitizeDisplayName(profiles.get(u.userId)?.name || "匿名"),
    avatar: sanitizeAvatar(profiles.get(u.userId)?.avatar || "👤"),
  }));

  const hasMore = visibleCount < filteredData.length;
  const totalUsers = filteredData.length;

  const myIndex = filteredData.findIndex((u) => u.userId === userProfile.uid);
  const myRank = myIndex >= 0 ? myIndex + 1 : totalUsers + 1;
  const myStats =
    myIndex >= 0
      ? filteredData[myIndex]
      : { totalDuration: 0, totalPoints: 0, sessions: 0 };
  const myAvatar = sanitizeAvatar(userProfile.avatar || "👤");
  const myOfficial = Boolean(profiles.get(userProfile.uid)?.isOfficial);

  /* ── Period tabs ───────────────────────────────── */
  const periods: { key: RankingPeriod; label: string }[] = [
    { key: "today", label: "今日" },
    { key: "week", label: "今週" },
    { key: "month", label: "今月" },
    { key: "all", label: "全期間" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 ranking-page">
      {/* ── Header ─────────────────────────────────── */}
      <motion.div
        className="text-left"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Trophy size={32} style={{ color: "#FFD700" }} />
          <h1
            className="text-3xl sm:text-4xl font-black"
            style={{ color: "var(--foreground)" }}
          >
            ランキング
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          全ユーザーの学習時間でリアルタイム順位を表示
        </p>
      </motion.div>

      {/* ── Period Tabs ─────────────────────────────── */}
      <motion.div
        className="segmented-control"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {periods.map((p) => (
          <button
            key={p.key}
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
            className="min-h-11 flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
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

      {/* ── Subject Filter ─────────────────────────── */}
      {subjects.length > 0 && (
        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>教科別ランキング</h3>
          <select
            aria-label="ランキングの教科"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          >
            <option value="">全教科</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.name}>
                {subject.icon} {subject.name}
              </option>
            ))}
          </select>
        </motion.div>
      )}

      <motion.div
        className="glass-card p-4 space-y-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>ライバル比較</h3>
          <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={rivalOnly} onChange={(e) => setRivalOnly(e.target.checked)} />
            ライバルのみ表示
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {friends.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>フレンドを追加するとライバル設定できます</p>
          )}
          {friends.map((friend) => {
            const isRival = rivalUids.has(friend.uid);
            return (
              <div
                key={friend.uid}
                className="max-w-full px-2 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
                style={{
                  background: "var(--muted-bg)",
                }}
              >
                <button
                  onClick={() => setQuickProfileUid(friend.uid)}
                  className="min-h-11 min-w-0 break-words px-1.5 py-1 rounded-md transition-all"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.03)";
                    e.currentTarget.style.background = "rgba(148,163,184,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {friend.name}
                </button>
                <button
                  aria-label={`${friend.name}のライバル登録を${isRival ? "解除" : "追加"}`}
                  aria-pressed={isRival}
                  disabled={Boolean(rivalBusy)}
                  onClick={() => {
                    if (rivalBusy) return;
                    setRivalBusy(friend.uid); setActionError("");
                    void (isRival ? removeRival(userProfile.uid, friend.uid) : addRival(userProfile.uid, friend.uid))
                      .catch(() => setActionError("ライバル設定を保存できませんでした。再試行してください。"))
                      .finally(() => setRivalBusy(null));
                  }}
                  className="min-h-11 min-w-11 shrink-0 px-1.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors"
                  style={{
                    color: isRival ? "#ef4444" : "var(--accent)",
                    background: isRival ? "rgba(239,68,68,0.1)" : "var(--accent-light)",
                  }}
                >
                  {isRival ? <UserMinus size={12} /> : <UserPlus size={12} />}
                  {isRival ? "解除" : "ライバル"}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── My Stats Cards ──────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 min-[430px]:grid-cols-3 gap-3"
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
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
      {error ? <div role="alert" className="glass-card p-5 space-y-3"><p>{error}</p><button className="secondary-button" onClick={() => void loadRanking()}>ランキングを再読み込み</button></div> : loading ? (
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
                const trend = dailyTrend.get(user.userId) || 0;
                const isStudying = activeStudySet.has(user.userId);

                return (
                  <motion.div
                    key={user.userId}
                    className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-4 transition-colors"
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
                      <button
                        aria-label={`${user.name}のプロフィールを開く`}
                        onClick={() => setQuickProfileUid(user.userId)}
                        className="min-h-11 min-w-11 rounded-full transition-all"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.06)";
                          e.currentTarget.style.filter = "brightness(0.92)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.filter = "none";
                        }}
                      >
                        <Avatar
                          avatar={user.avatar}
                          background={isMe ? "var(--accent)" : "var(--muted-bg)"}
                          glowColor={isStudying ? "#38bdf8" : undefined}
                        />
                      </button>
                      <div className="min-w-0">
                        <Link href={`/profile/${user.userId}`} className="text-sm font-bold min-h-11 break-words flex items-center gap-1 hover:underline" style={{ color: isMe ? "var(--accent)" : "var(--foreground)" }}>
                          {isMe ? `${user.name} (あなた)` : user.name}
                          {profiles.get(user.userId)?.isOfficial ? <BadgeCheck size={14} style={{ color: "#38bdf8" }} /> : null}
                        </Link>
                        <span
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          {user.sessions} セッション
                        </span>
                        <span className="text-[10px] inline-flex items-center gap-1" style={{ color: trend > 0 ? "#16a34a" : trend < 0 ? "#ef4444" : "var(--muted)" }}>
                          {trend > 0 ? <ArrowUp size={12} /> : trend < 0 ? <ArrowDown size={12} /> : null}
                          {selectedSubject ? "教科別の前日比は未集計" : dailyTrend.has(user.userId) ? `前日比 ${trend > 0 ? `+${trend}` : trend}` : "前日比 —"}
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
                    {filteredData.length - visibleCount} 件）
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
            <button
              onClick={() => setQuickProfileUid(userProfile.uid)}
              className="min-h-11 min-w-11 rounded-full transition-all"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.06)";
                e.currentTarget.style.filter = "brightness(0.92)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "none";
              }}
            >
              <Avatar avatar={myAvatar} size={48} background="var(--accent)" glowColor={activeStudySet.has(userProfile.uid) ? "#38bdf8" : undefined} />
            </button>
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
                {myOfficial ? <BadgeCheck size={14} style={{ color: "#38bdf8" }} /> : null}
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

      <QuickProfileCard
        open={Boolean(quickProfileUid)}
        uid={quickProfileUid}
        viewerUid={userProfile.uid}
        onClose={() => setQuickProfileUid(null)}
      />
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Gift, Loader2, Target } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { MissionStatus } from "@/types";

type MissionApiResponse = {
  seasonName: string;
  missions: MissionStatus[];
};

function formatProgressValue(value: number, unit: string) {
  if (unit === "秒") {
    if (value >= 3600) return `${(value / 3600).toFixed(1)}時間`;
    if (value >= 60) return `${Math.floor(value / 60)}分`;
  }
  return `${Math.floor(value)}${unit}`;
}

export default function MissionsPage() {
  const { userProfile, updateUserProfile } = useStore();
  const [loading, setLoading] = useState(true);
  const [claimingScope, setClaimingScope] = useState<string>("");
  const [seasonName, setSeasonName] = useState("Season");
  const [missions, setMissions] = useState<MissionStatus[]>([]);

  const loadMissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as MissionApiResponse;
      setSeasonName(json.seasonName || "Season");
      setMissions(json.missions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  const ordered = useMemo(() => {
    const order = new Map([
      ["daily", 0],
      ["weekly", 1],
      ["season", 2],
    ]);
    return [...missions].sort((a, b) => (order.get(a.scope) || 99) - (order.get(b.scope) || 99));
  }, [missions]);

  const claim = useCallback(
    async (scope: string) => {
      setClaimingScope(scope);
      try {
        const res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim", scope }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          alert(err.error || "受け取りに失敗しました");
          return;
        }

        const json = (await res.json()) as { points: number };
        const points = Math.max(0, Math.floor(json.points || 0));
        updateUserProfile({
          bonusPoints: (userProfile.bonusPoints || 0) + points,
          totalPoints: userProfile.totalPoints + points,
        });
        await loadMissions();
      } finally {
        setClaimingScope("");
      }
    },
    [loadMissions, updateUserProfile, userProfile.bonusPoints, userProfile.totalPoints]
  );

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 flex items-center justify-center gap-3">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        <p className="text-sm" style={{ color: "var(--muted)" }}>ミッションを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>ミッション</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          デイリー・ウィークリー・{seasonName}の課題を達成してポイントを獲得
        </p>
      </div>

      <div className="space-y-4">
        {ordered.map((row, index) => {
          const mission = row.mission;
          const isClaiming = claimingScope === row.scope;

          if (!mission) {
            return (
              <section key={row.scope} className="glass-card p-5">
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{row.periodLabel}</p>
                <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>現在表示できるミッションがありません。</p>
              </section>
            );
          }

          const unit = mission.goalType === "study_sessions" ? "回" : "秒";
          const canClaim = row.completed && !row.claimed;

          return (
            <motion.section
              key={`${row.scope}-${row.periodKey}`}
              className="glass-card p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-wide" style={{ color: "var(--accent)" }}>{row.periodLabel}</p>
                  <h2 className="text-lg font-black mt-1" style={{ color: "var(--foreground)" }}>{mission.title}</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{mission.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>報酬</p>
                  <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{mission.rewardPoints} pt</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}>
                  <span className="inline-flex items-center gap-1"><Target size={12} /> 進捗</span>
                  <span>
                    {formatProgressValue(row.progressValue, unit)} / {formatProgressValue(mission.goalValue, unit)}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full" style={{ background: "var(--muted-bg)" }}>
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, Math.round(row.progressRate * 100))}%`,
                      background: row.completed ? "#22c55e" : "var(--accent)",
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {row.claimed ? "受け取り済み" : row.completed ? "達成済み" : "進行中"}
                </div>
                {row.claimed ? (
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "#22c55e20", color: "#16a34a" }}
                    disabled
                  >
                    <CheckCircle2 size={14} className="inline mr-1" /> 受け取り済み
                  </button>
                ) : (
                  <button
                    onClick={() => void claim(row.scope)}
                    disabled={!canClaim || isClaiming}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
                    style={{
                      background: "#facc15",
                      color: "#5b3f00",
                    }}
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 size={14} className="inline mr-1 animate-spin" /> 受取中
                      </>
                    ) : (
                      <>
                        <Gift size={14} className="inline mr-1" /> 受け取る
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

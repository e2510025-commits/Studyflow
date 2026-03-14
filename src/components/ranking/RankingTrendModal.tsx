"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Trophy } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RankHistoryEntry {
  date: string;
  rank: number;
  totalHours: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentRank: number;
  rankHistory: RankHistoryEntry[];
}

export default function RankingTrendModal({
  open,
  onClose,
  currentRank,
  rankHistory,
}: Props) {
  const bestRank =
    rankHistory.length > 0
      ? Math.min(...rankHistory.map((r) => r.rank))
      : currentRank;
  const totalHours =
    rankHistory.length > 0
      ? rankHistory[rankHistory.length - 1].totalHours
      : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <div
              className="w-full max-w-2xl rounded-3xl p-6 relative glass-card"
              style={{
                backdropFilter: "blur(24px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <motion.button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--muted)",
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={16} />
              </motion.button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-light)" }}
                >
                  <TrendingUp size={22} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h2 className="text-lg font-black" style={{ color: "var(--foreground)" }}>
                    ランキング推移
                  </h2>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    全期間のランキング変動グラフ
                  </p>
                </div>
                <div
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.15)",
                  }}
                >
                  <Trophy size={16} style={{ color: "#FFD700" }} />
                  <span className="font-black font-mono text-sm" style={{ color: "var(--foreground)" }}>
                    #{currentRank.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Chart */}
              {rankHistory.length > 1 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={rankHistory}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="rankAreaFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#818cf8"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#818cf8"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                        <linearGradient
                          id="rankLineGrad"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="50%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#a5b4fc" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--card-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="var(--card-border)"
                        tick={{
                          fill: "var(--muted)",
                          fontSize: 11,
                        }}
                        tickFormatter={(val: string) => {
                          const d = new Date(val);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        axisLine={{ stroke: "var(--card-border)" }}
                      />
                      <YAxis
                        reversed
                        stroke="var(--card-border)"
                        tick={{
                          fill: "var(--muted)",
                          fontSize: 11,
                        }}
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(val: number) =>
                          `#${val.toLocaleString()}`
                        }
                        axisLine={{ stroke: "var(--card-border)" }}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card-bg)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "12px",
                          boxShadow: "var(--shadow)",
                          color: "var(--foreground)",
                          fontSize: 12,
                          backdropFilter: "blur(16px)",
                        }}
                        labelFormatter={(val) => {
                          const d = new Date(val as string);
                          return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        formatter={(value: number | undefined) => [
                          `#${(value ?? 0).toLocaleString()}`,
                          "順位",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="rank"
                        stroke="url(#rankLineGrad)"
                        strokeWidth={3}
                        fill="url(#rankAreaFill)"
                        dot={{
                          fill: "#818cf8",
                          stroke: "#4f46e5",
                          strokeWidth: 2,
                          r: 4,
                        }}
                        activeDot={{
                          r: 6,
                          fill: "#a5b4fc",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex flex-col items-center justify-center text-center">
                  <Trophy
                    size={52}
                    style={{ color: "var(--card-border)" }}
                  />
                  <p
                    className="mt-4 text-sm leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    学習データが蓄積されると、
                    <br />
                    ランキングの推移グラフが表示されます
                  </p>
                </div>
              )}

              {/* Footer stats */}
              <div
                className="mt-5 pt-4 grid grid-cols-3 gap-4"
                style={{ borderTop: "1px solid var(--card-border)" }}
              >
                <div className="text-center">
                  <p
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    現在の順位
                  </p>
                  <p className="text-lg font-black font-mono" style={{ color: "var(--foreground)" }}>
                    #{currentRank.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    最高順位
                  </p>
                  <p
                    className="text-lg font-black font-mono"
                    style={{ color: "#FFD700" }}
                  >
                    #{bestRank.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    総学習時間
                  </p>
                  <p className="text-lg font-black font-mono" style={{ color: "var(--foreground)" }}>
                    {totalHours}h
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

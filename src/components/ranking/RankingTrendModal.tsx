"use client";

import React from "react";
import Dialog from "@/components/ui/Dialog";
import { Trophy } from "lucide-react";
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
    <Dialog open={open} onClose={onClose} title="ランキング推移">
      <p className="text-sm text-muted mb-4">全期間の順位と学習時間の変化</p>
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

    </Dialog>
  );
}

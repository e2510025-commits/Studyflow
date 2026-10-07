"use client";

import React, { useMemo, useState } from "react";
import { useLiveStudyLogs } from "@/components/dashboard/useLiveStudyLogs";
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  subWeeks,
  getDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import GlassCard from "@/components/ui/GlassCard";
import { motion } from "framer-motion";

const WEEKS = 20; // Show ~20 weeks
const CELL_SIZE = 16;
const GAP = 3;

export default function HeatMap() {
  const studyLogs = useLiveStudyLogs();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { grid, maxDuration, months } = useMemo(() => {
    const now = new Date();
    const endDate = now;
    const startDate = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), WEEKS - 1);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Build duration map
    const durationMap = new Map<string, number>();
    studyLogs.forEach((log) => {
      const key = format(new Date(log.createdAt), "yyyy-MM-dd");
      durationMap.set(key, (durationMap.get(key) || 0) + log.duration);
    });

    let maxDur = 0;
    durationMap.forEach((v) => {
      if (v > maxDur) maxDur = v;
    });

    // Build weeks grid (columns = weeks, rows = days of week)
    const grid: Array<Array<{ date: string; duration: number; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ date: string; duration: number; dayOfWeek: number }> = [];
    
    days.forEach((day) => {
      const dow = getDay(day); // 0=Sun
      const mondayDow = dow === 0 ? 6 : dow - 1; // Convert to Mon=0
      const dateStr = format(day, "yyyy-MM-dd");
      const duration = durationMap.get(dateStr) || 0;

      if (mondayDow === 0 && currentWeek.length > 0) {
        grid.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({ date: dateStr, duration, dayOfWeek: mondayDow });
    });
    if (currentWeek.length > 0) grid.push(currentWeek);

    // Build month labels
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = "";
    grid.forEach((week, weekIdx) => {
      const firstDay = week[0];
      if (firstDay) {
        const monthStr = format(new Date(firstDay.date), "M月", { locale: ja });
        if (monthStr !== lastMonth) {
          monthLabels.push({ label: monthStr, weekIndex: weekIdx });
          lastMonth = monthStr;
        }
      }
    });

    return { grid, maxDuration: maxDur, months: monthLabels };
  }, [studyLogs]);

  const getColor = (duration: number): string => {
    if (duration === 0) return "var(--muted-bg)";
    if (maxDuration === 0) return "var(--muted-bg)";
    const ratio = duration / maxDuration;
    if (ratio < 0.25) return "#6366f140";
    if (ratio < 0.5) return "#6366f170";
    if (ratio < 0.75) return "#6366f1a0";
    return "#6366f1";
  };

  const formatDuration = (s: number) => {
    if (s === 0) return "記録なし";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const dayLabels = ["月", "", "水", "", "金", "", ""];

  return (
    <GlassCard hover={false}>
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        学習の記録
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        過去{WEEKS}週間の学習状況
      </p>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1" style={{ minWidth: "fit-content" }}>
          {/* Month labels */}
          <div className="relative h-5" style={{ marginLeft: 28 }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="text-[10px]"
                style={{
                  color: "var(--muted)",
                  position: "absolute",
                  left: m.weekIndex * (CELL_SIZE + GAP),
                  width: 20,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-0">
            {/* Day labels */}
            <div
              className="flex flex-col justify-between pr-2"
              style={{ height: 7 * (CELL_SIZE + GAP) - GAP }}
            >
              {dayLabels.map((label, i) => (
                <span
                  key={i}
                  className="text-[10px] leading-none flex items-center"
                  style={{
                    color: "var(--muted)",
                    height: CELL_SIZE,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex" style={{ gap: GAP }}>
              {grid.map((week, weekIdx) => (
                <div
                  key={weekIdx}
                  className="flex flex-col"
                  style={{ gap: GAP }}
                >
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const cell = week.find((c) => c.dayOfWeek === dayIdx);
                    return (
                      <motion.button
                        type="button"
                        disabled={!cell}
                        aria-label={cell ? `${cell.date}、${formatDuration(cell.duration)}` : "未到来の日"}
                        aria-pressed={Boolean(cell && selectedDate === cell.date)}
                        title={cell ? `${cell.date} ${formatDuration(cell.duration)}` : undefined}
                        onClick={() => cell && setSelectedDate(cell.date)}
                        key={dayIdx}
                        className="heatmap-cell relative group"
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          background: cell ? getColor(cell.duration) : "transparent",
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: cell ? 1 : 0, scale: cell ? 1 : 0 }}
                        transition={{ delay: weekIdx * 0.02 + dayIdx * 0.01 }}
                      >
                        {cell && cell.duration > 0 && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none z-10"
                            style={{ background: "var(--foreground)", color: "var(--background)" }}>
                            {format(new Date(cell.date), "M/d")} - {formatDuration(cell.duration)}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-[10px] mr-1" style={{ color: "var(--muted)" }}>
              少
            </span>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
              <div
                key={i}
                className="heatmap-cell"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  background:
                    ratio === 0
                      ? "var(--muted-bg)"
                      : ratio < 0.25
                      ? "#6366f130"
                      : ratio < 0.5
                      ? "#6366f160"
                      : ratio < 0.75
                      ? "#6366f190"
                      : "#6366f1",
                }}
              />
            ))}
            <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>
              多
            </span>
          </div>
        </div>
      </div>
      <p className="heatmap-detail" role="status">
        {selectedDate ? `${selectedDate}：${formatDuration(grid.flat().find((cell) => cell.date === selectedDate)?.duration || 0)}` : "日付を選ぶと、その日の学習時間を確認できます。"}
      </p>
    </GlassCard>
  );
}

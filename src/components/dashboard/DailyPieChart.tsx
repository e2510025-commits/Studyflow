"use client";

import React, { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useLiveStudyLogs } from "@/components/dashboard/useLiveStudyLogs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format, startOfDay } from "date-fns";
import GlassCard from "@/components/ui/GlassCard";
import EmptyState from "@/components/ui/EmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";

export default function DailyPieChart() {
  const { subjects } = useStore();
  const studyLogs = useLiveStudyLogs();

  const data = useMemo(() => {
    const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
    const todayLogs = studyLogs.filter(
      (l) => format(new Date(l.createdAt), "yyyy-MM-dd") === todayStr
    );

    const subjectMap = new Map<string, number>();
    todayLogs.forEach((log) => {
      subjectMap.set(
        log.subjectId,
        (subjectMap.get(log.subjectId) || 0) + log.duration
      );
    });

    return Array.from(subjectMap.entries())
      .map(([subjectId, duration]) => {
        const subject = subjects.find((s) => s.id === subjectId);
        return {
          name: subject?.name || "不明",
          value: duration,
          color: subject?.color || "#94a3b8",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [studyLogs, subjects]);

  const totalToday = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <GlassCard hover={false}>
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          今日の学習割合
        </h3>
        <EmptyState
          title="まだ記録がありません"
          description="タイマーで学習を始めると、ここに教科別の割合が表示されます"
          icon={<PieChartIcon size={32} style={{ color: "var(--accent)" }} />}
        />
      </GlassCard>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="glass-card-flat px-3 py-2"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-sm font-medium" style={{ color: payload[0].payload.color }}>
            {payload[0].name}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {formatHoursMinutes(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <GlassCard hover={false}>
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        今日の学習割合
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        合計 {formatHoursMinutes(totalToday)}
      </p>

      <div className="flex flex-col items-center">
        <div className="w-full h-60 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

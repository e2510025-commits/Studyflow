"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { useLiveStudyLogs } from "@/components/dashboard/useLiveStudyLogs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { ja } from "date-fns/locale";
import GlassCard from "@/components/ui/GlassCard";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";

type Period = "week" | "month" | "year" | "all";

interface SubjectLite {
  id: string;
  name: string;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  subjects,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  subjects: SubjectLite[];
}) {
  if (active && payload && payload.length) {
    const total = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div
        className="glass-card-flat px-4 py-3"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
          {label}
        </p>
        {payload
          .filter((p) => p.value > 0)
          .map((p) => {
            const sub = subjects.find((s) => s.id === p.name);
            return (
              <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
                <span style={{ color: sub?.color || "var(--muted)" }}>
                  {sub?.name || p.name}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {formatHoursMinutes(p.value)}
                </span>
              </div>
            );
          })}
        <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span style={{ color: "var(--foreground)" }}>合計</span>
            <span style={{ color: "var(--foreground)" }}>{formatHoursMinutes(total)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function WeeklyBarChart() {
  const { subjects } = useStore();
  const studyLogs = useLiveStudyLogs();
  const [period, setPeriod] = useState<Period>("week");

  const data = useMemo(() => {
    const now = new Date();
    let unitDates: Date[];

    if (period === "week") {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      unitDates = eachDayOfInterval({ start, end });
    } else if (period === "month") {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      unitDates = eachDayOfInterval({ start, end });
    } else if (period === "year") {
      const start = startOfYear(now);
      const end = endOfYear(now);
      unitDates = eachMonthOfInterval({ start, end });
    } else {
      if (studyLogs.length === 0) return [];
      const sorted = [...studyLogs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const first = startOfMonth(new Date(sorted[0].createdAt));
      const end = endOfMonth(now);
      unitDates = eachMonthOfInterval({ start: first, end });
    }

    return unitDates.map((dateUnit) => {
      const isMonthlyUnit = period === "year" || period === "all";
      const keyFormat = isMonthlyUnit ? "yyyy-MM" : "yyyy-MM-dd";
      const unitKey = format(dateUnit, keyFormat);
      const unitLogs = studyLogs.filter(
        (l) => format(new Date(l.createdAt), keyFormat) === unitKey
      );

      const getLabel = () => {
        if (period === "week") {
          return format(dateUnit, "E", { locale: ja });
        }
        if (period === "month") {
          return format(dateUnit, "d");
        }
        if (period === "year") {
          return format(dateUnit, "M月");
        }
        return format(dateUnit, "yy/MM");
      };

      const result: Record<string, string | number> = {
        date: getLabel(),
        total: unitLogs.reduce((s, l) => s + l.duration, 0),
      };

      // Per subject
      subjects.forEach((sub) => {
        result[sub.id] = unitLogs
          .filter((l) => l.subjectId === sub.id)
          .reduce((s, l) => s + l.duration, 0);
      });

      return result;
    });
  }, [studyLogs, subjects, period]);

  const hasData = data.some((d) => (d.total as number) > 0);

  const formatYAxis = (value: number) => {
    if (value === 0) return "0";
    if (value >= 3600) return `${Math.round(value / 3600)}h`;
    return `${Math.round(value / 60)}m`;
  };

  return (
    <GlassCard hover={false}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            学習時間の推移
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            教科別の学習時間
          </p>
        </div>
        <div className="flex gap-1">
          {(["week", "month", "year", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: period === p ? "var(--accent-light)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--muted)",
              }}
            >
              {p === "week"
                ? "週間"
                : p === "month"
                  ? "月間"
                  : p === "year"
                    ? "年間"
                    : "全期間"}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title="データがありません"
          description="学習を記録すると、日別の推移グラフが表示されます"
          icon={<BarChart3 size={32} style={{ color: "var(--accent)" }} />}
        />
      ) : period === "week" ? (
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                width={40}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<ChartTooltip subjects={subjects} />} />
              {subjects.map((sub) => (
                <Bar
                  key={sub.id}
                  dataKey={sub.id}
                  stackId="a"
                  fill={sub.color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                {subjects.map((sub) => (
                  <linearGradient
                    key={sub.id}
                    id={`gradient-${sub.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={sub.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={sub.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                width={40}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<ChartTooltip subjects={subjects} />} />
              {subjects.map((sub) => (
                <Area
                  key={sub.id}
                  type="monotone"
                  dataKey={sub.id}
                  stackId="1"
                  stroke={sub.color}
                  fill={`url(#gradient-${sub.id})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}

"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useLiveStudyLogs } from "@/components/dashboard/useLiveStudyLogs";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import GlassCard from "@/components/ui/GlassCard";
import EmptyState from "@/components/ui/EmptyState";
import { SubjectIcon } from "@/components/timer/SubjectSelector";
import { Clock, FileText } from "lucide-react";
import { formatHoursMinutes } from "@/lib/utils";
import { motion } from "framer-motion";

export default function RecentLogs() {
  const subjects = useStore((state) => state.subjects);
  const studyLogs = useLiveStudyLogs();

  const recentLogs = useMemo(() => {
    return [...studyLogs]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10);
  }, [studyLogs]);

  if (recentLogs.length === 0) {
    return (
      <GlassCard hover={false}>
        <h3
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          最近の学習
        </h3>
        <EmptyState
          title="記録がありません"
          description="タイマーで学習を始めると、ここに履歴が表示されます"
          icon={<Clock size={32} style={{ color: "var(--accent)" }} />}
        />
        <Link href="/timer" className="secondary-button w-full">最初の学習を記録する</Link>
      </GlassCard>
    );
  }

  return (
    <GlassCard hover={false}>
      <h3
        className="text-lg font-semibold mb-4"
        style={{ color: "var(--foreground)" }}
      >
        最近の学習
      </h3>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {recentLogs.map((log, i) => {
          const subject = subjects.find((s) => s.id === log.subjectId);
          return (
            <motion.div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: "var(--muted-bg)" }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: `${subject?.color || "#94a3b8"}20`,
                  color: subject?.color || "#94a3b8",
                }}
              >
                <SubjectIcon iconName={subject?.icon || "book-open"} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span
                    className="text-base font-medium"
                    style={{ color: subject?.color || "var(--foreground)" }}
                  >
                    {subject?.name || "不明"}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {format(new Date(log.createdAt), "M/d HH:mm", {
                      locale: ja,
                    })}
                  </span>
                </div>
                <div
                  className="text-sm font-medium mt-0.5"
                  style={{ color: "var(--foreground)" }}
                >
                  {formatHoursMinutes(log.duration)}
                </div>
                {log.memo && (
                  <div className="flex items-center gap-1 mt-1">
                    <FileText size={12} style={{ color: "var(--muted)" }} />
                    <span
                      className="text-sm truncate"
                      style={{ color: "var(--muted)" }}
                    >
                      {log.memo}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}

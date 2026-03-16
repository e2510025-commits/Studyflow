"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { getAchievementMeta } from "@/lib/achievements";
import { fetchPublicProfile } from "@/lib/firestore/profile";
import { Trophy, Download, Share2, CalendarRange } from "lucide-react";

function pad(v: number): string {
  return String(v).padStart(2, "0");
}

function dateLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MotivationPanel() {
  const { studyLogs, userProfile } = useStore();
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    if (!userProfile.uid) return;
    void fetchPublicProfile(userProfile.uid)
      .then((profile) => setBadges(profile?.badges || []))
      .catch(() => setBadges([]));
  }, [userProfile.uid]);

  const weeklyDurations = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const target = new Date();
      target.setDate(target.getDate() - (6 - idx));
      const key = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      const total = studyLogs
        .filter((log) => {
          const d = new Date(log.createdAt);
          const current = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return current === key;
        })
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      return total;
    });
  }, [studyLogs]);

  const totalWeeklySec = weeklyDurations.reduce((sum, row) => sum + row, 0);
  const maxSec = Math.max(...weeklyDurations, 1);

  const createWeeklySummaryImage = async (): Promise<File> => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not available");

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("StudyFlow Weekly Report", 70, 110);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "28px sans-serif";
    ctx.fillText(`User: ${userProfile.name || userProfile.uid}`, 70, 160);
    ctx.fillText(`Total: ${Math.round(totalWeeklySec / 3600)}h`, 70, 200);

    const chartX = 90;
    const chartY = 320;
    const chartW = 900;
    const chartH = 500;

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    weeklyDurations.forEach((value, idx) => {
      const barW = 90;
      const gap = 34;
      const x = chartX + 40 + idx * (barW + gap);
      const h = Math.round((value / maxSec) * (chartH - 100));
      const y = chartY + chartH - h - 40;

      const gradient = ctx.createLinearGradient(0, y, 0, chartY + chartH);
      gradient.addColorStop(0, "#38bdf8");
      gradient.addColorStop(1, "#6366f1");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "22px sans-serif";
      ctx.fillText(`${Math.round(value / 60)}m`, x - 2, y - 10);
      ctx.fillText(dateLabel(6 - idx), x + 8, chartY + chartH - 10);
    });

    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px sans-serif";
    ctx.fillText("Generated automatically by StudyFlow", 70, 980);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
    if (!blob) throw new Error("failed to generate image");
    return new File([blob], `studyflow-weekly-${Date.now()}.png`, { type: "image/png" });
  };

  const handleDownloadWeeklyImage = async () => {
    const file = await createWeeklySummaryImage();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareWeeklyImage = async () => {
    const file = await createWeeklySummaryImage();
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "StudyFlow Weekly Report",
        text: "今週の学習レポートをシェアします",
        files: [file],
      });
      return;
    }
    await handleDownloadWeeklyImage();
  };

  return (
    <div className="grid xl:grid-cols-2 gap-5">
      <section className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} style={{ color: "var(--accent)" }} />
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            アチーブメント
          </h3>
        </div>
        {badges.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            まだ称号はありません。継続して学習すると獲得できます。
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {badges.map((id) => {
              const meta = getAchievementMeta(id);
              return (
                <div key={id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{meta?.title || id}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{meta?.description || "称号を獲得しました"}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={16} style={{ color: "var(--accent)" }} />
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            週間ログ画像
          </h3>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          直近7日間の学習を1枚画像に自動生成してSNSに共有できます。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleDownloadWeeklyImage()}
            className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
          >
            <Download size={14} />
            画像を保存
          </button>
          <button
            onClick={() => void handleShareWeeklyImage()}
            className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 text-white"
            style={{ background: "var(--accent)" }}
          >
            <Share2 size={14} />
            SNSへ共有
          </button>
          <a
            href="/api/calendar/export"
            className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          >
            <CalendarRange size={14} />
            カレンダー出力(.ics)
          </a>
        </div>
      </section>
    </div>
  );
}

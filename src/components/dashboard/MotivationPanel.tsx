"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { getAchievementMeta } from "@/lib/achievements";
import { fetchPublicProfile } from "@/lib/firestore/profile";
import { Trophy, Download, Share2, CalendarRange, Sparkles } from "lucide-react";

type ShareVariant = "square" | "story";

function pad(v: number): string {
  return String(v).padStart(2, "0");
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function calcStreak(logDates: string[]): number {
  const set = new Set(logDates);
  let streak = 0;
  const d = new Date();
  while (true) {
    const k = keyOf(d);
    if (!set.has(k)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function autoComment(params: { growthRate: number; streak: number; totalHours: number }): string {
  const { growthRate, streak, totalHours } = params;
  if (growthRate >= 1.2) return `先週比 +${Math.round(growthRate * 100)}% の大成長。勢いが最高です。`;
  if (streak >= 7) return `${streak}日連続学習中。安定した継続力が光っています。`;
  if (totalHours >= 10) return `今週は${Math.round(totalHours)}時間の学習を達成。積み上げが確実に効いています。`;
  return "今週も一歩ずつ前進。次週はさらに記録更新を狙いましょう。";
}

export default function MotivationPanel() {
  const { studyLogs, userProfile, subjects } = useStore();
  const [badges, setBadges] = useState<string[]>([]);
  const [variant, setVariant] = useState<ShareVariant>("square");

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
      const key = keyOf(target);
      return studyLogs
        .filter((log) => {
          const d = new Date(log.createdAt);
          return keyOf(d) === key;
        })
        .reduce((sum, log) => sum + (log.duration || 0), 0);
    });
  }, [studyLogs]);

  const previousWeekDurations = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const target = new Date();
      target.setDate(target.getDate() - (13 - idx));
      const key = keyOf(target);
      return studyLogs
        .filter((log) => {
          const d = new Date(log.createdAt);
          return keyOf(d) === key;
        })
        .reduce((sum, log) => sum + (log.duration || 0), 0);
    });
  }, [studyLogs]);

  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    studyLogs.forEach((log) => {
      const d = new Date(log.createdAt);
      const dayDiff = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (dayDiff > 6) return;
      map.set(log.subjectId, (map.get(log.subjectId) || 0) + (log.duration || 0));
    });

    const rows = Array.from(map.entries())
      .map(([subjectId, duration]) => {
        const subject = subjects.find((s) => s.id === subjectId);
        return {
          subjectId,
          name: subject?.name || "その他",
          color: subject?.color || "#64748b",
          duration,
        };
      })
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    return rows;
  }, [studyLogs, subjects]);

  const totalWeeklySec = weeklyDurations.reduce((sum, row) => sum + row, 0);
  const totalPreviousSec = previousWeekDurations.reduce((sum, row) => sum + row, 0);
  const growthRate = totalPreviousSec > 0 ? totalWeeklySec / totalPreviousSec : (totalWeeklySec > 0 ? 2 : 1);
  const growthPercent = Math.round((growthRate - 1) * 100);
  const streak = useMemo(() => {
    const keys = studyLogs.map((log) => keyOf(new Date(log.createdAt)));
    return calcStreak(keys);
  }, [studyLogs]);
  const comment = autoComment({ growthRate, streak, totalHours: totalWeeklySec / 3600 });

  const createWeeklySummaryImage = async (shareVariant: ShareVariant): Promise<File> => {
    const canvas = document.createElement("canvas");
    const isStory = shareVariant === "story";
    canvas.width = 1080;
    canvas.height = isStory ? 1920 : 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not available");

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.55, "#111827");
    grad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle cyber pattern
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 143) % canvas.width;
      const y = (i * 211) % canvas.height;
      ctx.strokeStyle = i % 2 === 0 ? "#38bdf8" : "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 40, y + 40, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 58px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText("StudyFlow Weekly Report", 64, 106);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "700 28px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(`${userProfile.name || userProfile.uid} / ${Math.round(totalWeeklySec / 3600)}h`, 64, 154);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 32px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(` ${streak}日連続学習中`, 64, 210);

    ctx.fillStyle = growthPercent >= 0 ? "#22c55e" : "#ef4444";
    ctx.fillText(` 先週比 ${growthPercent >= 0 ? "+" : ""}${growthPercent}%`, 360, 210);

    // Bar chart
    const chartX = 72;
    const chartY = 270;
    const chartW = isStory ? 936 : 620;
    const chartH = 350;
    const maxSec = Math.max(...weeklyDurations, 1);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(chartX, chartY, chartW, chartH);

    weeklyDurations.forEach((value, idx) => {
      const count = 7;
      const gap = 14;
      const barW = (chartW - gap * (count + 1)) / count;
      const x = chartX + gap + idx * (barW + gap);
      const h = Math.round((value / maxSec) * (chartH - 86));
      const y = chartY + chartH - h - 44;

      const bgrad = ctx.createLinearGradient(0, y, 0, chartY + chartH);
      bgrad.addColorStop(0, "#22d3ee");
      bgrad.addColorStop(1, "#6366f1");
      ctx.fillStyle = bgrad;
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "700 18px 'Roboto',sans-serif";
      ctx.fillText(`${Math.round(value / 60)}m`, x, y - 8);
      ctx.fillText(dateLabel(6 - idx), x + 8, chartY + chartH - 16);
    });

    // Subject pie
    const pieCx = isStory ? 300 : 800;
    const pieCy = isStory ? 770 : 450;
    const pieR = 120;
    const subjectTotal = Math.max(1, subjectBreakdown.reduce((s, row) => s + row.duration, 0));
    let angle = -Math.PI / 2;
    subjectBreakdown.forEach((row) => {
      const slice = (row.duration / subjectTotal) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(pieCx, pieCy);
      ctx.arc(pieCx, pieCy, pieR, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = row.color;
      ctx.fill();
      angle += slice;
    });

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(pieCx, pieCy, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 18px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText("教科別", pieCx - 30, pieCy - 4);
    ctx.fillText("内訳", pieCx - 18, pieCy + 20);

    const legendX = isStory ? 490 : 710;
    const legendY = isStory ? 680 : 330;
    subjectBreakdown.forEach((row, idx) => {
      ctx.fillStyle = row.color;
      ctx.fillRect(legendX, legendY + idx * 44, 18, 18);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 20px 'Noto Sans JP','Roboto',sans-serif";
      ctx.fillText(`${row.name} ${Math.round(row.duration / 60)}m`, legendX + 26, legendY + 16 + idx * 44);
    });

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 24px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(` ${comment}`, 72, isStory ? 980 : 680);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 20px 'Roboto',sans-serif";
    ctx.fillText("Generated by StudyFlow", 72, canvas.height - 48);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.94));
    if (!blob) throw new Error("failed to generate image");
    return new File([blob], `studyflow-weekly-${shareVariant}-${Date.now()}.png`, { type: "image/png" });
  };

  const handleDownloadWeeklyImage = async () => {
    const file = await createWeeklySummaryImage(variant);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareWeeklyImage = async () => {
    const file = await createWeeklySummaryImage(variant);
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
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          教科別内訳連続日数先週比称賛コメント入りの共有画像を生成します。
        </p>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setVariant("square")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: variant === "square" ? "var(--accent-light)" : "var(--muted-bg)", color: variant === "square" ? "var(--accent)" : "var(--muted)" }}
          >
            正方形 (SNS)
          </button>
          <button
            onClick={() => setVariant("story")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: variant === "story" ? "var(--accent-light)" : "var(--muted-bg)", color: variant === "story" ? "var(--accent)" : "var(--muted)" }}
          >
            縦長 (ストーリー)
          </button>
        </div>
        <div className="rounded-lg p-2 mb-3" style={{ background: "var(--muted-bg)" }}>
          <p className="text-xs inline-flex items-center gap-1" style={{ color: "var(--foreground)" }}>
            <Sparkles size={12} /> {comment}
          </p>
        </div>
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

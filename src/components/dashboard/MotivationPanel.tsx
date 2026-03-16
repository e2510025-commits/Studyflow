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
  const rarityOrder: Record<string, number> = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  };
  const featuredBadge = badges
    .map((id) => ({ id, meta: getAchievementMeta(id) }))
    .sort((a, b) => (rarityOrder[b.meta?.rarity || "common"] || 0) - (rarityOrder[a.meta?.rarity || "common"] || 0))[0];

  const createWeeklySummaryImage = async (shareVariant: ShareVariant): Promise<File> => {
    const canvas = document.createElement("canvas");
    const isStory = shareVariant === "story";
    canvas.width = 1080;
    canvas.height = isStory ? 1920 : 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not available");

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#020617");
    grad.addColorStop(0.55, "#082f49");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cyber grid background
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#e0f2fe";
    ctx.font = "800 54px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText("ARCHIVE REPORT", 64, 102);
    ctx.font = "700 24px 'Roboto',sans-serif";
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText("STUDYFLOW // WEEKLY INTELLIGENCE", 66, 136);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "700 28px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(`${userProfile.name || userProfile.uid} / ${Math.round(totalWeeklySec / 3600)}h`, 64, 186);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 32px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(` ${streak}日連続学習中`, 64, 238);

    ctx.fillStyle = growthPercent >= 0 ? "#22c55e" : "#ef4444";
    ctx.fillText(` 先週比 ${growthPercent >= 0 ? "+" : ""}${growthPercent}%`, 360, 238);

    // Featured rare medal (center card)
    const medalW = isStory ? 820 : 420;
    const medalX = Math.round((canvas.width - medalW) / 2);
    const medalY = isStory ? 300 : 276;
    ctx.fillStyle = "rgba(6,182,212,0.14)";
    ctx.fillRect(medalX, medalY, medalW, 186);
    ctx.strokeStyle = "rgba(103,232,249,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(medalX, medalY, medalW, 186);

    const medalTitle = featuredBadge?.meta?.title || "NO MEDAL";
    const medalRarity = featuredBadge?.meta?.rarity || "common";
    ctx.fillStyle = "#ecfeff";
    ctx.font = "800 34px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(medalTitle, medalX + 24, medalY + 72);
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "700 20px 'Roboto',sans-serif";
    ctx.fillText(`FEATURED MEDAL  //  ${medalRarity.toUpperCase()}`, medalX + 24, medalY + 112);
    ctx.fillStyle = "#bae6fd";
    ctx.font = "700 18px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(featuredBadge?.meta?.description || "称号を獲得してアーカイブを強化しよう", medalX + 24, medalY + 146);

    // Bar chart
    const chartX = 72;
    const chartY = isStory ? 540 : 500;
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
    const pieCy = isStory ? 1000 : 680;
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
    const legendY = isStory ? 920 : 560;
    subjectBreakdown.forEach((row, idx) => {
      ctx.fillStyle = row.color;
      ctx.fillRect(legendX, legendY + idx * 44, 18, 18);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 20px 'Noto Sans JP','Roboto',sans-serif";
      ctx.fillText(`${row.name} ${Math.round(row.duration / 60)}m`, legendX + 26, legendY + 16 + idx * 44);
    });

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 24px 'Noto Sans JP','Roboto',sans-serif";
    ctx.fillText(` ${comment}`, 72, isStory ? 1260 : 910);

    // Mini acquisition list
    const latestBadges = badges.slice(-4);
    ctx.fillStyle = "#7dd3fc";
    ctx.font = "700 22px 'Roboto',sans-serif";
    ctx.fillText("RECENT MEDAL LOG", 72, isStory ? 1330 : 960);
    latestBadges.forEach((id, idx) => {
      const meta = getAchievementMeta(id);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 18px 'Noto Sans JP','Roboto',sans-serif";
      ctx.fillText(`- ${meta?.title || id}`, 72, (isStory ? 1370 : 1000) + idx * 28);
    });

    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 20px 'Roboto',sans-serif";
    ctx.fillText("SYSTEM // STUDYFLOW ARCHIVE", 72, canvas.height - 72);
    ctx.fillText("Generated by StudyFlow", 72, canvas.height - 44);

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

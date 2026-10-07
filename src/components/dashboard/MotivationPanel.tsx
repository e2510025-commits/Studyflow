"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Download, Share2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatHoursMinutes } from "@/lib/utils";
import { format, startOfDay, subDays } from "date-fns";

type ShareVariant = "square" | "story";

export default function MotivationPanel() {
  const studyLogs = useStore((state) => state.studyLogs);
  const subjects = useStore((state) => state.subjects);
  const name = useStore((state) => state.userProfile.name);
  const [variant, setVariant] = useState<ShareVariant>("square");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, index) => subDays(today, 6 - index));
    const durations = days.map((day) => studyLogs.filter((log) => format(new Date(log.createdAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).reduce((sum, log) => sum + log.duration, 0));
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const previous = studyLogs.filter((log) => {
      const time = new Date(log.createdAt).getTime();
      return time >= subDays(today, 13).getTime() && time < subDays(today, 6).getTime();
    }).reduce((sum, log) => sum + log.duration, 0);
    const breakdown = subjects.map((subject) => ({
      ...subject,
      duration: studyLogs.filter((log) => log.subjectId === subject.id && new Date(log.createdAt) >= days[0]).reduce((sum, log) => sum + log.duration, 0),
    })).filter((subject) => subject.duration > 0).sort((a, b) => b.duration - a.duration).slice(0, 5);
    const logDates = new Set(studyLogs.map((log) => format(new Date(log.createdAt), "yyyy-MM-dd")));
    let streak = 0;
    const start = logDates.has(format(today, "yyyy-MM-dd")) ? today : subDays(today, 1);
    while (streak < 365 && logDates.has(format(subDays(start, streak), "yyyy-MM-dd"))) streak++;
    return { days, durations, total, breakdown, streak, change: previous > 0 ? Math.round((total - previous) / previous * 100) : null };
  }, [studyLogs, subjects]);

  const createImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = variant === "story" ? 1920 : 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を作成できませんでした。");
    ctx.fillStyle = "#f6f7fc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(48, 48, 984, canvas.height - 96);
    ctx.fillStyle = "#4f46e5";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("StudyFlow", 88, 118);
    ctx.fillStyle = "#202337";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("今週の学び", 88, 200);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${name || "あなた"} · ${format(summary.days[0], "M/d")} – ${format(summary.days[6], "M/d")}`, 88, 252, 904);
    ctx.fillStyle = "#202337";
    ctx.font = "bold 62px sans-serif";
    ctx.fillText(formatHoursMinutes(summary.total), 88, 348);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`連続学習 ${summary.streak}日${summary.change === null ? "" : `  /  先週比 ${summary.change >= 0 ? "+" : ""}${summary.change}%`}`, 88, 400);
    const chartTop = variant === "story" ? 540 : 460;
    const chartHeight = variant === "story" ? 460 : 180;
    const peak = Math.max(...summary.durations, 1);
    summary.durations.forEach((duration, index) => {
      const x = 100 + index * 128;
      const height = duration / peak * (chartHeight - 42);
      const y = chartTop + chartHeight - height;
      ctx.fillStyle = "#818cf8";
      ctx.fillRect(x, y, 80, Math.max(height, 3));
      ctx.fillStyle = "#64748b";
      ctx.font = "22px sans-serif";
      ctx.fillText(`${Math.round(duration / 60)}分`, x, y - 12);
      ctx.fillText(format(summary.days[index], "M/d"), x, chartTop + chartHeight + 38);
    });
    const legendY = chartTop + chartHeight + 110;
    summary.breakdown.forEach((subject, index) => {
      const y = legendY + index * 44;
      ctx.fillStyle = subject.color;
      ctx.fillRect(88, y - 18, 16, 16);
      ctx.font = "24px sans-serif";
      ctx.fillStyle = "#202337";
      ctx.fillText(subject.name, 120, y, 560);
      ctx.fillText(formatHoursMinutes(subject.duration), 740, y);
    });
    ctx.fillStyle = "#64748b";
    ctx.font = "24px sans-serif";
    ctx.fillText("自分のペースで、一歩ずつ。", 88, canvas.height - 94);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("画像を作成できませんでした。");
    return new File([blob], `studyflow-weekly-${variant}.png`, { type: "image/png" });
  };

  const exportImage = async (share: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const file = await createImage();
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "今週の学び · StudyFlow", files: [file] });
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setError("画像の作成・共有に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="page-heading">
        <div><h2 className="text-lg font-bold">今週の学びをシェア</h2><p>学習時間と教科別の内訳を、1枚の画像に。</p></div>
        <div className="flex gap-2" role="group" aria-label="共有画像のサイズ">
          <button type="button" className="secondary-button" onClick={() => setVariant("square")} aria-pressed={variant === "square"} style={{ color: variant === "square" ? "var(--accent)" : undefined }}>正方形</button>
          <button type="button" className="secondary-button" onClick={() => setVariant("story")} aria-pressed={variant === "story"} style={{ color: variant === "story" ? "var(--accent)" : undefined }}>縦長</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" className="primary-button" disabled={busy} onClick={() => void exportImage(true)}><Share2 size={17} aria-hidden="true" />{busy ? "画像を作成中…" : "共有する"}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void exportImage(false)}><Download size={17} aria-hidden="true" />画像を保存</button>
        <a href="/api/calendar/export" className="secondary-button"><CalendarRange size={17} aria-hidden="true" />カレンダーに出力</a>
      </div>
      {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
    </section>
  );
}

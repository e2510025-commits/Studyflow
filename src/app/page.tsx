"use client";

import Link from "next/link";
import { ArrowRight, Brain, Play, Timer, Waves } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatTime } from "@/lib/utils";
import StatsCards from "@/components/dashboard/StatsCards";
import DailyPieChart from "@/components/dashboard/DailyPieChart";
import WeeklyBarChart from "@/components/dashboard/WeeklyBarChart";
import HeatMap from "@/components/dashboard/HeatMap";
import MotivationPanel from "@/components/dashboard/MotivationPanel";
import RecentLogs from "@/components/dashboard/RecentLogs";

function ActiveTimer() {
  const timer = useStore((state) => state.timer);
  if (timer.status === "idle") return null;
  const elapsed = timer.mode === "stopwatch" ? timer.elapsed : Math.max(0, timer.countdownTotal - timer.elapsed);
  return (
    <Link href="/timer" className="active-timer-card">
      <span className="more-nav-icon"><Timer size={22} aria-hidden="true" /></span>
      <span className="flex-1"><span className="block font-semibold">{timer.status === "running" ? "学習を計測中" : "タイマーを一時停止中"}</span><span className="block text-sm text-muted">タイマーに戻って学習を続ける</span></span>
      <span className="font-mono font-bold tabular-nums">{formatTime(elapsed)}</span>
      <ArrowRight size={20} aria-hidden="true" />
    </Link>
  );
}

export default function DashboardPage() {
  const status = useStore((state) => state.timer.status);
  return (
    <div className="dashboard-page screen-page">
      <header className="page-heading screen-heading">
        <div>
          <p className="section-kicker">あなたの学習スペース</p>
          <h1>ホーム</h1>
          <p>今日の積み重ねと、次に取り組むこと。</p>
        </div>
        <Link href="/timer" className="primary-button"><Play size={17} aria-hidden="true" />{status === "idle" ? "学習を始める" : "タイマーに戻る"}</Link>
      </header>
      <ActiveTimer />
      <section aria-label="学習の概要"><StatsCards /></section>
      <div className="workspace-grid home-workspace">
        <div className="workspace-main"><WeeklyBarChart /><RecentLogs /><MotivationPanel /></div>
        <aside className="workspace-rail" aria-label="今日の学習と継続">
          <section className="rail-section" aria-label="次の学習へ"><h2>次に取り組む</h2>
            <Link href="/memorize" className="rail-link"><Brain size={21} aria-hidden="true" /><span><strong>暗記を進める</strong><small>単語帳と今日の復習</small></span><ArrowRight size={17} /></Link>
            <Link href="/timeline" className="rail-link"><Waves size={21} aria-hidden="true" /><span><strong>仲間の学びを見る</strong><small>学習記録と気づき</small></span><ArrowRight size={17} /></Link>
          </section>
          <DailyPieChart /><HeatMap />
        </aside>
      </div>
    </div>
  );
}

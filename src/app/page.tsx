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
    <div className="dashboard-page space-y-6">
      <section className="home-intro">
        <div>
          <p className="home-eyebrow">YOUR STUDY, YOUR PACE</p>
          <h1>今日も、自分のペースで。</h1>
          <p className="home-description">学びの積み重ねを確認して、次の一歩を始めよう。</p>
          <Link href="/timer" className="primary-button mt-5"><Play size={17} aria-hidden="true" />{status === "idle" ? "学習を始める" : "タイマーに戻る"}<ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="home-intro-art" aria-hidden="true"><span className="intro-orbit" /><span className="intro-orbit inner" /><span className="intro-icon"><Timer size={40} strokeWidth={1.5} /></span></div>
      </section>
      <ActiveTimer />
      <section aria-label="学習の概要"><StatsCards /></section>
      <div className="home-chart-grid"><WeeklyBarChart /><DailyPieChart /></div>
      <div className="home-detail-grid"><HeatMap /><RecentLogs /></div>
      <section className="quick-start-grid" aria-label="次の学習へ">
        <Link href="/memorize" className="quick-start-link"><span className="more-nav-icon"><Brain size={23} aria-hidden="true" /></span><span className="flex-1"><span className="block font-semibold">暗記を進める</span><span className="block text-sm text-muted">単語帳を開いて、ひとつずつ復習</span></span><ArrowRight size={20} aria-hidden="true" /></Link>
        <Link href="/timeline" className="quick-start-link"><span className="more-nav-icon"><Waves size={23} aria-hidden="true" /></span><span className="flex-1"><span className="block font-semibold">仲間の学びを見る</span><span className="block text-sm text-muted">タイムラインで学習の刺激をもらおう</span></span><ArrowRight size={20} aria-hidden="true" /></Link>
      </section>
      <MotivationPanel />
    </div>
  );
}

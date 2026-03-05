"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import {
  Target,
  Palette,
  Volume2,
  VolumeX,
  Timer,
  Check,
  Save,
} from "lucide-react";

const themeOptions = [
  { value: "white" as const, label: "ホワイト", color: "#ffffff", border: true },
  { value: "gray" as const, label: "グレー", color: "#1a1a2e" },
  { value: "dark" as const, label: "ダーク", color: "#0a0a0f" },
  { value: "custom" as const, label: "カスタム", color: "linear-gradient(135deg,#6366f1,#818cf8)" },
];

export default function PreferencesPage() {
  const {
    userProfile,
    updateDailyGoal,
    theme,
    setTheme,
    customBgColor,
    setCustomBgColor,
    soundEnabled,
    toggleSound,
    pomodoroConfig,
    setPomodoroConfig,
  } = useStore();

  const [dailyGoalMin, setDailyGoalMin] = useState(Math.floor(userProfile.dailyGoal / 60));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDailyGoalMin(Math.floor(userProfile.dailyGoal / 60));
  }, [userProfile.dailyGoal]);

  const handleSave = () => {
    updateDailyGoal(dailyGoalMin * 60);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const formatGoalLabel = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          アプリ設定
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          学習目標やタイマー、テーマなどの設定を変更できます
        </p>
      </motion.div>

      {/* Daily Goal Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <Target size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            学習目標
          </h2>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              1日の目標学習時間
            </label>
            <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>
              {formatGoalLabel(dailyGoalMin)}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={480}
            step={10}
            value={dailyGoalMin}
            onChange={(e) => setDailyGoalMin(Number(e.target.value))}
            className="w-full accent-[var(--accent)] h-2 rounded-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: "var(--muted)" }}>10分</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>8時間</span>
          </div>
        </div>
      </motion.div>

      {/* Pomodoro Settings Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <Timer size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            ポモドーロ設定
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              作業時間（分）
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={Math.floor(pomodoroConfig.workDuration / 60)}
              onChange={(e) => setPomodoroConfig({ workDuration: Number(e.target.value) * 60 })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              短い休憩（分）
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={Math.floor(pomodoroConfig.shortBreakDuration / 60)}
              onChange={(e) => setPomodoroConfig({ shortBreakDuration: Number(e.target.value) * 60 })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              長い休憩（分）
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={Math.floor(pomodoroConfig.longBreakDuration / 60)}
              onChange={(e) => setPomodoroConfig({ longBreakDuration: Number(e.target.value) * 60 })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              長い休憩までのセッション数
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={pomodoroConfig.sessionsBeforeLongBreak}
              onChange={(e) => setPomodoroConfig({ sessionsBeforeLongBreak: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Theme Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <Palette size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            テーマ
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
              style={{
                background: theme === opt.value ? "var(--accent-light)" : "var(--muted-bg)",
                border: theme === opt.value ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{
                  background: opt.color,
                  border: opt.border ? "2px solid #e5e7eb" : "none",
                  boxShadow: theme === opt.value ? "0 0 0 2px var(--accent)" : "none",
                }}
              />
              <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        {theme === "custom" && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              背景色
            </label>
            <input
              type="color"
              value={customBgColor}
              onChange={(e) => setCustomBgColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0"
            />
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              {customBgColor}
            </span>
          </div>
        )}
      </motion.div>

      {/* Sound Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                サウンド
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                タイマー完了時の通知音
              </p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className="w-14 h-8 rounded-full transition-all duration-200 relative"
            style={{
              background: soundEnabled ? "var(--accent)" : "var(--muted-bg)",
            }}
          >
            <div
              className="w-6 h-6 rounded-full bg-white absolute top-1 transition-all duration-200"
              style={{
                left: soundEnabled ? "calc(100% - 28px)" : "4px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
      </motion.div>

      {/* Save button */}
      <motion.div
        className="pb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: saved ? "#22c55e" : "var(--accent)" }}
        >
          {saved ? <Check size={20} /> : <Save size={20} />}
          {saved ? "保存しました！" : "設定を保存"}
        </button>
      </motion.div>
    </div>
  );
}

"use client";

import SettingsNavigation from "@/components/layout/SettingsNavigation";

import { useState, type ReactNode } from "react";
import { Target, Palette, Volume2, Timer } from "lucide-react";
import { useStore } from "@/store/useStore";
import ThemePicker from "@/components/layout/ThemePicker";
import { saveDailyStudyGoal } from "@/lib/firestore/profile";

function NumberSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(value);
  const number = Number(displayed);
  const valid = displayed !== "" && Number.isInteger(number) && number >= min && number <= max;
  return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span><input className="app-input w-full" type="number" inputMode="numeric" min={min} max={max} aria-invalid={!valid} value={displayed} onChange={(event) => {const next = event.target.value;setDraft(next);const parsed = Number(next);if (next && Number.isInteger(parsed) && parsed >= min && parsed <= max) onChange(parsed);}} onBlur={() => {if (valid) setDraft(null);}} /><span className={`block text-xs ${valid ? "text-muted" : "text-danger"}`}>{min}〜{max}の整数を入力してください。{!valid && "前の有効な設定が維持されています。"}</span></label>;
}
function SectionTitle({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return <h2 className="flex items-center gap-3 text-lg font-bold mb-5"><span className="more-nav-icon">{icon}</span>{children}</h2>;
}
export default function PreferencesPage() {
  const profile = useStore((state) => state.userProfile);
  const updateDailyGoal = useStore((state) => state.updateDailyGoal);
  const sound = useStore((state) => state.soundEnabled);
  const toggleSound = useStore((state) => state.toggleSound);
  const pomodoro = useStore((state) => state.pomodoroConfig);
  const setPomodoro = useStore((state) => state.setPomodoroConfig);
  const [goalDraft, setGoalDraft] = useState<{ uid: string; minutes: number } | null>(null);
  const minutes = goalDraft?.uid === profile.uid ? goalDraft.minutes : Math.floor(profile.dailyGoal / 60);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const saveGoal = async () => {
    if (saving || !profile.uid) return;
    const uid = profile.uid;setSaving(true);setFeedback("");setError("");
    try {
      await saveDailyStudyGoal(uid, minutes * 60);
      if (useStore.getState().userProfile.uid !== uid) return;
      updateDailyGoal(minutes * 60);setFeedback("学習目標を保存しました。");
    } catch {setError("目標を保存できませんでした。設定値は保持されています。再試行してください。");}
    finally {setSaving(false);}
  };
  return <div className="screen-page settings-page">
    <div className="page-heading"><div><h1>アプリ設定</h1><p>毎日の目標と、自分に合った学習環境を整えましょう。</p></div></div>
    <div className="settings-workspace"><SettingsNavigation sections={[{id:"goal",label:"学習目標"},{id:"pomodoro",label:"ポモドーロ"},{id:"appearance",label:"表示テーマ"},{id:"sound",label:"サウンド"}]} other={{href:"/settings",label:"アカウント設定を開く"}} /><div className="settings-editor">
        <section id="goal" className="settings-section"><SectionTitle icon={<Target size={22} />}>学習目標</SectionTitle><label className="block"><span className="flex flex-wrap justify-between gap-2 text-sm font-medium">1日の目標学習時間<span style={{ color: "var(--accent)" }}>{Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}時間` : ""}{minutes % 60 > 0 ? `${minutes % 60}分` : ""}</span></span><input className="w-full my-5" type="range" min={10} max={480} step={10} value={minutes} aria-label="1日の目標学習時間" aria-valuetext={`${minutes}分`} disabled={saving} onChange={(event) => {setGoalDraft({uid:profile.uid,minutes:Number(event.target.value)});setFeedback("");setError("");}} /></label><div className="flex justify-between text-xs text-muted mb-5"><span>10分</span><span>8時間</span></div><button className="primary-button" onClick={() => void saveGoal()} disabled={saving || !profile.uid || minutes < 10 || minutes > 480}>{saving ? "保存中…" : "目標を保存"}</button>{feedback && <p role="status" className="mt-3 text-sm">{feedback}</p>}{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</section>
        <section id="pomodoro" className="settings-section"><SectionTitle icon={<Timer size={22} />}>ポモドーロ</SectionTitle><p className="text-sm text-muted mb-5">有効な入力はすぐに反映され、この端末に保存されます。</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><NumberSetting label="集中時間（分）" value={Math.floor(pomodoro.workDuration / 60)} min={1} max={120} onChange={(value) => setPomodoro({workDuration:value * 60})} /><NumberSetting label="短い休憩（分）" value={Math.floor(pomodoro.shortBreakDuration / 60)} min={1} max={30} onChange={(value) => setPomodoro({shortBreakDuration:value * 60})} /><NumberSetting label="長い休憩（分）" value={Math.floor(pomodoro.longBreakDuration / 60)} min={1} max={60} onChange={(value) => setPomodoro({longBreakDuration:value * 60})} /><NumberSetting label="長い休憩までのセッション数" value={pomodoro.sessionsBeforeLongBreak} min={1} max={10} onChange={(value) => setPomodoro({sessionsBeforeLongBreak:value})} /></div><p className="text-sm text-muted mt-5" role="status">タイマーの設定に反映されます。</p></section>
<section id="appearance" className="settings-section"><SectionTitle icon={<Palette size={22} />}>表示テーマ</SectionTitle><p className="text-sm text-muted">変更はすぐに反映されます。</p><ThemePicker /></section><section id="sound" className="settings-section"><SectionTitle icon={<Volume2 size={22} />}>サウンド</SectionTitle><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted">タイマー完了時の通知音</p><button className="secondary-button" role="switch" aria-checked={sound} aria-label="タイマーの通知音" onClick={toggleSound}>{sound ? "オン" : "オフ"}</button></div></section></div></div>
  </div>;
}

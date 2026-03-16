"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { MissionConfig, MissionScope, MissionTemplate } from "@/types";
import { CheckCircle2, Coins, Gift, Layers3, Target } from "lucide-react";

const scopes: MissionScope[] = ["daily", "weekly", "season"];

const emptyConfig: MissionConfig = {
  seasonName: "Season 1",
  seasonStartAt: new Date().toISOString(),
  seasonEndAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(),
  rotationMode: {
    daily: "random",
    weekly: "random",
    season: "random",
  },
  fixedMissionIds: {},
};

type ApiResponse = {
  config: MissionConfig;
  templates: MissionTemplate[];
};

type BuilderStep = 1 | 2 | 3;

type MissionTemplateDraft = Omit<MissionTemplate, "id">;

const defaultDraft: MissionTemplateDraft = {
  scope: "daily",
  title: "",
  description: "",
  goalType: "study_seconds",
  goalValue: 1800,
  rewardPoints: 30,
  active: true,
  triggerType: "study_time",
  targetType: "daily",
  actionType: "at_least",
  subjectLabel: "",
  rewardBadge: "",
  rewardMultiplier: 1,
};

const starterTemplates: Array<{ key: string; label: string; preset: Partial<MissionTemplateDraft> }> = [
  {
    key: "daily-30",
    label: "毎日30分勉強",
    preset: {
      scope: "daily",
      title: "毎日30分集中",
      description: "毎日30分以上の学習で達成",
      triggerType: "study_time",
      targetType: "daily",
      goalType: "study_seconds",
      goalValue: 1800,
      rewardPoints: 30,
    },
  },
  {
    key: "weekly-3-sessions",
    label: "週3セッション",
    preset: {
      scope: "weekly",
      title: "ウィークリー3セッション",
      description: "今週3回以上学習する",
      triggerType: "study_sessions",
      targetType: "weekly",
      goalType: "study_sessions",
      goalValue: 3,
      rewardPoints: 80,
    },
  },
  {
    key: "season-login",
    label: "連続ログイン学習",
    preset: {
      scope: "season",
      title: "7日学習チャレンジ",
      description: "期間中7日以上学習ログを残す",
      triggerType: "login_days",
      targetType: "season_total",
      goalType: "study_sessions",
      goalValue: 7,
      rewardPoints: 120,
      rewardBadge: "7日継続",
    },
  },
];

function unitLabel(form: MissionTemplateDraft): string {
  if (form.triggerType === "study_time") return "秒";
  if (form.triggerType === "study_sessions") return "回";
  return "日";
}

function targetText(form: MissionTemplateDraft): string {
  const trigger = form.triggerType === "study_time"
    ? "学習時間"
    : form.triggerType === "study_sessions"
    ? "セッション数"
    : "学習日数";
  const windowText = form.targetType === "weekly" ? "1週間" : form.targetType === "season_total" ? "期間中" : "1日";
  return `${windowText}で${trigger} ${form.goalValue}${unitLabel(form)}以上`;
}

export default function MissionManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MissionConfig>(emptyConfig);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [editingId, setEditingId] = useState<string>("");
  const [step, setStep] = useState<BuilderStep>(1);
  const [form, setForm] = useState<MissionTemplateDraft>(defaultDraft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ApiResponse;
      setConfig(json.config || emptyConfig);
      setTemplates(json.templates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const templatesByScope = useMemo(() => {
    return {
      daily: templates.filter((t) => t.scope === "daily"),
      weekly: templates.filter((t) => t.scope === "weekly"),
      season: templates.filter((t) => t.scope === "season"),
    };
  }, [templates]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveConfig",
          seasonName: config.seasonName,
          seasonStartAt: config.seasonStartAt,
          seasonEndAt: config.seasonEndAt,
          rotationMode: config.rotationMode,
          fixedMissionIds: config.fixedMissionIds,
        }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }, [config, load]);

  const saveTemplate = useCallback(async () => {
    if (!form.title.trim()) return;

    const mappedGoalType = form.triggerType === "study_time" ? "study_seconds" : "study_sessions";

    setSaving(true);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertTemplate",
          templateId: editingId || undefined,
          ...form,
          goalType: mappedGoalType,
          actionType: "at_least",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "ミッション保存に失敗しました");
        return;
      }
      setEditingId("");
      setStep(1);
      setForm(defaultDraft);
      await load();
    } finally {
      setSaving(false);
    }
  }, [editingId, form, load]);

  const removeTemplate = useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        await fetch("/api/admin/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteTemplate", templateId: id }),
        });
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const startEdit = (template: MissionTemplate) => {
    setEditingId(template.id);
    setStep(1);
    setForm({
      scope: template.scope,
      title: template.title,
      description: template.description,
      goalType: template.goalType,
      goalValue: template.goalValue,
      rewardPoints: template.rewardPoints,
      active: template.active,
      triggerType: template.triggerType || (template.goalType === "study_sessions" ? "study_sessions" : "study_time"),
      targetType: template.targetType || (template.scope === "weekly" ? "weekly" : template.scope === "season" ? "season_total" : "daily"),
      actionType: "at_least",
      subjectLabel: template.subjectLabel || "",
      rewardBadge: template.rewardBadge || "",
      rewardMultiplier: template.rewardMultiplier || 1,
    });
  };

  const applyStarterTemplate = (key: string) => {
    const entry = starterTemplates.find((row) => row.key === key);
    if (!entry) return;
    setForm((prev) => ({ ...prev, ...entry.preset }));
    setStep(2);
  };

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>ミッション設定を読み込み中...</p>;
  }

  return (
    <section className="glass-card p-4 space-y-4">
      <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>ミッション管理</h2>

      <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--muted-bg)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>シーズン/出現設定</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            シーズン名
            <input
              value={config.seasonName}
              onChange={(e) => setConfig((prev) => ({ ...prev, seasonName: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            />
          </label>
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            シーズン開始日
            <input
              type="date"
              value={config.seasonStartAt.slice(0, 10)}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  seasonStartAt: new Date(`${e.target.value}T00:00:00`).toISOString(),
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            />
          </label>
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            シーズン終了日
            <input
              type="date"
              value={config.seasonEndAt.slice(0, 10)}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  seasonEndAt: new Date(`${e.target.value}T23:59:59`).toISOString(),
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {scopes.map((scope) => (
            <div key={scope} className="rounded-xl p-3" style={{ background: "var(--card-bg)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
                {scope === "daily" ? "デイリー" : scope === "weekly" ? "ウィークリー" : "シーズン"}
              </p>
              <select
                value={config.rotationMode[scope]}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    rotationMode: {
                      ...prev.rotationMode,
                      [scope]: e.target.value === "fixed" ? "fixed" : "random",
                    },
                  }))
                }
                className="mt-2 w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                <option value="random">ランダム出現</option>
                <option value="fixed">特定ミッション固定</option>
              </select>

              <select
                value={config.fixedMissionIds[scope] || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    fixedMissionIds: {
                      ...prev.fixedMissionIds,
                      [scope]: e.target.value,
                    },
                  }))
                }
                className="mt-2 w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                <option value="">未指定</option>
                {templatesByScope[scope].map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button
          onClick={() => void saveConfig()}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {saving ? "保存中..." : "シーズン設定を保存"}
        </button>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_1fr] gap-4">
        <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--muted-bg)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {editingId ? "ミッション編集" : "ミッション追加"}
            </h3>
            <div className="ml-auto flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s as BuilderStep)}
                  className="w-8 h-8 rounded-full text-xs font-black"
                  style={{
                    background: step === s ? "var(--accent)" : "var(--card-bg)",
                    color: step === s ? "#fff" : "var(--muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                1. 基本情報
              </p>
              <div className="flex flex-wrap gap-2">
                {starterTemplates.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => applyStarterTemplate(tpl.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={form.scope}
                  onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as MissionScope }))}
                  className="px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                >
                  <option value="daily">デイリー</option>
                  <option value="weekly">ウィークリー</option>
                  <option value="season">シーズン</option>
                </select>
                <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl" style={{ background: "var(--card-bg)", color: "var(--foreground)" }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  有効化
                </label>
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="ミッション名"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="説明"
                rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                2. 達成条件
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  トリガー
                  <select
                    value={form.triggerType}
                    onChange={(e) => {
                      const trigger = e.target.value as MissionTemplateDraft["triggerType"];
                      setForm((prev) => ({
                        ...prev,
                        triggerType: trigger,
                        goalType: trigger === "study_time" ? "study_seconds" : "study_sessions",
                      }));
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    <option value="study_time">学習時間</option>
                    <option value="study_sessions">セッション数</option>
                    <option value="login_days">ログイン日数</option>
                  </select>
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  ターゲット
                  <select
                    value={form.targetType}
                    onChange={(e) => setForm((prev) => ({ ...prev, targetType: e.target.value as MissionTemplateDraft["targetType"] }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    <option value="daily">1日あたり</option>
                    <option value="weekly">1週間あたり</option>
                    <option value="season_total">期間中累計</option>
                  </select>
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  アクション
                  <select
                    value="at_least"
                    disabled
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    <option value="at_least">以上</option>
                  </select>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  条件値
                  <input
                    type="number"
                    min={1}
                    value={form.goalValue}
                    onChange={(e) => setForm((prev) => ({ ...prev, goalValue: Math.max(1, Number(e.target.value || 1)) }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  特定教科（任意）
                  <input
                    value={form.subjectLabel || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, subjectLabel: e.target.value }))}
                    placeholder="例: 数学"
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                3. 報酬
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  ポイント
                  <input
                    type="number"
                    min={1}
                    value={form.rewardPoints}
                    onChange={(e) => setForm((prev) => ({ ...prev, rewardPoints: Math.max(1, Number(e.target.value || 1)) }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  限定バッジ
                  <input
                    value={form.rewardBadge || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, rewardBadge: e.target.value }))}
                    placeholder="例: 数学マスター"
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  スコア倍率
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    max={3}
                    value={form.rewardMultiplier || 1}
                    onChange={(e) => setForm((prev) => ({ ...prev, rewardMultiplier: Math.max(1, Math.min(3, Number(e.target.value || 1))) }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void saveTemplate()}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {editingId ? "更新" : "追加"}
                </button>
                {editingId && (
                  <button
                    onClick={() => {
                      setEditingId("");
                      setForm(defaultDraft);
                      setStep(1);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-xl p-3 h-fit sticky top-6" style={{ background: "var(--muted-bg)" }}>
          <p className="text-xs font-black tracking-[0.15em] mb-2" style={{ color: "var(--muted)" }}>
            LIVE PREVIEW
          </p>
          <div className="rounded-2xl p-4 border" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>
                  {form.scope === "daily" ? "デイリー" : form.scope === "weekly" ? "ウィークリー" : "シーズン"}
                </p>
                <h4 className="text-sm font-black mt-1" style={{ color: "var(--foreground)" }}>
                  {form.title || "ミッション名"}
                </h4>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {form.description || "ここに説明文が表示されます"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>報酬</p>
                <p className="text-base font-black" style={{ color: "var(--accent)" }}>{form.rewardPoints}pt</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
              <p className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                <Target size={12} /> 条件
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {targetText(form)}
                {form.subjectLabel ? ` / 教科: ${form.subjectLabel}` : ""}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg p-2" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}>
                <p className="inline-flex items-center gap-1"><Coins size={11} /> ポイント</p>
                <p className="font-bold">+{form.rewardPoints}</p>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}>
                <p className="inline-flex items-center gap-1"><Layers3 size={11} /> 倍率</p>
                <p className="font-bold">x{(form.rewardMultiplier || 1).toFixed(1)}</p>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}>
                <p className="inline-flex items-center gap-1"><Gift size={11} /> バッジ</p>
                <p className="font-bold truncate">{form.rewardBadge || "なし"}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] inline-flex items-center gap-1" style={{ color: form.active ? "#16a34a" : "#ef4444" }}>
                <CheckCircle2 size={12} /> {form.active ? "公開中" : "無効"}
              </span>
              <button className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#facc15", color: "#5b3f00" }}>
                受け取る
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => void saveTemplate()}
          disabled={saving || !form.title.trim()}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "保存中..." : editingId ? "この内容で更新" : "この内容で追加"}
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t.title}</p>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                {t.scope}
              </span>
              {!t.active && <span className="text-[10px]" style={{ color: "#ef4444" }}>無効</span>}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t.description}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              条件: {t.triggerType === "login_days" ? "ログイン日数" : t.goalType === "study_sessions" ? "セッション" : "学習時間"} {t.goalValue}
              {t.triggerType === "study_time" ? "秒" : t.triggerType === "login_days" ? "日" : "回"}
              / 報酬: {t.rewardPoints} pt
              {t.rewardBadge ? ` / バッジ: ${t.rewardBadge}` : ""}
              {t.rewardMultiplier && t.rewardMultiplier > 1 ? ` / x${t.rewardMultiplier.toFixed(1)}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => startEdit(t)}
                className="px-3 py-1.5 rounded text-xs"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                編集
              </button>
              <button
                onClick={() => void removeTemplate(t.id)}
                className="px-3 py-1.5 rounded text-xs"
                style={{ background: "#ef444420", color: "#ef4444" }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

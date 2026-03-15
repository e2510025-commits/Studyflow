"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { MissionConfig, MissionScope, MissionTemplate } from "@/types";

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

export default function MissionManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MissionConfig>(emptyConfig);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [editingId, setEditingId] = useState<string>("");
  const [form, setForm] = useState<Omit<MissionTemplate, "id">>({
    scope: "daily",
    title: "",
    description: "",
    goalType: "study_seconds",
    goalValue: 3600,
    rewardPoints: 30,
    active: true,
  });

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
    setSaving(true);
    try {
      await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertTemplate",
          templateId: editingId || undefined,
          ...form,
        }),
      });
      setEditingId("");
      setForm({
        scope: "daily",
        title: "",
        description: "",
        goalType: "study_seconds",
        goalValue: 3600,
        rewardPoints: 30,
        active: true,
      });
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
    setForm({
      scope: template.scope,
      title: template.title,
      description: template.description,
      goalType: template.goalType,
      goalValue: template.goalValue,
      rewardPoints: template.rewardPoints,
      active: template.active,
    });
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
          {saving ? "保存中..." : "ミッション設定を保存"}
        </button>
      </div>

      <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--muted-bg)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          {editingId ? "ミッション編集" : "ミッション追加"}
        </h3>
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
          <select
            value={form.goalType}
            onChange={(e) => setForm((prev) => ({ ...prev, goalType: e.target.value as "study_seconds" | "study_sessions" }))}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
          >
            <option value="study_seconds">学習秒数</option>
            <option value="study_sessions">セッション数</option>
          </select>
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

        <div className="grid sm:grid-cols-3 gap-3">
          <input
            type="number"
            min={1}
            value={form.goalValue}
            onChange={(e) => setForm((prev) => ({ ...prev, goalValue: Number(e.target.value || 1) }))}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            placeholder="目標値"
          />
          <input
            type="number"
            min={1}
            value={form.rewardPoints}
            onChange={(e) => setForm((prev) => ({ ...prev, rewardPoints: Number(e.target.value || 1) }))}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            placeholder="報酬ポイント"
          />
          <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl" style={{ background: "var(--card-bg)", color: "var(--foreground)" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            有効化
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
                setForm({
                  scope: "daily",
                  title: "",
                  description: "",
                  goalType: "study_seconds",
                  goalValue: 3600,
                  rewardPoints: 30,
                  active: true,
                });
              }}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            >
              キャンセル
            </button>
          )}
        </div>
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
              目標: {t.goalType === "study_sessions" ? `${t.goalValue} セッション` : `${t.goalValue} 秒`} / 報酬: {t.rewardPoints} pt
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

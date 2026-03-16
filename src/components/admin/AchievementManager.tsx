"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AchievementCategory,
  AchievementRarity,
  AchievementTemplate,
  AchievementTriggerType,
} from "@/types";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";

interface ApiResponse {
  categories: AchievementCategory[];
  achievements: AchievementTemplate[];
}

const rarityOptions: AchievementRarity[] = ["common", "rare", "epic", "legendary"];
const symbolOptions = ["flame", "book", "trophy", "crown", "star", "sword", "shield", "brain"];
const triggerOptions: Array<{ value: AchievementTriggerType; label: string; unit: string }> = [
  { value: "total_study_hours", label: "総学習時間", unit: "時間" },
  { value: "streak_days", label: "連続学習日数", unit: "日" },
  { value: "subject_study_hours", label: "特定科目学習時間", unit: "時間" },
  { value: "study_sessions", label: "学習セッション数", unit: "回" },
  { value: "focus_sessions", label: "集中ボーナス回数", unit: "回" },
  { value: "special_date", label: "特定日達成", unit: "回" },
];

const defaultCategories: AchievementCategory[] = [
  { id: "total", label: "総学習時間", order: 0 },
  { id: "streak", label: "継続記録", order: 1 },
  { id: "subject", label: "特定科目", order: 2 },
  { id: "special", label: "特殊任務", order: 3 },
];

const defaultDraft: AchievementTemplate = {
  id: "",
  title: "",
  description: "",
  category: "total",
  rarity: "rare",
  secret: false,
  isNew: true,
  active: true,
  iconBase: "hex",
  iconColor: "#22d3ee",
  iconSymbol: "trophy",
  triggerType: "total_study_hours",
  triggerValue: 10,
  subjectLabel: "",
};

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function triggerLabel(triggerType: AchievementTriggerType): string {
  return triggerOptions.find((row) => row.value === triggerType)?.label || triggerType;
}

export default function MissionManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<AchievementCategory[]>(defaultCategories);
  const [achievements, setAchievements] = useState<AchievementTemplate[]>([]);

  const [categoryInput, setCategoryInput] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<AchievementTemplate>(defaultDraft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/achievements", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ApiResponse;
      const sortedCategories = (json.categories || defaultCategories)
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((row, idx) => ({ ...row, order: idx }));
      setCategories(sortedCategories);
      setAchievements(json.achievements || []);
      if (sortedCategories.length > 0) {
        setDraft((prev) => ({ ...prev, category: prev.category || sortedCategories[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((row) => map.set(row.id, row.label));
    return map;
  }, [categories]);

  const sortedAchievements = useMemo(() => {
    const orderMap = new Map<string, number>();
    categories.forEach((row) => orderMap.set(row.id, row.order));
    return [...achievements].sort((a, b) => {
      const categoryDiff = (orderMap.get(a.category) ?? 999) - (orderMap.get(b.category) ?? 999);
      if (categoryDiff !== 0) return categoryDiff;
      return a.title.localeCompare(b.title, "ja");
    });
  }, [achievements, categories]);

  const saveCategories = useCallback(async (next: AchievementCategory[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveCategories", categories: next }),
      });
      if (!res.ok) {
        alert("カテゴリー保存に失敗しました");
        return false;
      }
      setCategories(next);
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const addCategory = async () => {
    const label = categoryInput.trim();
    if (!label) return;
    const id = toId(label) || `category_${categories.length + 1}`;
    if (categories.some((row) => row.id === id)) {
      alert("同じカテゴリIDが既にあります。別名で追加してください。");
      return;
    }
    const next = [...categories, { id, label: label.slice(0, 24), order: categories.length }];
    const ok = await saveCategories(next);
    if (ok) {
      setCategoryInput("");
      setDraft((prev) => ({ ...prev, category: prev.category || id }));
    }
  };

  const renameCategory = async (id: string, label: string) => {
    const next = categories.map((row) => (row.id === id ? { ...row, label: label.slice(0, 24) } : row));
    await saveCategories(next);
  };

  const moveCategory = async (id: string, direction: -1 | 1) => {
    const idx = categories.findIndex((row) => row.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    const normalized = next.map((row, i) => ({ ...row, order: i }));
    await saveCategories(normalized);
  };

  const resetDraft = () => {
    setEditingId("");
    setDraft({ ...defaultDraft, category: categories[0]?.id || "total" });
  };

  const editAchievement = (row: AchievementTemplate) => {
    setEditingId(row.id);
    setDraft({ ...row });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAchievement = async () => {
    const title = draft.title.trim();
    if (!title) return;

    const payload: AchievementTemplate = {
      ...draft,
      id: editingId || toId(title) || `achievement_${Date.now()}`,
      title: title.slice(0, 60),
      description: draft.description.trim().slice(0, 180),
      category: draft.category || categories[0]?.id || "total",
      triggerValue: Math.max(1, Math.floor(Number(draft.triggerValue || 1))),
      subjectLabel: (draft.subjectLabel || "").trim().slice(0, 40),
      iconBase: "hex",
      iconColor: draft.iconColor || "#22d3ee",
      iconSymbol: draft.iconSymbol || "trophy",
      active: draft.active !== false,
      isNew: Boolean(draft.isNew),
      secret: Boolean(draft.secret),
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsertAchievement", achievement: payload }),
      });
      if (!res.ok) {
        alert("勲章保存に失敗しました");
        return;
      }
      await load();
      resetDraft();
    } finally {
      setSaving(false);
    }
  };

  const removeAchievement = async (id: string) => {
    if (!confirm("この勲章を削除しますか？")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAchievement", achievementId: id }),
      });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      await load();
      if (editingId === id) resetDraft();
    } finally {
      setSaving(false);
    }
  };

  const toggleNewFlag = async (row: AchievementTemplate) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleNew", achievementId: row.id, isNew: !row.isNew }),
      });
      if (!res.ok) {
        alert("NEW切り替えに失敗しました");
        return;
      }
      setAchievements((prev) => prev.map((it) => (it.id === row.id ? { ...it, isNew: !it.isNew } : it)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>勲章設定を読み込み中...</p>;
  }

  return (
    <section className="glass-card p-4 space-y-4">
      <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
        勲章管理
      </h2>

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-4">
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>
              勲章カテゴリー管理
            </p>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="例: 総学習時間"
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
              <button
                onClick={() => void addCategory()}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white inline-flex items-center gap-1"
                style={{ background: "var(--accent)" }}
              >
                <Plus size={14} /> 追加
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((row) => (
                <div key={row.id} className="rounded-lg p-2" style={{ background: "var(--card-bg)" }}>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={row.label}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (!next || next === row.label) return;
                        void renameCategory(row.id, next);
                      }}
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => void moveCategory(row.id, -1)}
                      className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
                      title="上へ"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => void moveCategory(row.id, 1)}
                      className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
                      title="下へ"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                    ID: {row.id}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>
              達成条件（トリガー）
            </p>
            <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
              <label className="text-xs" style={{ color: "var(--muted)" }}>
                条件種別
                <select
                  value={draft.triggerType}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, triggerType: e.target.value as AchievementTriggerType }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                >
                  {triggerOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs" style={{ color: "var(--muted)" }}>
                数値
                <input
                  type="number"
                  min={1}
                  value={draft.triggerValue}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      triggerValue: Math.max(1, Number(e.target.value || 1)),
                    }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                />
              </label>
              <div className="pb-2 text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {triggerOptions.find((row) => row.value === draft.triggerType)?.unit || "回"}
              </div>
            </div>
            {draft.triggerType === "subject_study_hours" && (
              <label className="text-xs block mt-2" style={{ color: "var(--muted)" }}>
                対象科目ラベル
                <input
                  value={draft.subjectLabel || ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subjectLabel: e.target.value }))}
                  placeholder="例: 数学"
                  className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {editingId ? "勲章を編集" : "新規勲章を追加"}
              </p>
              {editingId && (
                <button
                  onClick={resetDraft}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                >
                  新規作成に戻す
                </button>
              )}
            </div>

            <div className="space-y-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="タイトル 例: 不落の要塞"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="フレーバーテキスト"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />

              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  カテゴリー
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    {categories.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  レアリティ
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft((prev) => ({ ...prev, rarity: e.target.value as AchievementRarity }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    {rarityOptions.map((rarity) => (
                      <option key={rarity} value={rarity}>
                        {rarity}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 items-end">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  アイコンベース
                  <select
                    value={draft.iconBase || "hex"}
                    onChange={(e) => setDraft((prev) => ({ ...prev, iconBase: e.target.value as "hex" }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    <option value="hex">六角形</option>
                  </select>
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  色
                  <input
                    type="color"
                    value={draft.iconColor || "#22d3ee"}
                    onChange={(e) => setDraft((prev) => ({ ...prev, iconColor: e.target.value }))}
                    className="mt-1 w-full h-10 rounded-lg"
                    style={{ background: "var(--card-bg)" }}
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  シンボル
                  <select
                    value={draft.iconSymbol || "trophy"}
                    onChange={(e) => setDraft((prev) => ({ ...prev, iconSymbol: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                  >
                    {symbolOptions.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.secret)}
                    onChange={(e) => setDraft((prev) => ({ ...prev, secret: e.target.checked }))}
                  />
                  シークレット
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.isNew)}
                    onChange={(e) => setDraft((prev) => ({ ...prev, isNew: e.target.checked }))}
                  />
                  NEW表示
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.active !== false}
                    onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  有効
                </label>
              </div>

              <button
                onClick={() => void saveAchievement()}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {saving ? "保存中..." : editingId ? "この内容で更新" : "この内容で追加"}
              </button>
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>
              既存勲章の一覧・編集
            </p>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {sortedAchievements.map((row) => (
                <div key={row.id} className="rounded-lg p-3" style={{ background: "var(--card-bg)" }}>
                  <div className="flex items-start gap-2">
                    <div
                      className="w-11 h-11 flex items-center justify-center text-[10px] font-black"
                      style={{
                        clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
                        background: row.iconColor || "#22d3ee",
                        color: "#082f49",
                      }}
                    >
                      {String(row.iconSymbol || "trophy").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                        {row.title}
                        {row.isNew ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#ef444422", color: "#ef4444" }}>
                            NEW
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        {categoryMap.get(row.category) || row.category} / {row.rarity} / {triggerLabel(row.triggerType)} {row.triggerValue}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {row.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => editAchievement(row)}
                      className="px-2 py-1 rounded text-xs font-semibold"
                      style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => void toggleNewFlag(row)}
                      className="px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1"
                      style={{ background: "#22d3ee22", color: "#0891b2" }}
                    >
                      <Sparkles size={11} />
                      {row.isNew ? "NEW解除" : "NEW表示"}
                    </button>
                    <button
                      onClick={() => void removeAchievement(row.id)}
                      className="px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1"
                      style={{ background: "#ef444422", color: "#ef4444" }}
                    >
                      <Trash2 size={11} /> 削除
                    </button>
                  </div>
                </div>
              ))}
              {sortedAchievements.length === 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  勲章がまだ作成されていません
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

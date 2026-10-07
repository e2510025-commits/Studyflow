"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { SubjectIcon } from "@/components/timer/SubjectSelector";
import {
  SUBJECT_ICONS,
  SUBJECT_COLORS,
  SUBJECT_SUGGESTION_MASTER,
  formatHoursMinutes,
} from "@/lib/utils";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { fetchSubjectCatalog, upsertSubjectCatalog } from "@/lib/firestore/subjects";
import {
  addUserSubject,
  deleteUserSubject,
  updateUserSubject,
} from "@/lib/firestore/userSubjects";
import type { Subject } from "@/types";

export default function SubjectManager() {
  const subjects = useStore((state) => state.subjects);
  const userProfile = useStore((state) => state.userProfile);
  const studyLogs = useStore((state) => state.studyLogs);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [icon, setIcon] = useState(SUBJECT_ICONS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const normalizedInput = name.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalizedInput) return [];

    const fromMaster = SUBJECT_SUGGESTION_MASTER.filter((item) =>
      item.aliases.some((alias) => alias.toLowerCase().includes(normalizedInput))
    ).map((item) => item.label);

    const fromCatalog = catalogNames.filter((candidate) => {
      const normalizedCandidate = candidate.trim().toLowerCase();
      return (
        normalizedCandidate.includes(normalizedInput)
      );
    });

    const fromLocal = subjects
      .map((s) => s.name)
      .filter((candidate) => {
        const normalizedCandidate = candidate.trim().toLowerCase();
        return (
          normalizedCandidate.includes(normalizedInput)
        );
      });

    return Array.from(new Set([...fromMaster, ...fromCatalog, ...fromLocal])).slice(0, 10);
  }, [catalogNames, normalizedInput, subjects]);

  const subjectStatsMap = useMemo(() => {
    const totals = new Map<string, number>();
    subjects.forEach((subject) => {
      totals.set(subject.id, 0);
    });
    studyLogs.forEach((log) => {
      if (!totals.has(log.subjectId)) return;
      totals.set(log.subjectId, (totals.get(log.subjectId) || 0) + Math.max(0, Number(log.duration || 0)));
    });

    const ranked = subjects
      .map((subject) => ({
        subjectId: subject.id,
        totalSeconds: totals.get(subject.id) || 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    const rankMap = new Map<string, number>();
    ranked.forEach((row, index) => {
      rankMap.set(row.subjectId, index + 1);
    });

    return { totals, rankMap };
  }, [studyLogs, subjects]);

  useEffect(() => {
    let cancelled = false;
    void fetchSubjectCatalog()
      .then((names) => {
        if (!cancelled) {
          setCatalogNames(names);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    if (busy) return;
    setFormError("");
    setName("");
    setColor(SUBJECT_COLORS[0]);
    setIcon(SUBJECT_ICONS[0]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (subject: Subject) => {
    setFormError("");
    setName(subject.name);
    setColor(subject.color);
    setIcon(subject.icon);
    setEditingId(subject.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !userProfile.uid || busy) return;
    const trimmedName = name.trim();
    setBusy(true); setFormError("");
    try {
      if (editingId) await updateUserSubject(editingId, { name: trimmedName, color, icon });
      else await addUserSubject(userProfile.uid, { name: trimmedName, color, icon });
      void upsertSubjectCatalog(trimmedName).catch(() => {});
      setCatalogNames((prev) => prev.includes(trimmedName) ? prev : [trimmedName, ...prev]);
      setName(""); setEditingId(null); setShowForm(false);
    } catch { setFormError("教科を保存できませんでした。入力は保持されています。再試行してください。"); }
    finally { setBusy(false); }
  };
  const handleDelete = (id: string) => { setDeleteError(""); setDeleteConfirm(id); };
  const confirmDelete = async () => {
    if (!deleteConfirm || busy) return;
    setBusy(true); setDeleteError("");
    try { await deleteUserSubject(deleteConfirm); setDeleteConfirm(null); }
    catch { setDeleteError("教科を削除できませんでした。再試行してください。"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            教科管理
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            学習する教科を追加・編集できます
          </p>
        </div>
        {!showForm && (
          <motion.button
            onClick={() => { setFormError(""); setShowForm(true); }}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Plus size={18} />
            追加
          </motion.button>
        )}
      </div>

      {/* Add/Edit Form */}
      <Dialog open={showForm} onClose={resetForm} title={editingId ? "教科を編集" : "新しい教科を追加"}>
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
                {/* Name input */}
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    教科名
                  </label>
                  <input
                    aria-label="教科名"
                    required
                    maxLength={80}
                    disabled={busy}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：数学、英語..."
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--foreground)",
                      border: `2px solid ${color}40`,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = color;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = `${color}40`;
                    }}
                  />

                  {name.trim() && (
                    <div className="mt-2 space-y-1">
                      {suggestions.map((candidate) => (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => setName(candidate)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{
                            background: "var(--muted-bg)",
                            color: "var(--foreground)",
                          }}
                        >
                          {candidate}
                        </button>
                      ))}

                      {suggestions.length === 0 && (
                        <p className="px-1 text-xs" style={{ color: "var(--muted)" }}>
                          一致候補がないため、このまま新しい教科として追加できます
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Color picker */}
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    テーマカラー
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={busy}
                        aria-label={`教科カラー ${c}`}
                        aria-pressed={color === c}
                        onClick={() => setColor(c)}
                        className="w-11 h-11 rounded-full transition-all"
                        style={{
                          background: c,
                          border:
                            color === c
                              ? "3px solid var(--foreground)"
                              : "3px solid transparent",
                          transform: color === c ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    アイコン
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        disabled={busy}
                        aria-label={`教科アイコン ${ic}`}
                        aria-pressed={icon === ic}
                        onClick={() => setIcon(ic)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                        style={{
                          background:
                            icon === ic ? `${color}20` : "var(--muted-bg)",
                          color: icon === ic ? color : "var(--muted)",
                          border:
                            icon === ic
                              ? `2px solid ${color}`
                              : "2px solid transparent",
                        }}
                      >
                        <SubjectIcon iconName={ic} size={18} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview & Save */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${color}20`, color }}
                    >
                      <SubjectIcon iconName={icon} size={20} />
                    </div>
                    <span
                      className="font-medium break-words"
                      style={{ color: "var(--foreground)" }}
                    >
                      {name || "プレビュー"}
                    </span>
                  </div>
                  <motion.button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: color }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check size={16} />
                    {busy ? "保存中…" : editingId ? "更新" : "追加"}
                  </motion.button>
                </div>
          {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        </form>
      </Dialog>
      <Dialog open={Boolean(deleteConfirm)} onClose={() => { if (!busy) setDeleteConfirm(null); }} title="教科を削除">
        <div className="space-y-4"><p>「{subjects.find((subject) => subject.id === deleteConfirm)?.name}」を教科一覧から削除します。過去の学習記録は保持されます。</p>
          {deleteError && <p role="alert" className="text-sm text-danger">{deleteError}</p>}
          <div className="flex flex-wrap gap-2"><button className="secondary-button" disabled={busy} onClick={() => setDeleteConfirm(null)}>キャンセル</button><button className="primary-button" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "削除中…" : "削除する"}</button></div>
        </div>
      </Dialog>

      {/* Subject list */}
      {subjects.length === 0 ? (
        <EmptyState
          title="教科がまだありません"
          description="「追加」ボタンから学習する教科を登録しましょう"
        />
      ) : (
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {subjects.map((subject, index) => {
              const totalSeconds = subjectStatsMap.totals.get(subject.id) || 0;
              const rank = subjectStatsMap.rankMap.get(subject.id) || subjects.length;
              return (
              <motion.div
                key={subject.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card-flat flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-4"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${subject.color}20`,
                    color: subject.color,
                  }}
                >
                  <SubjectIcon iconName={subject.icon} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className="font-semibold truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {subject.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: subject.color }}
                    />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {subject.color}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                      title="この教科の累計学習時間"
                    >
                      合計 {formatHoursMinutes(totalSeconds)}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: `${subject.color}20`, color: subject.color }}
                      title="あなたの教科内ランキング"
                    >
                      教科内順位 #{rank}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    aria-label={`${subject.name}を編集`}
                    onClick={() => handleEdit(subject)}
                    className="icon-button"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--muted)",
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    disabled={busy}
                    aria-label={`${subject.name}を削除`}
                    onClick={() => handleDelete(subject.id)}
                    className="icon-button"
                    style={{
                      background:
                        deleteConfirm === subject.id
                          ? "var(--danger)"
                          : "var(--muted-bg)",
                      color:
                        deleteConfirm === subject.id
                          ? "#fff"
                          : "var(--danger)",
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

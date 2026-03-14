"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { SubjectIcon } from "@/components/timer/SubjectSelector";
import { SUBJECT_ICONS, SUBJECT_COLORS } from "@/lib/utils";
import GlassCard from "@/components/ui/GlassCard";
import EmptyState from "@/components/ui/EmptyState";
import { fetchSubjectCatalog, upsertSubjectCatalog } from "@/lib/firestore/subjects";
import {
  addUserSubject,
  deleteUserSubject,
  updateUserSubject,
} from "@/lib/firestore/userSubjects";
import type { Subject } from "@/types";

export default function SubjectManager() {
  const { subjects, userProfile } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [icon, setIcon] = useState(SUBJECT_ICONS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);

  const normalizedInput = name.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalizedInput) return [];

    const fromCatalog = catalogNames.filter((candidate) => {
      const normalizedCandidate = candidate.trim().toLowerCase();
      return (
        normalizedCandidate.includes(normalizedInput) &&
        normalizedCandidate !== normalizedInput
      );
    });

    const fromLocal = subjects
      .map((s) => s.name)
      .filter((candidate) => {
        const normalizedCandidate = candidate.trim().toLowerCase();
        return (
          normalizedCandidate.includes(normalizedInput) &&
          normalizedCandidate !== normalizedInput
        );
      });

    return Array.from(new Set([...fromCatalog, ...fromLocal])).slice(0, 8);
  }, [catalogNames, normalizedInput, subjects]);

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
    setName("");
    setColor(SUBJECT_COLORS[0]);
    setIcon(SUBJECT_ICONS[0]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (subject: Subject) => {
    setName(subject.name);
    setColor(subject.color);
    setIcon(subject.icon);
    setEditingId(subject.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim() || !userProfile.uid) return;
    const trimmedName = name.trim();
    if (editingId) {
      void updateUserSubject(editingId, {
        name: trimmedName,
        color,
        icon,
      }).catch(() => {});
    } else {
      void addUserSubject(userProfile.uid, {
        name: trimmedName,
        color,
        icon,
      }).catch(() => {});
    }

    void upsertSubjectCatalog(trimmedName).catch(() => {});
    setCatalogNames((prev) =>
      prev.includes(trimmedName) ? prev : [trimmedName, ...prev]
    );
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      void deleteUserSubject(id).catch(() => {});
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            教科管理
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            学習する教科を追加・編集できます
          </p>
        </div>
        {!showForm && (
          <motion.button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Plus size={18} />
            追加
          </motion.button>
        )}
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassCard hover={false}>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {editingId ? "教科を編集" : "新しい教科を追加"}
                  </h3>
                  <button onClick={resetForm} style={{ color: "var(--muted)" }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Name input */}
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    教科名
                  </label>
                  <input
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
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setName(candidate);
                          }}
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
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full transition-all"
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
                        onClick={() => setIcon(ic)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
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
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${color}20`, color }}
                    >
                      <SubjectIcon iconName={icon} size={20} />
                    </div>
                    <span
                      className="font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {name || "プレビュー"}
                    </span>
                  </div>
                  <motion.button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: color }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check size={16} />
                    {editingId ? "更新" : "追加"}
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject list */}
      {subjects.length === 0 ? (
        <EmptyState
          title="教科がまだありません"
          description="「追加」ボタンから学習する教科を登録しましょう"
        />
      ) : (
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {subjects.map((subject, index) => (
              <motion.div
                key={subject.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card-flat flex items-center gap-4 px-5 py-4"
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
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(subject)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--muted)",
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
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
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, FileText, Star } from "lucide-react";

interface MemoDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (memo: string, focusRating?: number) => void;
  duration: number;
  subjectName: string;
  subjectColor: string;
}

export default function MemoDialog({
  open,
  onClose,
  onSave,
  duration,
  subjectName,
  subjectColor,
}: MemoDialogProps) {
  const [memo, setMemo] = useState("");
  const [focusRating, setFocusRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}時間${m}分${sec}秒`;
    if (m > 0) return `${m}分${sec}秒`;
    return `${sec}秒`;
  };

  const handleSave = () => {
    onSave(memo, focusRating > 0 ? focusRating : undefined);
    setMemo("");
    setFocusRating(0);
  };

  const handleClose = () => {
    onClose();
    setMemo("");
    setFocusRating(0);
  };

  const ratingLabels = ["", "低い", "やや低い", "普通", "高い", "最高"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <motion.div
            className="relative glass-card p-8 w-full max-w-md z-10"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
              style={{ color: "var(--muted)" }}
            >
              <X size={20} />
            </button>

            {/* Success indicator */}
            <div className="flex flex-col items-center mb-6">
              <motion.div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: `${subjectColor}20`,
                  color: subjectColor,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <FileText size={28} />
              </motion.div>
              <h2
                className="text-2xl font-black mb-1"
                style={{ color: "var(--foreground)" }}
              >
                お疲れ様です！
              </h2>
              <p className="text-base" style={{ color: "var(--muted)" }}>
                <span style={{ color: subjectColor, fontWeight: 700 }}>
                  {subjectName}
                </span>{" "}
                を{formatDuration(duration)}学習しました
              </p>
            </div>

            {/* Focus rating */}
            <div className="mb-5">
              <label
                className="block text-sm font-semibold mb-3"
                style={{ color: "var(--foreground)" }}
              >
                集中度
                {focusRating > 0 && (
                  <span
                    className="ml-2 text-xs font-medium"
                    style={{ color: subjectColor }}
                  >
                    {ratingLabels[focusRating]}
                  </span>
                )}
              </label>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    onClick={() =>
                      setFocusRating(focusRating === star ? 0 : star)
                    }
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1"
                  >
                    <Star
                      size={28}
                      fill={
                        star <= (hoverRating || focusRating)
                          ? subjectColor
                          : "transparent"
                      }
                      stroke={
                        star <= (hoverRating || focusRating)
                          ? subjectColor
                          : "var(--muted)"
                      }
                      strokeWidth={2}
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Memo input */}
            <div className="mb-6">
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                学習メモ（任意）
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例：青チャート p10-15、二次関数の応用問題"
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--foreground)",
                  border: "1px solid var(--card-border)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = subjectColor;
                  e.target.style.boxShadow = `0 0 0 2px ${subjectColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--card-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--muted)",
                }}
              >
                スキップ
              </button>
              <motion.button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: subjectColor }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save size={16} />
                保存する
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

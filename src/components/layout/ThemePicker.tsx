"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Paintbrush, Check, X } from "lucide-react";

const PRESET_THEMES = [
  {
    key: "white" as const,
    label: "ホワイト",
    preview: "#ffffff",
    border: "#e2e8f0",
  },
  {
    key: "gray" as const,
    label: "グレー",
    preview: "#f1f5f9",
    border: "#cbd5e1",
  },
  {
    key: "dark" as const,
    label: "ダーク",
    preview: "#0f172a",
    border: "#334155",
  },
];

const CUSTOM_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#84cc16", // Lime
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#1e293b", // Slate dark
  "#6b7280", // Gray
  "#0ea5e9", // Sky
  "#14b8a6", // Teal
  "#d946ef", // Fuchsia
];

export default function ThemePicker() {
  const { theme, customBgColor, setTheme, setCustomBgColor } = useStore();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [tempColor, setTempColor] = useState(customBgColor);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handlePresetSelect = (key: "white" | "gray" | "dark") => {
    setTheme(key);
    setOpen(false);
    setShowCustom(false);
  };

  const handleCustomConfirm = () => {
    setCustomBgColor(tempColor);
    setTheme("custom");
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <div ref={panelRef} className="fixed bottom-5 left-5 z-[60]">
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: theme === "custom" ? customBgColor : "var(--accent)",
          color: "#fff",
          border: "2px solid rgba(255,255,255,0.2)",
        }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
        aria-label="テーマ変更"
      >
        <Paintbrush size={20} />
      </motion.button>

      {/* Picker panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-16 left-0 glass-card p-4 w-64"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h4
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {showCustom ? "カスタムカラー" : "背景テーマ"}
              </h4>
              {showCustom && (
                <button
                  onClick={() => setShowCustom(false)}
                  style={{ color: "var(--muted)" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {!showCustom ? (
              <>
                {/* Preset themes */}
                <div className="space-y-2 mb-3">
                  {PRESET_THEMES.map((preset) => {
                    const isActive = theme === preset.key;
                    return (
                      <motion.button
                        key={preset.key}
                        onClick={() => handlePresetSelect(preset.key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                        style={{
                          background: isActive
                            ? "var(--accent-light)"
                            : "var(--muted-bg)",
                          border: isActive
                            ? "1.5px solid var(--accent)"
                            : "1.5px solid transparent",
                        }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg shrink-0"
                          style={{
                            background: preset.preview,
                            border: `1.5px solid ${preset.border}`,
                          }}
                        />
                        <span
                          className="text-sm font-medium flex-1 text-left"
                          style={{
                            color: isActive
                              ? "var(--accent)"
                              : "var(--foreground)",
                          }}
                        >
                          {preset.label}
                        </span>
                        {isActive && (
                          <Check
                            size={16}
                            style={{ color: "var(--accent)" }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Custom button */}
                <motion.button
                  onClick={() => {
                    setShowCustom(true);
                    setTempColor(customBgColor);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background:
                      theme === "custom"
                        ? "var(--accent-light)"
                        : "var(--muted-bg)",
                    border:
                      theme === "custom"
                        ? "1.5px solid var(--accent)"
                        : "1.5px solid transparent",
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg shrink-0"
                    style={{
                      background: `conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)`,
                      border: "1.5px solid rgba(0,0,0,0.1)",
                    }}
                  />
                  <span
                    className="text-sm font-medium flex-1 text-left"
                    style={{
                      color:
                        theme === "custom"
                          ? "var(--accent)"
                          : "var(--foreground)",
                    }}
                  >
                    カスタム
                  </span>
                  {theme === "custom" && (
                    <Check size={16} style={{ color: "var(--accent)" }} />
                  )}
                </motion.button>
              </>
            ) : (
              <>
                {/* Color grid */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {CUSTOM_COLORS.map((color) => {
                    const isSelected = tempColor === color;
                    return (
                      <motion.button
                        key={color}
                        onClick={() => setTempColor(color)}
                        className="w-full aspect-square rounded-xl relative"
                        style={{
                          background: color,
                          border: isSelected
                            ? "3px solid #fff"
                            : "2px solid rgba(255,255,255,0.15)",
                          boxShadow: isSelected
                            ? `0 0 0 2px ${color}, 0 4px 12px ${color}60`
                            : "none",
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {isSelected && (
                          <Check
                            size={16}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            style={{ color: "#fff" }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Custom hex input */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg shrink-0"
                    style={{
                      background: tempColor,
                      border: "1.5px solid rgba(255,255,255,0.2)",
                    }}
                  />
                  <input
                    type="text"
                    value={tempColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                        setTempColor(val);
                      }
                    }}
                    maxLength={7}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--foreground)",
                      border: "1px solid var(--card-border)",
                    }}
                    placeholder="#6366f1"
                  />
                </div>

                {/* Confirm */}
                <motion.button
                  onClick={handleCustomConfirm}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: tempColor }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  この色に設定
                </motion.button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useStore } from "@/store/useStore";

const PRESETS = [
  { key: "white" as const, label: "ホワイト", color: "#ffffff" },
  { key: "gray" as const, label: "グレー", color: "#e5e7eb" },
  { key: "dark" as const, label: "ダーク", color: "#161922" },
];
const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#1e293b", "#6b7280", "#0ea5e9", "#14b8a6", "#d946ef"];

export default function ThemePicker() {
  const theme = useStore((state) => state.theme);
  const customBgColor = useStore((state) => state.customBgColor);
  const setTheme = useStore((state) => state.setTheme);
  const setCustomBgColor = useStore((state) => state.setCustomBgColor);
  const [color, setColor] = useState(customBgColor);
  const valid = /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="表示テーマ">
        {PRESETS.map((preset) => (
          <button key={preset.key} type="button" className={`theme-option ${theme === preset.key ? "is-active" : ""}`}
            onClick={() => setTheme(preset.key)} aria-pressed={theme === preset.key}>
            <span className="theme-swatch" style={{ background: preset.color }} />
            {preset.label}{theme === preset.key && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold">カスタム背景</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="背景色の候補">
        {COLORS.map((value) => <button type="button" key={value} aria-label={`背景色 ${value}`} aria-pressed={color === value}
          className="color-option" style={{ background: value }} onClick={() => setColor(value)}>
          {color === value && <Check size={20} aria-hidden="true" />}
        </button>)}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-0 text-sm">カラーコード
          <input value={color} onChange={(event) => setColor(event.target.value)} maxLength={7} className="app-input mt-1 w-full" placeholder="#6366f1" />
        </label>
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { setCustomBgColor(color); setTheme("custom"); }}>適用する</button>
      </div>
      {theme === "custom" && <p className="text-sm text-muted" role="status">カスタム背景を使用中</p>}
    </div>
  );
}

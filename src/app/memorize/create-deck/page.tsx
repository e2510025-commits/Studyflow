"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4"];

  const handleSave = async () => {
    if (!name.trim()) {
      alert("デッキ名を入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/memorize/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color, isPublic }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/memorize/deck/${data.deck.id}`);
      } else {
        alert("保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save deck:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-page deck-editor-page">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium" style={{ color: "var(--primary)" }}>
          <ArrowLeft size={20} />
          戻る
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
          新しいデッキ
        </h1>
      </motion.div>

      <div className="editor-panel space-y-6" style={{ background: "var(--card)" }}>
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>デッキ名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 英単語 TOEIC 800"
            className="w-full px-4 py-3 rounded-xl outline-none"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>説明（任意）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="このデッキの内容や目的を記入"
            rows={3}
            className="w-full px-4 py-3 rounded-xl outline-none resize-none"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>カラー</label>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-11 h-11 rounded-full transition-transform"
                style={{ background: c, transform: color === c ? "scale(1.2)" : "scale(1)", border: color === c ? "3px solid #fff" : "none" }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-5 h-5"
          />
          <label htmlFor="isPublic" className="font-medium cursor-pointer" style={{ color: "var(--foreground)" }}>
            グループで共有する
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <Save size={20} />
          {saving ? "保存中..." : "デッキを作成"}
        </button>
      </div>
    </div>
  );
}

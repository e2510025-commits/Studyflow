"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  cardCount: number;
  dueCount: number;
  masteredCount: number;
}

export default function MemorizePage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    try {
      const res = await fetch("/api/memorize/decks");
      const data = await res.json();
      setDecks(data.decks || []);
      setTotalDue(data.totalDue || 0);
    } catch (error) {
      console.error("Failed to fetch decks:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
              暗記
            </h1>
            <p className="text-base mt-1 font-medium" style={{ color: "var(--muted)" }}>
              フラッシュカードと穴埋め問題で効率的に記憶
            </p>
          </div>
          {totalDue > 0 && (
            <div className="px-4 py-2 rounded-xl font-bold" style={{ background: "#ef444422", color: "#ef4444" }}>
              今日の復習: {totalDue}枚
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<BookOpen />} label="総カード数" value={decks.reduce((sum, d) => sum + d.cardCount, 0)} color="#3b82f6" />
        <StatCard icon={<Clock />} label="復習待ち" value={totalDue} color="#ef4444" />
        <StatCard icon={<TrendingUp />} label="習得済み" value={decks.reduce((sum, d) => sum + d.masteredCount, 0)} color="#22c55e" />
      </div>

      <div className="flex gap-3">
        <Link href="/memorize/create-deck" className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2" style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={20} />
          新しいデッキ
        </Link>
        <Link href="/memorize/create-question" className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2" style={{ background: "var(--accent)", color: "var(--foreground)" }}>
          <Plus size={20} />
          穴埋め問題
        </Link>
        <Link href="/memorize/questions" className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2" style={{ background: "var(--accent)", color: "var(--foreground)" }}>
          <BookOpen size={20} />
          問題一覧
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>読み込み中...</div>
      ) : decks.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>
          デッキがありません。新しいデッキを作成しましょう。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: "var(--card)" }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: color + "22", color }}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>{label}</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function DeckCard({ deck }: { deck: Deck }) {
  return (
    <Link href={`/memorize/deck/${deck.id}`}>
      <motion.div whileHover={{ scale: 1.02 }} className="p-5 rounded-2xl cursor-pointer" style={{ background: "var(--card)", borderLeft: `4px solid ${deck.color}` }}>
        <h3 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>{deck.name}</h3>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>{deck.description || "説明なし"}</p>
        <div className="flex gap-4 text-sm">
          <span style={{ color: "var(--muted)" }}>全{deck.cardCount}枚</span>
          {deck.dueCount > 0 && <span style={{ color: "#ef4444" }}>復習{deck.dueCount}枚</span>}
          <span style={{ color: "#22c55e" }}>習得{deck.masteredCount}枚</span>
        </div>
      </motion.div>
    </Link>
  );
}

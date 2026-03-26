"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Play, Edit, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface Card {
  id: string;
  front: string;
  back: string;
  status: string;
  nextReviewAt: string | null;
}

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    fetchDeck();
  }, [params.id]);

  const fetchDeck = async () => {
    try {
      const res = await fetch(`/api/memorize/decks/${params.id}`);
      const data = await res.json();
      setDeck(data.deck);
      setCards(data.cards || []);
    } catch (error) {
      console.error("Failed to fetch deck:", error);
    } finally {
      setLoading(false);
    }
  };

  const startReview = () => {
    router.push(`/memorize/review/${params.id}`);
  };

  const dueCards = cards.filter(c => !c.nextReviewAt || new Date(c.nextReviewAt) <= new Date());

  if (loading) {
    return <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">読み込み中...</div>;
  }

  if (!deck) {
    return (
      <div className="max-w-5xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium text-indigo-600 dark:text-indigo-400">
            <ArrowLeft size={20} />
            戻る
          </Link>
        </motion.div>
        
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">
            デッキが見つかりません
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
            このデッキは削除されたか、存在しない可能性があります
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/memorize")}
              className="px-6 py-3 rounded-xl font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:opacity-80 transition-opacity"
            >
              デッキ一覧へ戻る
            </button>
            <button
              onClick={() => router.push("/memorize/create-question")}
              className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-white hover:opacity-90 transition-opacity"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={20} />
              暗記カードを作成
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium text-indigo-600 dark:text-indigo-400">
          <ArrowLeft size={20} />
          戻る
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-2 h-16 rounded-full" style={{ background: deck.color }} />
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white">
              {deck.name}
            </h1>
            <p className="text-base mt-1 text-zinc-600 dark:text-zinc-400">
              {deck.description || "説明なし"}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-3">
        {dueCards.length > 0 && (
          <button
            onClick={startReview}
            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Play size={20} />
            復習を開始 ({dueCards.length}枚)
          </button>
        )}
        <button
          onClick={() => setShowAddCard(true)}
          className="px-4 py-3 rounded-xl font-semibold flex items-center gap-2"
          style={{ background: "var(--accent)", color: "var(--foreground)" }}
        >
          <Plus size={20} />
          カードを追加
        </button>
      </div>

      {showAddCard && <AddCardForm deckId={deck.id} onClose={() => setShowAddCard(false)} onAdded={fetchDeck} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </div>

      {cards.length === 0 && !showAddCard && (
        <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
          カードがありません。カードを追加しましょう。
        </div>
      )}
    </div>
  );
}

function AddCardForm({ deckId, onClose, onAdded }: { deckId: string; onClose: () => void; onAdded: () => void }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      alert("問題と解答を入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/memorize/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, front, back, hint }),
      });

      if (res.ok) {
        setFront("");
        setBack("");
        setHint("");
        onAdded();
        onClose();
      } else {
        alert("保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save card:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 rounded-2xl space-y-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">新しいカード</h3>
      
      <div>
        <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-white">問題（表面）</label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="例: apple"
          rows={2}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-white">解答（裏面）</label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="例: りんご"
          rows={2}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-white">ヒント（任意）</label>
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="例: 果物"
          className="w-full px-4 py-3 rounded-xl outline-none bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl font-bold"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-xl font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          キャンセル
        </button>
      </div>
    </motion.div>
  );
}

function CardItem({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false);

  const statusColors = {
    new: { bg: "#3b82f622", color: "#3b82f6", label: "未学習" },
    learning: { bg: "#f59e0b22", color: "#f59e0b", label: "学習中" },
    mastered: { bg: "#22c55e22", color: "#22c55e", label: "習得済み" },
  };

  const status = statusColors[card.status as keyof typeof statusColors] || statusColors.new;

  return (
    <motion.div
      onClick={() => setFlipped(!flipped)}
      className="p-5 rounded-2xl cursor-pointer min-h-[150px] flex flex-col justify-between"
      style={{ background: "var(--card)" }}
      whileHover={{ scale: 1.02 }}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>
        <div className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
          {flipped ? card.back : card.front}
        </div>
      </div>
      <div className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        クリックで{flipped ? "表" : "裏"}を表示
      </div>
    </motion.div>
  );
}

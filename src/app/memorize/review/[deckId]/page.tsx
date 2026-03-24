"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, Lightbulb } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Card {
  id: string;
  front: string;
  back: string;
  hint: string | null;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    fetchCards();
  }, [params.deckId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(!flipped);
      } else if (flipped && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
        const rating = parseInt(e.code.replace("Digit", ""));
        handleRating(rating);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [flipped, currentIndex]);

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/memorize/review/${params.deckId}`);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error("Failed to fetch cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      speechSynthesis.speak(utterance);
    }
  };

  const handleRating = async (rating: number) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const card = cards[currentIndex];

    try {
      await fetch("/api/memorize/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating, duration }),
      });
    } catch (error) {
      console.error("Failed to save review:", error);
    }

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
      setShowHint(false);
      setStartTime(Date.now());
    } else {
      router.push(`/memorize/deck/${params.deckId}`);
    }
  };

  if (loading) {
    return <div className="text-center py-12" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-lg mb-4" style={{ color: "var(--muted)" }}>復習するカードがありません</p>
        <Link href={`/memorize/deck/${params.deckId}`} className="px-6 py-3 rounded-xl font-bold inline-block" style={{ background: "var(--primary)", color: "#fff" }}>
          デッキに戻る
        </Link>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href={`/memorize/deck/${params.deckId}`} className="inline-flex items-center gap-2 mb-3 font-medium" style={{ color: "var(--primary)" }}>
          <ArrowLeft size={20} />
          戻る
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>
            復習中 {currentIndex + 1} / {cards.length}
          </h1>
          <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            スペースキー: 反転 | 1-4: 評価
          </div>
        </div>
        <div className="w-full h-2 rounded-full mt-3" style={{ background: "var(--accent)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--primary)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => setFlipped(!flipped)}
          className="p-12 rounded-3xl cursor-pointer min-h-[400px] flex flex-col items-center justify-center text-center relative"
          style={{ background: "var(--card)" }}
        >
          <div className="text-3xl font-bold mb-4" style={{ color: "var(--foreground)" }}>
            {flipped ? card.back : card.front}
          </div>

          {!flipped && card.hint && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHint(!showHint);
              }}
              className="absolute top-6 right-6 p-3 rounded-xl"
              style={{ background: "var(--accent)" }}
            >
              <Lightbulb size={20} style={{ color: "var(--primary)" }} />
            </button>
          )}

          {showHint && card.hint && (
            <div className="mt-4 px-4 py-2 rounded-xl text-sm" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
              ヒント: {card.hint}
            </div>
          )}

          {flipped && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(card.back);
              }}
              className="mt-4 p-3 rounded-xl"
              style={{ background: "var(--accent)" }}
            >
              <Volume2 size={20} style={{ color: "var(--primary)" }} />
            </button>
          )}

          <div className="absolute bottom-6 text-sm" style={{ color: "var(--muted)" }}>
            {flipped ? "評価を選択してください" : "クリックまたはスペースキーで反転"}
          </div>
        </motion.div>
      </AnimatePresence>

      {flipped && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
          <RatingButton rating={1} label="忘れた" color="#ef4444" onClick={() => handleRating(1)} />
          <RatingButton rating={2} label="難しい" color="#f59e0b" onClick={() => handleRating(2)} />
          <RatingButton rating={3} label="普通" color="#3b82f6" onClick={() => handleRating(3)} />
          <RatingButton rating={4} label="簡単" color="#22c55e" onClick={() => handleRating(4)} />
        </motion.div>
      )}
    </div>
  );
}

function RatingButton({ rating, label, color, onClick }: { rating: number; label: string; color: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="py-4 rounded-xl font-bold"
      style={{ background: color + "22", color }}
    >
      <div className="text-2xl mb-1">{rating}</div>
      <div className="text-sm">{label}</div>
    </motion.button>
  );
}

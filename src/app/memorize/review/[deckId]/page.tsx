"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { loadMemorizeViewerSettings } from "@/lib/memorizeViewerSettings";

type Card = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
};

type DeckMeta = {
  id: string;
  name: string;
  description: string;
};

const textColorMap: Record<string, string> = {
  blue: "#1d2df2",
  black: "#111827",
  red: "#dc2626",
  green: "#15803d",
};

export default function ReviewPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [deck, setDeck] = useState<DeckMeta | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [textColor, setTextColor] = useState(textColorMap.blue);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const [reviewRes, deckRes] = await Promise.all([
          fetch(`/api/memorize/review/${params.deckId}`, { cache: "no-store" }),
          fetch(`/api/memorize/decks/${params.deckId}`, { cache: "no-store" }),
        ]);

        const reviewData = await reviewRes.json();
        const deckData = await deckRes.json();

        setCards(reviewData.cards || []);
        setDeck(deckData.deck || null);
      } catch (error) {
        console.error("Failed to fetch review data:", error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.deckId]);

  useEffect(() => {
    const settings = loadMemorizeViewerSettings(params.deckId);
    setTextColor(textColorMap[settings.textColor] || textColorMap.blue);
    setSwipeEnabled(settings.swipeEnabled);
  }, [params.deckId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((prev) => !prev);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        moveToIndex(currentIndex + 1);
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        moveToIndex(currentIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length]);

  const currentCard = cards[currentIndex];

  const progress = useMemo(() => {
    if (cards.length === 0) return 0;
    return ((currentIndex + 1) / cards.length) * 100;
  }, [currentIndex, cards.length]);

  const handleSpeak = () => {
    if (!currentCard) return;
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(flipped ? currentCard.back : currentCard.front);
    utterance.lang = "ja-JP";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const postReview = async () => {
    if (!currentCard) return;

    const duration = Math.floor((Date.now() - startTime) / 1000);
    try {
      await fetch("/api/memorize/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, rating: 4, duration }),
      });
    } catch (error) {
      console.error("Failed to save review:", error);
    }
  };

  const moveToIndex = (nextIndex: number) => {
    if (cards.length === 0) return;
    if (nextIndex < 0 || nextIndex >= cards.length) return;

    setCurrentIndex(nextIndex);
    setFlipped(false);
    setStartTime(Date.now());
  };

  const handleNext = async () => {
    if (!flipped) {
      setFlipped(true);
      return;
    }

    await postReview();

    if (currentIndex >= cards.length - 1) {
      router.push(`/memorize/review/${params.deckId}/done`);
      return;
    }

    moveToIndex(currentIndex + 1);
  };

  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (cards.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const targetIndex = Math.max(0, Math.min(cards.length - 1, Math.floor(ratio * cards.length)));
    moveToIndex(targetIndex);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX;
    if (typeof endX !== "number") return;

    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 40) return;

    if (deltaX < 0) {
      moveToIndex(currentIndex + 1);
      return;
    }

    moveToIndex(currentIndex - 1);
  };

  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: "var(--muted)" }}>
        読み込み中...
      </div>
    );
  }

  if (cards.length === 0 || !currentCard) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-lg mb-4" style={{ color: "var(--muted)" }}>
          暗記カードがありません
        </p>
        <Link
          href={`/memorize/deck/${params.deckId}`}
          className="px-6 py-3 rounded-xl font-bold inline-block"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          設定に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-70px)] bg-[#f4f4f5] rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      <div className="h-full flex flex-col">
        <header className="h-10 px-3 flex items-center justify-between border-b text-xs" style={{ borderColor: "#e4e4e7" }}>
          <button type="button" onClick={() => router.push(`/memorize/deck/${params.deckId}`)} style={{ color: "#111827" }}>
            設定
          </button>
          <div className="font-semibold" style={{ color: "#374151" }}>
            <span>{deck?.name || "暗記"}</span>
          </div>
          <button type="button" onClick={() => router.push(`/memorize/deck/${params.deckId}`)} style={{ color: "#111827" }}>
            終了
          </button>
        </header>

        <main
          className="flex-1 relative px-4 sm:px-8 py-8 flex items-center justify-center text-center select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => setFlipped((prev) => !prev)}
            className="max-w-5xl w-full text-left sm:text-center"
            style={{ color: textColor }}
          >
            <div className="text-3xl sm:text-7xl font-extrabold leading-tight">
              {flipped ? currentCard.back : currentCard.front}
            </div>
          </button>

          <button
            type="button"
            className="absolute left-2 bottom-3 h-7 w-7 rounded-md border grid place-items-center"
            style={{ borderColor: "#a5b4fc", color: "#6366f1" }}
            onClick={handleSpeak}
            title="読み上げ"
          >
            <Volume2 size={16} />
          </button>

          <button
            type="button"
            className="absolute right-2 bottom-3 h-7 w-7 rounded-md border grid place-items-center"
            style={{ borderColor: "#d4d4d8", color: "#a1a1aa", background: "#fafafa" }}
            onClick={() => void handleNext()}
            title="次へ"
          >
            ✓
          </button>

          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: "#9ca3af" }}>
            {currentIndex + 1}/{cards.length}枚目の{flipped ? "裏" : "表"}
          </div>
        </main>

        <footer className="px-2 pb-2">
          <div
            className="h-6 rounded-md bg-[#e5e7eb] overflow-hidden cursor-pointer"
            onClick={handleProgressBarClick}
            role="button"
            aria-label="進捗バー"
          >
            <div className="h-full bg-[#7879d9]" style={{ width: `${progress}%` }} />
          </div>
        </footer>
      </div>
    </div>
  );
}

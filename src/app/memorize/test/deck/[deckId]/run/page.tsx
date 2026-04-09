"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Volume2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { loadMemorizeTestSettings } from "@/lib/memorizeTestSettings";

type Card = {
  id: string;
  front: string;
  back: string;
};

type Deck = {
  id: string;
  name: string;
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[ァ-ン]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
}

function parseAcceptedAnswers(raw: string): string[] {
  return raw
    .split(/[\n,、\/／|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function shuffleList<T>(rows: T[]): T[] {
  const next = [...rows];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

export default function DeckTestRunPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const answerRef = useRef<HTMLInputElement>(null);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [showBack, setShowBack] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);

  const settings = useMemo(() => loadMemorizeTestSettings(params.deckId), [params.deckId]);
  const current = cards[index];

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorText("");
      try {
        const res = await fetch(`/api/memorize/decks/${params.deckId}`, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !data?.deck) {
          setDeck(null);
          setCards([]);
          setErrorText("デッキが見つかりません");
          return;
        }

        const fetchedCards: Card[] = Array.isArray(data.cards)
          ? data.cards.map((row: Card) => ({ id: row.id, front: row.front || "", back: row.back || "" }))
          : [];

        if (fetchedCards.length === 0) {
          setDeck(data.deck);
          setCards([]);
          setErrorText("カードがありません");
          return;
        }

        const prepared = settings.shuffleCards ? shuffleList(fetchedCards) : fetchedCards;
        setDeck(data.deck);
        setCards(prepared);
      } catch {
        setErrorText("読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.deckId, settings.shuffleCards]);

  useEffect(() => {
    if (loading) return;
    answerRef.current?.focus();
  }, [loading, index, showBack]);

  useEffect(() => {
    if (settings.disableShortcuts) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && showBack) {
        event.preventDefault();
        moveNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings.disableShortcuts, showBack, index, cards.length]);

  const speak = () => {
    if (!settings.readAloud || !current) return;
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(showBack ? current.back : current.front);
    utter.lang = "ja-JP";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const judge = () => {
    if (!current) return;

    if (!showBack) {
      const normalizedInput = normalizeText(inputValue);
      const acceptedAnswers = parseAcceptedAnswers(current.back);
      const matched = settings.selfCheckOnly
        ? normalizedInput.length > 0
        : acceptedAnswers.some((candidate) => normalizeText(candidate) === normalizedInput);

      setResult(matched ? "correct" : "wrong");
      setShowBack(true);
      return;
    }

    moveNext();
  };

  const moveNext = () => {
    if (index >= cards.length - 1) {
      router.push(`/memorize/deck/${params.deckId}`);
      return;
    }
    setIndex((prev) => prev + 1);
    setInputValue("");
    setShowBack(false);
    setResult(null);
  };

  const textColor = settings.textColor === "red" ? "#b91c1c" : settings.textColor === "blue" ? "#1d4ed8" : "#2f2f34";
  const textWeight = settings.textWeight === "bold" ? 800 : 700;
  const textSize = settings.textSize === "large" ? "clamp(2.2rem, 7vw, 5.4rem)" : settings.textSize === "normal" ? "clamp(1.8rem, 5vw, 4.2rem)" : "clamp(2rem, 6vw, 5rem)";

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (!deck || !current) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>{errorText || "テストを開始できませんでした"}</p>
        <Link href={`/memorize/deck/${params.deckId}`} className="inline-block px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
          設定に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-70px)] bg-[#f4f4f5] rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      <div className="h-full flex flex-col">
        <header className="h-10 px-3 flex items-center justify-between border-b text-xs" style={{ borderColor: "#e4e4e7" }}>
          <button type="button" onClick={() => router.push(`/memorize/test/deck/${deck.id}`)} style={{ color: "#111827" }}>
            <span className="inline-flex items-center gap-1"><ArrowLeft size={12} /> 設定</span>
          </button>
          <div className="font-semibold" style={{ color: "#374151" }}>
            {deck.name}
          </div>
          <button type="button" onClick={() => router.push(`/memorize/deck/${deck.id}`)} style={{ color: "#111827" }}>
            終了
          </button>
        </header>

        <main className="flex-1 relative px-2 sm:px-6 py-5 sm:py-8 flex items-center justify-center text-center">
          <div className="w-full h-full rounded-lg sm:rounded-2xl px-2 sm:px-8 py-4 sm:py-10" style={{ background: "#f4f4f5" }}>
            <div className="h-full w-full grid place-items-center">
              <div
                className="leading-[1.28] break-words whitespace-pre-wrap"
                style={{
                  color: textColor,
                  fontWeight: textWeight,
                  fontSize: textSize,
                  opacity: showBack ? 0.7 : 1,
                }}
              >
                {showBack ? current.back : current.front}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="absolute left-2 bottom-2 h-7 w-7 rounded-md border grid place-items-center"
            style={{ borderColor: "#a5b4fc", color: "#6366f1" }}
            onClick={speak}
            title="読み上げ"
            disabled={!settings.readAloud}
          >
            <Volume2 size={15} />
          </button>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px]" style={{ color: "#818cf8" }}>
            {showBack ? "もう一度 Enter で次へ" : "回答して Enter で判定"}
          </div>
        </main>

        <footer className="px-1.5 sm:px-3 pb-1.5 sm:pb-3">
          <div className="rounded-md sm:rounded-xl border overflow-hidden" style={{ borderColor: "#d4d4d8", background: "#ececec" }}>
            <div className="h-1.5" style={{ background: "#e5e7eb" }}>
              <div className="h-full" style={{ background: "#7879d9", width: `${((index + 1) / cards.length) * 100}%` }} />
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-0.5 p-1.5 sm:p-2">
              <input
                ref={answerRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (settings.enterToSubmit || !e.shiftKey)) {
                    e.preventDefault();
                    judge();
                  }
                }}
                className="w-full rounded-md sm:rounded-lg px-3 py-2 sm:py-2.5 text-sm sm:text-base outline-none"
                style={{
                  background: "#f8fafc",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                }}
                placeholder={showBack ? "Enterで次へ" : "回答を入力"}
                disabled={showBack}
              />

              <button
                type="button"
                onClick={judge}
                className="h-full min-w-[42px] sm:min-w-[54px] rounded-md sm:rounded-lg grid place-items-center"
                style={{ background: "#7879d9", color: "white" }}
                title={showBack ? "次へ" : "判定"}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="px-3 pb-2 text-xs text-center" style={{ color: result === "correct" ? "#15803d" : result === "wrong" ? "#b91c1c" : "#6b7280" }}>
              {result === "correct" ? "正解" : result === "wrong" ? "不正解" : `${index + 1}/${cards.length} 問`}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

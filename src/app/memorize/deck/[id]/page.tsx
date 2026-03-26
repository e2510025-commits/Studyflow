"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Check,
  Ellipsis,
  Home,
  Pencil,
  Play,
  Printer,
  Share2,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt?: string | null;
  userName?: string;
}

interface Card {
  id: string;
  front: string;
  back: string;
  status: string;
  nextReviewAt: string | null;
}

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/memorize/decks/${params.id}`, { cache: "no-store" });
        const data = await res.json();
        setDeck(data.deck || null);
        setCards(data.cards || []);
      } catch (error) {
        console.error("Failed to fetch deck:", error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id]);

  const dueCards = useMemo(
    () => cards.filter((card) => !card.nextReviewAt || new Date(card.nextReviewAt) <= new Date()),
    [cards]
  );

  if (loading) {
    return (
      <div className="text-center py-14 text-sm" style={{ color: "var(--muted)" }}>
        読み込み中...
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="max-w-5xl mx-auto py-14 text-center">
        <h2 className="text-2xl font-black mb-3" style={{ color: "var(--foreground)" }}>
          デッキが見つかりません
        </h2>
        <button
          type="button"
          onClick={() => router.push("/memorize")}
          className="px-5 py-2.5 rounded-xl border font-semibold"
          style={{
            background: "var(--muted-bg)",
            borderColor: "var(--card-border)",
            color: "var(--foreground)",
          }}
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  const createdLabel = deck.createdAt
    ? new Date(deck.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : "日付未設定";

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:underline inline-flex items-center gap-1">
          <Home size={12} />
          ホーム
        </Link>
        <span> &gt; </span>
        <span>{deck.name}</span>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4 sm:p-6"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              {deck.name}
              <span className="text-[11px] px-2 py-1 rounded-full" style={{ color: "var(--primary)", background: "var(--primary)1f" }}>
                暗記公開
              </span>
            </h1>
            {deck.description && (
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                {deck.description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border flex items-center justify-center"
            style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
            title="オプション"
          >
            <Ellipsis size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetaChip icon={<User size={14} />} label={deck.userName || "あなた"} />
          <MetaChip icon={<Calendar size={14} />} label={createdLabel} />
          <MetaChip icon={<BookOpen size={14} />} label={`カード ${cards.length}`} />
          <MetaChip icon={<Star size={14} />} label="いいね 0" />
        </div>

        <div className="mt-5 grid grid-cols-3 rounded-xl border overflow-hidden" style={{ borderColor: "var(--primary)66" }}>
          <ActionTab
            icon={<BookOpen size={22} />}
            label="暗記"
            active
            onClick={() => {
              // Current page
            }}
          />
          <ActionTab
            icon={<Play size={22} />}
            label="テスト"
            onClick={() => router.push(`/memorize/review/${deck.id}`)}
          />
          <ActionTab icon={<Printer size={22} />} label="出力" onClick={() => window.print()} />
        </div>

        <div className="mt-6">
          <div className="text-center mb-3">
            <h2 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>
              単語カード
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              暗記済みのチェック済みカードには右端にチェックが付きます。
            </p>
          </div>

          <div className="space-y-2">
            {cards.length === 0 ? (
              <div
                className="rounded-xl border p-6 text-center text-sm"
                style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
              >
                カードがありません。右下の編集ボタンから追加してください。
              </div>
            ) : (
              cards.map((card) => <StudyCardRow key={card.id} card={card} />)
            )}
          </div>
        </div>
      </motion.section>

      <div className="fixed bottom-5 left-5 flex gap-2">
        <button
          type="button"
          className="h-11 w-11 rounded-xl border flex items-center justify-center"
          style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--primary)" }}
          title="お気に入り"
        >
          <Star size={18} />
        </button>
        <button
          type="button"
          className="h-11 w-11 rounded-xl border flex items-center justify-center"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-foreground)" }}
          title="共有"
        >
          <Share2 size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/memorize/deck/${deck.id}/edit`)}
        className="fixed bottom-5 right-5 h-12 w-12 rounded-xl border flex items-center justify-center shadow-lg"
        style={{
          background: "var(--primary)",
          borderColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
        title="編集"
      >
        <Pencil size={20} />
      </button>

      {dueCards.length > 0 && (
        <div className="text-center text-xs" style={{ color: "var(--muted)" }}>
          復習待ち {dueCards.length} 枚
        </div>
      )}
    </div>
  );
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
      style={{ color: "var(--muted)", borderColor: "var(--card-border)", background: "var(--background)" }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ActionTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-4 border-r last:border-r-0 flex flex-col items-center gap-1.5"
      style={{
        borderColor: "var(--primary)4f",
        color: "var(--primary)",
        background: active ? "var(--primary)12" : "transparent",
      }}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function StudyCardRow({ card }: { card: Card }) {
  const isMastered = card.status === "mastered";

  return (
    <div className="grid grid-cols-[1fr_1fr_20px] rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
      <div className="p-3 sm:p-4 text-lg leading-relaxed" style={{ color: "var(--foreground)", borderRight: "1px solid var(--card-border)" }}>
        {card.front}
      </div>
      <div className="p-3 sm:p-4 text-lg leading-relaxed" style={{ color: "var(--foreground)", borderRight: "1px solid var(--card-border)" }}>
        {card.back}
      </div>
      <div className="grid place-items-center" style={{ color: isMastered ? "var(--success)" : "var(--muted)" }}>
        <Check size={14} />
      </div>
    </div>
  );
}

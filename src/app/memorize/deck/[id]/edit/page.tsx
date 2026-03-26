"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, PlusCircle, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Deck = {
  id: string;
  name: string;
  description: string;
};

type EditableCard = {
  id: string;
  front: string;
  back: string;
  isNew: boolean;
};

const createNewCard = (): EditableCard => ({
  id: `new-${crypto.randomUUID()}`,
  front: "",
  back: "",
  isNew: true,
});

export default function DeckEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<EditableCard[]>([]);
  const [initialCards, setInitialCards] = useState<Record<string, { front: string; back: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/memorize/decks/${params.id}`, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !data?.deck) {
          setDeck(null);
          return;
        }

        setDeck({
          id: data.deck.id,
          name: data.deck.name || "",
          description: data.deck.description || "",
        });

        const loadedCards: EditableCard[] = Array.isArray(data.cards)
          ? data.cards.map((card: { id: string; front: string; back: string }) => ({
              id: card.id,
              front: card.front || "",
              back: card.back || "",
              isNew: false,
            }))
          : [];

        setCards(loadedCards);
        setInitialCards(
          Object.fromEntries(loadedCards.map((card) => [card.id, { front: card.front, back: card.back }]))
        );
      } catch (error) {
        console.error("Failed to load deck for edit:", error);
        setDeck(null);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id]);

  const hasEmptyCard = useMemo(
    () => cards.some((card) => card.front.trim().length === 0 || card.back.trim().length === 0),
    [cards]
  );

  const updateDeckField = (field: keyof Deck, value: string) => {
    setDeck((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateCard = (id: string, patch: Partial<EditableCard>) => {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };

  const removeCard = async (target: EditableCard) => {
    if (!target.isNew) {
      const ok = confirm("このカードを削除しますか？");
      if (!ok) return;

      try {
        const res = await fetch(`/api/memorize/cards/${target.id}`, { method: "DELETE" });
        if (!res.ok) {
          alert("カードの削除に失敗しました");
          return;
        }
      } catch (error) {
        console.error("Failed to delete card:", error);
        alert("カードの削除に失敗しました");
        return;
      }
    }

    setCards((prev) => prev.filter((card) => card.id !== target.id));
  };

  const saveAll = async () => {
    if (!deck) return;

    if (!deck.name.trim()) {
      alert("単語帳名を入力してください");
      return;
    }

    if (hasEmptyCard) {
      alert("空欄のカードがあります。表と裏を入力してください");
      return;
    }

    setSaving(true);
    try {
      const deckRes = await fetch(`/api/memorize/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deck.name.trim(),
          description: deck.description.trim(),
        }),
      });

      if (!deckRes.ok) {
        alert("単語帳の保存に失敗しました");
        return;
      }

      const existingCards = cards.filter((card) => !card.isNew);
      const newCards = cards.filter((card) => card.isNew);

      const changedCards = existingCards.filter((card) => {
        const initial = initialCards[card.id];
        if (!initial) return false;
        return initial.front !== card.front || initial.back !== card.back;
      });

      for (const card of changedCards) {
        const res = await fetch(`/api/memorize/cards/${card.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front: card.front.trim(), back: card.back.trim() }),
        });

        if (!res.ok) {
          alert("カードの更新に失敗しました");
          return;
        }
      }

      for (const card of newCards) {
        const res = await fetch("/api/memorize/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckId: deck.id,
            front: card.front.trim(),
            back: card.back.trim(),
          }),
        });

        if (!res.ok) {
          alert("カードの追加に失敗しました");
          return;
        }
      }

      router.push(`/memorize/deck/${deck.id}`);
    } catch (error) {
      console.error("Failed to save deck edit:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const deleteDeck = async () => {
    if (!deck) return;
    const ok = confirm("この単語帳を削除します。よろしいですか？");
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/memorize/decks/${deck.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("単語帳の削除に失敗しました");
        return;
      }
      router.push("/memorize");
    } catch (error) {
      console.error("Failed to delete deck:", error);
      alert("単語帳の削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (!deck) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="text-xl font-bold" style={{ color: "var(--foreground)" }}>単語帳が見つかりません</div>
        <button
          type="button"
          onClick={() => router.push("/memorize")}
          className="px-4 py-2 rounded-xl border"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        >
          一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-4">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        <Link href="/memorize" className="hover:underline">単語帳一覧</Link>
        <span> &gt; </span>
        <Link href={`/memorize/deck/${deck.id}`} className="hover:underline">{deck.name}</Link>
        <span> &gt; 編集</span>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4 sm:p-6 space-y-5"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>単語帳を編集</h1>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)" }}>
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>操作</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteDeck}
              disabled={saving}
              className="px-4 py-2 rounded-lg border inline-flex items-center gap-2"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              <Trash2 size={16} /> 単語帳を削除
            </button>
            <Link
              href={`/memorize/deck/${deck.id}`}
              className="px-4 py-2 rounded-lg border inline-flex items-center gap-2"
              style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
            >
              <ArrowLeft size={16} /> 詳細へ戻る
            </Link>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>単語帳</h2>
          <input
            type="text"
            value={deck.name}
            onChange={(e) => updateDeckField("name", e.target.value)}
            placeholder="単語帳名"
            className="w-full rounded-xl px-4 py-3 border outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
          />
          <textarea
            value={deck.description}
            onChange={(e) => updateDeckField("description", e.target.value)}
            placeholder="単語帳の説明"
            rows={3}
            className="w-full rounded-xl px-4 py-3 border outline-none resize-none"
            style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>

        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>単語カード</h2>
            <button
              type="button"
              onClick={() => setCards((prev) => [...prev, createNewCard()])}
              className="px-3 py-1.5 rounded-full border inline-flex items-center gap-2 text-sm"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
            >
              <PlusCircle size={16} /> カードを追加
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="rounded-xl border p-5 text-center text-sm" style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}>
              カードがありません。上のボタンから追加してください。
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((card, index) => (
                <div key={card.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={card.front}
                    onChange={(e) => updateCard(card.id, { front: e.target.value })}
                    placeholder={`表 ${index + 1}`}
                    className="rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                  <input
                    value={card.back}
                    onChange={(e) => updateCard(card.id, { back: e.target.value })}
                    placeholder={`裏 ${index + 1}`}
                    className="rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                  <button
                    type="button"
                    onClick={() => void removeCard(card)}
                    className="h-10 w-10 rounded-lg border inline-flex items-center justify-center"
                    style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                    title="カードを削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={saving}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-4xl w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] py-3 rounded-xl border font-bold inline-flex items-center justify-center gap-2"
        style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <Save size={18} /> {saving ? "保存中..." : "単語帳を保存"}
      </button>
    </div>
  );
}

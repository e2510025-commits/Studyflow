"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Eye, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type QuestionMode = "sequential" | "all-at-once";

interface DraftCard {
  id: string;
  title: string;
  content: string;
  mode: QuestionMode;
}

const STORAGE_KEY = "memorize-create-question-draft-v2";

const createEmptyCard = (): DraftCard => ({
  id: crypto.randomUUID(),
  title: "",
  content: "",
  mode: "sequential",
});

export default function CreateQuestionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<DraftCard[]>([createEmptyCard()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentCard = cards[activeIndex] ?? cards[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as { cards?: DraftCard[]; activeIndex?: number };
      if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) return;

      setCards(parsed.cards.map((card) => ({
        id: card.id || crypto.randomUUID(),
        title: card.title || "",
        content: card.content || "",
        mode: card.mode === "all-at-once" ? "all-at-once" : "sequential",
      })));
      setActiveIndex(Math.min(parsed.activeIndex ?? 0, parsed.cards.length - 1));
    } catch (error) {
      console.error("Failed to restore draft:", error);
    }
  }, []);

  const persistDraft = (nextCards: DraftCard[], nextActiveIndex: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          cards: nextCards,
          activeIndex: nextActiveIndex,
        })
      );
      setDraftSavedAt(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      console.error("Failed to persist draft:", error);
    }
  };

  const updateCurrentCard = (patch: Partial<DraftCard>) => {
    setCards((prev) => {
      const next = prev.map((card, index) => (index === activeIndex ? { ...card, ...patch } : card));
      return next;
    });
  };

  const handleBlurAutoSave = () => {
    persistDraft(cards, activeIndex);
    setTimeout(() => setIsFocused(false), 120);
  };

  const insertBrackets = () => {
    const textarea = textareaRef.current;
    if (!textarea || !currentCard) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentCard.content.substring(start, end);

    if (selectedText) {
      const newContent =
        currentCard.content.substring(0, start) + `（${selectedText}）` + currentCard.content.substring(end);
      updateCurrentCard({ content: newContent });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + selectedText.length + 2, start + selectedText.length + 2);
      }, 0);
    } else {
      const newContent = currentCard.content.substring(0, start) + "（）" + currentCard.content.substring(end);
      updateCurrentCard({ content: newContent });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  const extractAnswers = (text: string): string[] => {
    const regex = /[（(]([^）)]+)[）)]/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };

  const renderPreview = () => {
    if (!currentCard) return null;
    const parts = currentCard.content.split(/([（(][^）)]+[）)])/g);
    return parts.map((part, idx) => {
      if (part.match(/[（(][^）)]+[）)]/)) {
        const answer = part.replace(/[（()）]/g, "").trim();
        const answerLength = answer.length || 3;
        return (
          <span key={idx} className="inline-block relative mx-1">
            <input
              type="text"
              disabled
              className="px-3 py-2 rounded-lg outline-none text-center font-semibold border-2 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600"
              style={{
                width: `${Math.max(answerLength * 1.5, 4)}em`,
              }}
              placeholder="___"
            />
            <span className="absolute -bottom-6 left-0 text-xs font-medium whitespace-nowrap text-emerald-600 dark:text-emerald-400">
              正解: {answer}
            </span>
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const activeAnswers = useMemo(
    () => (currentCard ? extractAnswers(currentCard.content) : []),
    [currentCard]
  );

  const addCard = () => {
    const nextCards = [...cards, createEmptyCard()];
    const nextIndex = nextCards.length - 1;
    setCards(nextCards);
    setActiveIndex(nextIndex);
    persistDraft(nextCards, nextIndex);
  };

  const handleSaveAll = async () => {
    if (cards.length === 0) {
      alert("保存するカードがありません");
      return;
    }

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      if (!card.title.trim() || !card.content.trim()) {
        setActiveIndex(i);
        alert(`カード${i + 1}のタイトルと問題文を入力してください`);
        return;
      }

      if (extractAnswers(card.content).length === 0) {
        setActiveIndex(i);
        alert(`カード${i + 1}に穴埋めがありません。\n（答え）または(答え)の形式で作成してください。`);
        return;
      }
    }

    const entries = cards.map((card) => ({
      title: card.title.trim(),
      content: card.content.trim(),
      answers: extractAnswers(card.content),
      mode: card.mode,
    }));

    if (entries.length === 0) {
      alert("保存対象のカードがありません");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/memorize/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || "保存に失敗しました");
        return;
      }

      if (!data?.count || data.count < entries.length) {
        alert("一部のカード保存に失敗しました。再度お試しください。");
        return;
      }

      localStorage.removeItem(STORAGE_KEY);
      router.push("/memorize/questions");
    } catch (error) {
      console.error("Failed to save question:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-page question-editor-page">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft size={20} />
          戻る
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100">
          穴埋めカードを作成
        </h1>
        <p className="text-sm mt-1 text-zinc-600 dark:text-zinc-400">
          複数カードを連続作成できます。入力欄からフォーカスが外れると下書きを自動保存します。
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        <aside className="p-4 rounded-2xl border bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 h-fit">
          <div className="text-sm font-bold mb-3">カードナビゲーター</div>
          <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
            {cards.map((card, index) => {
              const isActive = index === activeIndex;
              const hasBody = card.title.trim().length > 0 || card.content.trim().length > 0;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-lg h-10 font-bold border transition-colors ${
                    isActive
                      ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={hasBody ? `カード${index + 1}: 入力済み` : `カード${index + 1}: 未入力`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addCard}
            className="mt-4 w-full px-3 py-2 rounded-xl font-semibold border bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            ＋ 次のカードを追加
          </button>
          {draftSavedAt && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">下書き保存: {draftSavedAt}</p>
          )}
        </aside>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="p-6 rounded-2xl space-y-4 border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
            <div>
              <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">タイトル</label>
              <input
                type="text"
                value={currentCard?.title ?? ""}
                onChange={(e) => updateCurrentCard({ title: e.target.value })}
                onBlur={handleBlurAutoSave}
                placeholder="例: 日本史 江戸時代"
                className="w-full px-4 py-3 rounded-xl outline-none border bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">問題文</label>
              <textarea
                ref={textareaRef}
                value={currentCard?.content ?? ""}
                onChange={(e) => updateCurrentCard({ content: e.target.value })}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlurAutoSave}
                placeholder="問題文を入力し、答えにしたい部分を選択して「（ ）」ボタンを押してください"
                rows={10}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none border bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
              />
              
              {isFocused && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={insertBrackets}
                  className="absolute right-4 top-12 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md border bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="選択したテキストを穴埋めにする"
                >
                  （ ）
                </motion.button>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">解答モード</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => updateCurrentCard({ mode: "sequential" })}
                  className={`flex-1 py-2 rounded-xl font-semibold transition-all border ${
                    currentCard?.mode === "sequential"
                      ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  順次解答
                </button>
                <button
                  type="button"
                  onClick={() => updateCurrentCard({ mode: "all-at-once" })}
                  className={`flex-1 py-2 rounded-xl font-semibold transition-all border ${
                    currentCard?.mode === "all-at-once"
                      ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  一括解答
                </button>
              </div>
              <p className="text-xs mt-2 text-zinc-600 dark:text-zinc-400">
                順次解答: Enterで次の穴埋めへ移動 | 一括解答: すべて入力してから判定
              </p>
            </div>

            {activeAnswers.length > 0 && (
              <div className="p-4 rounded-xl border bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                <div className="text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">自動抽出された答え ({activeAnswers.length}個)</div>
                <div className="flex flex-wrap gap-2">
                  {activeAnswers.map((ans, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      {idx + 1}. {ans}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={addCard}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 border bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Plus size={18} />
              ＋ 次のカードを追加
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="xl:col-span-2 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 border bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
          >
            <Save size={20} />
            {saving ? "保存中..." : "全ての変更を保存"}
          </button>

          <div className="p-6 rounded-2xl sticky top-5 h-fit border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={20} className="text-zinc-700 dark:text-zinc-300" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">リアルタイムプレビュー</h3>
          </div>
          <div className="p-5 rounded-xl min-h-[300px] border bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
            {currentCard?.title && <h4 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">{currentCard.title}</h4>}
            <div className="text-lg leading-relaxed pb-8 text-zinc-900 dark:text-zinc-100">
              {currentCard?.content ? renderPreview() : <span className="text-zinc-600 dark:text-zinc-400">問題文を入力するとプレビューが表示されます</span>}
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl text-xs border bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700">
            ヒント: 「（ ）」ボタンは選択範囲があれば囲み、未選択なら空のかっこを挿入してカーソルを中へ移動します。
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type MemorizeTestSettings,
  loadMemorizeTestSettings,
  saveMemorizeTestSettings,
} from "@/lib/memorizeTestSettings";

type Deck = {
  id: string;
  name: string;
  createdAt?: string | null;
};

type Card = {
  id: string;
};

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b p-3" style={{ borderColor: "var(--card-border)" }}>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{title}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-12 h-7 rounded-full transition-colors"
        style={{ background: checked ? "var(--primary)" : "#e4e4e7" }}
      >
        <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: checked ? "1.45rem" : "0.25rem" }} />
      </button>
    </div>
  );
}

function SelectRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b p-3" style={{ borderColor: "var(--card-border)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{title}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-72 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
      >
        {options.map((row) => (
          <option key={row.value} value={row.value}>{row.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function DeckTestOptionPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [settings, setSettings] = useState<MemorizeTestSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.deckId) return;
    setSettings(loadMemorizeTestSettings(params.deckId));
  }, [params.deckId]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/memorize/decks/${params.deckId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.deck) {
          setDeck(null);
          setCards([]);
          return;
        }
        setDeck({
          id: data.deck.id,
          name: data.deck.name || "",
          createdAt: data.deck.createdAt || null,
        });
        setCards(Array.isArray(data.cards) ? data.cards : []);
      } catch {
        setDeck(null);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.deckId]);

  const updateSetting = <K extends keyof MemorizeTestSettings>(key: K, value: MemorizeTestSettings[K]) => {
    if (!settings || !deck) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveMemorizeTestSettings(deck.id, next);
  };

  const createdLabel = useMemo(() => {
    if (!deck?.createdAt) return "日付未設定";
    return new Date(deck.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  }, [deck?.createdAt]);

  if (loading || !settings) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (!deck) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>デッキが見つかりません</p>
        <Link href="/memorize" className="px-4 py-2 rounded-xl font-semibold inline-block" style={{ background: "var(--primary)", color: "#fff" }}>
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        <Link href="/memorize" className="hover:underline">ホーム</Link>
        <span> &gt; </span>
        <Link href={`/memorize/deck/${deck.id}`} className="hover:underline">{deck.name}</Link>
        <span> &gt; テスト</span>
      </div>

      <section className="rounded-2xl border p-4 sm:p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
            {deck.name}
          </h1>
          <button
            type="button"
            onClick={() => router.push(`/memorize/deck/${deck.id}`)}
            className="h-9 px-3 rounded-full border inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
          >
            <ArrowLeft size={15} />
            戻る
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip icon={<BookOpen size={14} />} label={`カード ${cards.length}`} />
          <Chip icon={<Calendar size={14} />} label={createdLabel} />
        </div>

        <div className="mt-6 rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
          <ToggleRow
            title="改行を優先する"
            description="[Enter]で送信、[Shift+Enter]で改行になります。"
            checked={settings.enterToSubmit}
            onChange={(next) => updateSetting("enterToSubmit", next)}
          />
          <ToggleRow
            title="正解済みをスキップ"
            description="前回のテストで正解したカードをスキップします。"
            checked={settings.skipKnownCard}
            onChange={(next) => updateSetting("skipKnownCard", next)}
          />
          <ToggleRow
            title="自分で採点する"
            description="自動採点せず、正誤を自分で判断します。"
            checked={settings.selfCheckOnly}
            onChange={(next) => updateSetting("selfCheckOnly", next)}
          />
          <ToggleRow
            title="カードを裏返す"
            description="回答後に裏面を表示します。"
            checked={settings.reverseCard}
            onChange={(next) => updateSetting("reverseCard", next)}
          />
          <ToggleRow
            title="カードを混ぜる"
            description="カードをランダムに混ぜて出題します。"
            checked={settings.shuffleCards}
            onChange={(next) => updateSetting("shuffleCards", next)}
          />
          <ToggleRow
            title="ショートカット無効化"
            description="すべてのショートカットを無効化します。"
            checked={settings.disableShortcuts}
            onChange={(next) => updateSetting("disableShortcuts", next)}
          />
          <ToggleRow
            title="読み上げる"
            description="カードを機械音声で読み上げます。"
            checked={settings.readAloud}
            onChange={(next) => updateSetting("readAloud", next)}
          />
          <ToggleRow
            title="カードのスタイル"
            description="文字色や太さなどの見た目を設定します。"
            checked={settings.cardStyleEnabled}
            onChange={(next) => updateSetting("cardStyleEnabled", next)}
          />

          <SelectRow
            title="文字の色"
            value={settings.textColor}
            options={[
              { value: "normal", label: "ノーマル" },
              { value: "blue", label: "青" },
              { value: "red", label: "赤" },
            ]}
            onChange={(next) => updateSetting("textColor", next)}
          />
          <SelectRow
            title="文字の太さ"
            value={settings.textWeight}
            options={[
              { value: "normal", label: "ノーマル" },
              { value: "bold", label: "太字" },
            ]}
            onChange={(next) => updateSetting("textWeight", next)}
          />
          <SelectRow
            title="文字の大きさ"
            value={settings.textSize}
            options={[
              { value: "auto", label: "auto" },
              { value: "normal", label: "ノーマル" },
              { value: "large", label: "大きめ" },
            ]}
            onChange={(next) => updateSetting("textSize", next)}
          />
          <SelectRow
            title="ヒントの表示"
            value={settings.hintVisibility}
            options={[
              { value: "show", label: "表示" },
              { value: "hide", label: "非表示" },
            ]}
            onChange={(next) => updateSetting("hintVisibility", next)}
          />
          <SelectRow
            title="カードのめくり方"
            value={settings.turnStyle}
            options={[
              { value: "normal", label: "ノーマル" },
              { value: "quick", label: "クイック" },
            ]}
            onChange={(next) => updateSetting("turnStyle", next)}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            if (cards.length === 0) {
              alert("カードがありません");
              return;
            }
            router.push(`/memorize/test/deck/${deck.id}/run`);
          }}
          className="mt-6 w-full py-3 rounded-2xl font-bold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          テストを開始する
        </button>
      </section>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border" style={{ color: "var(--muted)", borderColor: "var(--card-border)", background: "var(--background)" }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

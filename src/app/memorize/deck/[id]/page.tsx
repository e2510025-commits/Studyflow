"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Calendar, Ellipsis, Home, Pencil, Play, Printer, User } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type MemorizeViewerSettings,
  loadMemorizeViewerSettings,
  saveMemorizeViewerSettings,
} from "@/lib/memorizeViewerSettings";

type Deck = {
  id: string;
  name: string;
  description: string;
  createdAt?: string | null;
  userName?: string;
};

type Card = {
  id: string;
  front: string;
  back: string;
};

export default function DeckMemorizeSettingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [settings, setSettings] = useState<MemorizeViewerSettings | null>(null);
  const [loading, setLoading] = useState(true);

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
          createdAt: data.deck.createdAt || null,
          userName: data.deck.userName || "あなた",
        });

        const loadedCards: Card[] = Array.isArray(data.cards)
          ? data.cards.map((card: { id: string; front: string; back: string }) => ({
              id: card.id,
              front: card.front || "",
              back: card.back || "",
            }))
          : [];

        setCards(loadedCards);
      } catch (error) {
        console.error("Failed to fetch deck:", error);
        setDeck(null);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    setSettings(loadMemorizeViewerSettings(params.id));
  }, [params.id]);

  const updateSetting = <K extends keyof MemorizeViewerSettings>(key: K, value: MemorizeViewerSettings[K]) => {
    if (!deck || !settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveMemorizeViewerSettings(deck.id, next);
  };

  const createdLabel = useMemo(() => {
    if (!deck?.createdAt) return "日付未設定";
    return new Date(deck.createdAt).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [deck?.createdAt]);

  if (loading || !settings) {
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

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:underline inline-flex items-center gap-1">
          <Home size={12} />
          ホーム
        </Link>
        <span> &gt; </span>
        <Link href="/memorize" className="hover:underline">暗記</Link>
        <span> &gt; </span>
        <span>{deck.name}</span>
      </div>

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
            {deck.name}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-full border flex items-center justify-center gap-1.5 text-sm font-semibold"
              style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
              title="カードを編集"
              onClick={() => router.push(`/memorize/deck/${deck.id}/edit`)}
            >
              <Pencil size={14} />
              編集
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-full border flex items-center justify-center"
              style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
              title="オプション"
            >
              <Ellipsis size={18} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetaChip icon={<User size={14} />} label={deck.userName || "あなた"} />
          <MetaChip icon={<Calendar size={14} />} label={createdLabel} />
          <MetaChip icon={<Calendar size={14} />} label={`カード ${cards.length}`} />
          <MetaChip icon={<Calendar size={14} />} label="いいね 0" />
        </div>

        <div className="mt-5 grid grid-cols-3 rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
          <button
            type="button"
            className="py-3 text-sm font-bold border-r"
            style={{ borderColor: "var(--card-border)", color: "var(--primary)", background: "var(--primary)12" }}
            onClick={() => router.push(`/memorize/review/${deck.id}`)}
          >
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={16} />
              暗記
            </span>
          </button>
          <button
            type="button"
            className="py-3 text-sm font-bold border-r"
            style={{ borderColor: "var(--card-border)", color: "var(--primary)" }}
            onClick={() => {
              if (cards.length === 0) {
                alert("カードがありません");
                return;
              }
              router.push(`/memorize/test/deck/${deck.id}`);
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Play size={16} />
              テスト
            </span>
          </button>
          <button
            type="button"
            className="py-3 text-sm font-bold"
            style={{ color: "var(--primary)" }}
            onClick={() => window.print()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Printer size={16} />
              出力
            </span>
          </button>
        </div>

        <div className="mt-8">
          <div className="px-3 py-2 text-sm font-bold rounded-t-xl" style={{ background: "var(--primary)1f", color: "var(--primary)" }}>
            暗記
          </div>
          <div className="rounded-b-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
            <SettingToggleRow
              title="タッチでめくる"
              description="タッチだけでカードがめくれます。"
              checked={settings.tapToFlip}
              onChange={(checked) => updateSetting("tapToFlip", checked)}
            />
            <SettingToggleRow
              title="音声で操作する"
              description="キーボード操作によって操作します。"
              checked={settings.keyboardEnabled}
              onChange={(checked) => updateSetting("keyboardEnabled", checked)}
            />
            <SettingToggleRow
              title="チェック済みを表示"
              description="チェックをつけたカードを表示します。"
              checked={settings.showCheckIndicator}
              onChange={(checked) => updateSetting("showCheckIndicator", checked)}
            />
            <SettingToggleRow
              title="カードを混ぜる"
              description="カードをランダムに混ぜます。"
              checked={settings.randomOrder}
              onChange={(checked) => updateSetting("randomOrder", checked)}
            />
            <SettingToggleRow
              title="無限ループ"
              description="最後に到達すると自動で最初に戻ります。"
              checked={settings.infiniteLoop}
              onChange={(checked) => updateSetting("infiniteLoop", checked)}
            />
            <SettingToggleRow
              title="練習エリアを表示"
              description="手書きやタイピングの練習エリアを表示します。"
              checked={settings.swipeEnabled}
              onChange={(checked) => updateSetting("swipeEnabled", checked)}
            />

            <SettingSelectRow
              title="文字の色"
              value={settings.textColor}
              options={[
                { value: "blue", label: "青" },
                { value: "black", label: "黒" },
                { value: "red", label: "赤" },
                { value: "green", label: "緑" },
              ]}
              onChange={(value) => updateSetting("textColor", value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="mt-6 w-full py-3 rounded-2xl font-bold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() => router.push(`/memorize/review/${deck.id}`)}
        >
          暗記を開始する
        </button>
      </section>
    </div>
  );
}

function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
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

function SettingToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
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
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: checked ? "1.45rem" : "0.25rem" }}
        />
      </button>
    </div>
  );
}

function SettingSelectRow({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{title}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

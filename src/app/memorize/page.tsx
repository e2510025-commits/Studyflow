"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Ellipsis,
  Edit,
  Heart,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  cardCount: number;
  dueCount: number;
  masteredCount: number;
  createdAt?: string | null;
  userName?: string;
  subjectId?: string | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

type TopTab = "decks" | "users" | "messages";
type ScopeTab = "mine" | "favorites" | "recent" | "due";

const FAVORITES_KEY = "memorize-deck-favorites";

export default function MemorizePage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [decks, setDecks] = useState<Deck[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [totalDue, setTotalDue] = useState(0);

  const [topTab, setTopTab] = useState<TopTab>("decks");
  const [scopeTab, setScopeTab] = useState<ScopeTab>("mine");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [contextMenu, setContextMenu] = useState<{ deckId: string; x: number; y: number } | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckColor, setNewDeckColor] = useState("#7c83ff");

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    void fetchDecks();
    void fetchSubjects();

    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to restore favorite deck ids:", error);
    }
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const persistFavorites = (ids: string[]) => {
    setFavoriteIds(ids);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    } catch (error) {
      console.error("Failed to persist favorite deck ids:", error);
    }
  };

  const toggleFavorite = (deckId: string) => {
    if (favoriteIds.includes(deckId)) {
      persistFavorites(favoriteIds.filter((id) => id !== deckId));
      return;
    }
    persistFavorites([...favoriteIds, deckId]);
  };

  const fetchDecks = async () => {
    try {
      const res = await fetch("/api/memorize/decks", { cache: "no-store" });
      const data = await res.json();
      setDecks(data.decks || []);
      setTotalDue(data.totalDue || 0);
    } catch (error) {
      console.error("Failed to fetch decks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/subjects", { cache: "no-store" });
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/memorize/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeckName,
          description: "",
          color: newDeckColor,
          subjectId: selectedSubject !== "all" ? selectedSubject : undefined,
        }),
      });

      if (!res.ok) {
        alert("デッキの作成に失敗しました");
        return;
      }

      const data = await res.json();
      setShowCreateModal(false);
      setNewDeckName("");
      setNewDeckColor("#7c83ff");
      await fetchDecks();
      router.push(`/memorize/deck/${data.deckId}`);
    } catch (error) {
      console.error("Failed to create deck:", error);
      alert("デッキの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleRename = (deck: Deck) => {
    setEditingDeckId(deck.id);
    setEditingName(deck.name);
    setContextMenu(null);
  };

  const saveRename = async (deckId: string) => {
    if (!editingName.trim()) {
      setEditingDeckId(null);
      return;
    }

    try {
      await fetch(`/api/memorize/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      await fetchDecks();
    } catch (error) {
      console.error("Failed to rename deck:", error);
    } finally {
      setEditingDeckId(null);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (!confirm("このデッキを削除しますか？")) return;

    try {
      await fetch(`/api/memorize/decks/${deckId}`, { method: "DELETE" });
      await fetchDecks();
      persistFavorites(favoriteIds.filter((id) => id !== deckId));
    } catch (error) {
      console.error("Failed to delete deck:", error);
    } finally {
      setContextMenu(null);
    }
  };

  const filteredDecks = useMemo(() => {
    let list = decks;

    if (selectedSubject !== "all") {
      list = list.filter((deck) => deck.subjectId === selectedSubject);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((deck) => deck.name.toLowerCase().includes(q) || deck.description.toLowerCase().includes(q));
    }

    switch (scopeTab) {
      case "favorites":
        list = list.filter((deck) => favoriteIds.includes(deck.id));
        break;
      case "recent": {
        const threshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
        list = list.filter((deck) => {
          if (!deck.createdAt) return false;
          return new Date(deck.createdAt).getTime() >= threshold;
        });
        break;
      }
      case "due":
        list = list.filter((deck) => deck.dueCount > 0);
        break;
      default:
        break;
    }

    return list;
  }, [decks, favoriteIds, scopeTab, searchQuery, selectedSubject]);

  const categories = [{ id: "all", name: "全教科", color: "#7c83ff" }, ...subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))];

  const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        ホーム &gt; 暗記
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TopActionCard icon={<Pencil size={24} />} label="つくる" onClick={() => setShowCreateModal(true)} />
        <TopActionCard
          icon={<Search size={24} />}
          label="さがす"
          onClick={() => {
            searchInputRef.current?.focus();
          }}
        />
        <TopActionCard
          icon={<BookOpen size={24} />}
          label="リスト"
          onClick={() => {
            setTopTab("decks");
            setScopeTab("mine");
            setSearchQuery("");
          }}
        />
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="grid grid-cols-3 text-sm font-bold">
          <TopTabButton active={topTab === "decks"} icon={<BookOpen size={16} />} label="単語帳" onClick={() => setTopTab("decks")} />
          <TopTabButton active={topTab === "users"} icon={<User size={16} />} label="ユーザー" onClick={() => setTopTab("users")} />
          <TopTabButton active={topTab === "messages"} icon={<MessageSquare size={16} />} label="メッセージ" onClick={() => setTopTab("messages")} />
        </div>

        <div className="p-3 border-t" style={{ borderColor: "var(--card-border)" }}>
          {topTab === "decks" ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScopePill active={scopeTab === "mine"} onClick={() => setScopeTab("mine")} label="あなたの単語帳" />
                <ScopePill active={scopeTab === "favorites"} onClick={() => setScopeTab("favorites")} label="お気に入りの単語帳" />
                <ScopePill active={scopeTab === "recent"} onClick={() => setScopeTab("recent")} label="最近使った単語帳" />
                <ScopePill active={scopeTab === "due"} onClick={() => setScopeTab("due")} label="復習待ち" />
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedSubject(cat.id)}
                    className="px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
                    style={{
                      borderColor: selectedSubject === cat.id ? cat.color : "var(--card-border)",
                      background: selectedSubject === cat.id ? `${cat.color}1f` : "transparent",
                      color: selectedSubject === cat.id ? cat.color : "var(--muted)",
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--muted)" }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="単語帳を検索"
                  className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderColor: "var(--card-border)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {loading ? (
                  <div className="col-span-full text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
                    読み込み中...
                  </div>
                ) : filteredDecks.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
                    条件に一致する単語帳がありません。
                  </div>
                ) : (
                  filteredDecks.map((deck) => (
                    <DeckBoardCard
                      key={deck.id}
                      deck={deck}
                      isFavorite={favoriteIds.includes(deck.id)}
                      isEditing={editingDeckId === deck.id}
                      editingName={editingName}
                      onEditingNameChange={setEditingName}
                      onOpen={() => router.push(`/memorize/deck/${deck.id}`)}
                      onSaveRename={() => void saveRename(deck.id)}
                      onCancelRename={() => setEditingDeckId(null)}
                      onToggleFavorite={() => toggleFavorite(deck.id)}
                      onOpenMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ deckId: deck.id, x: e.clientX, y: e.clientY });
                      }}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="text-sm rounded-xl border p-5" style={{ color: "var(--muted)", borderColor: "var(--card-border)" }}>
              {topTab === "users" ? "ユーザー発見機能は準備中です。" : "メッセージ機能は準備中です。"}
            </div>
          )}
        </div>
      </div>

      <div className="fixed right-5 bottom-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setScopeTab("favorites")}
          className="h-11 w-11 rounded-xl border flex items-center justify-center"
          style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--muted)" }}
          title="お気に入りを表示"
        >
          <Heart size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="h-11 w-11 rounded-xl border flex items-center justify-center"
          style={{
            background: "var(--primary)",
            borderColor: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
          title="新規作成"
        >
          <Plus size={18} />
        </button>
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 p-2 rounded-xl shadow-2xl border"
            style={{
              background: "var(--card)",
              borderColor: "var(--card-border)",
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              {
                icon: <BookOpen size={16} />,
                label: "編集",
                onClick: () => {
                  setContextMenu(null);
                  router.push(`/memorize/deck/${contextMenu.deckId}`);
                },
              },
              {
                icon: <Edit size={16} />,
                label: "名前変更",
                onClick: () => {
                  const targetDeck = decks.find((d) => d.id === contextMenu.deckId);
                  if (targetDeck) handleRename(targetDeck);
                },
              },
              {
                icon: <Share2 size={16} />,
                label: "共有",
                onClick: () => {
                  alert("共有機能は開発中です");
                  setContextMenu(null);
                },
              },
              {
                icon: <Trash2 size={16} />,
                label: "削除",
                danger: true,
                onClick: () => void handleDelete(contextMenu.deckId),
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full min-w-[140px] flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  color: item.danger ? "var(--danger)" : "var(--foreground)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--muted-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/45"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-5 border shadow-2xl"
              style={{ background: "var(--background)", borderColor: "var(--card-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-black mb-4" style={{ color: "var(--foreground)" }}>
                新しい単語帳を作成
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                    単語帳名
                  </label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="例: 世界史 第一次世界大戦"
                    className="w-full rounded-xl border px-3 py-2.5 outline-none"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--foreground)",
                      borderColor: "var(--card-border)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                    テーマカラー
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {["#7c83ff", "#ef8f95", "#5ea7ff", "#50c878", "#f7b267", "#9d7dfd"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewDeckColor(color)}
                        className="h-9 w-9 rounded-lg border-2"
                        style={{
                          background: color,
                          borderColor: newDeckColor === color ? "var(--foreground)" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl border font-semibold"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--foreground)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateDeck()}
                    disabled={creating || !newDeckName.trim()}
                    className="flex-1 py-2.5 rounded-xl border font-bold disabled:opacity-60"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderColor: "var(--primary)",
                    }}
                  >
                    {creating ? "作成中..." : "作成して編集"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="text-xs" style={{ color: "var(--muted)" }}>
        合計 {decks.length} 単語帳 / {totalCards} カード / 復習待ち {totalDue} 枚
      </div>
    </div>
  );
}

function TopActionCard({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border p-4 flex flex-col items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
      style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--primary)" }}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function TopTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-3 flex items-center justify-center gap-2 border-r last:border-r-0 transition-colors"
      style={{
        color: active ? "var(--primary)" : "var(--muted)",
        background: active ? "var(--primary)1f" : "transparent",
        borderColor: "var(--card-border)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ScopePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full border font-semibold transition-colors"
      style={{
        background: active ? "var(--primary)" : "var(--muted-bg)",
        color: active ? "var(--primary-foreground)" : "var(--foreground)",
        borderColor: active ? "var(--primary)" : "var(--card-border)",
      }}
    >
      {label}
    </button>
  );
}

function DeckBoardCard({
  deck,
  isFavorite,
  isEditing,
  editingName,
  onEditingNameChange,
  onOpen,
  onSaveRename,
  onCancelRename,
  onToggleFavorite,
  onOpenMenu,
}: {
  deck: Deck;
  isFavorite: boolean;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onOpen: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onToggleFavorite: () => void;
  onOpenMenu: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const progress = deck.cardCount > 0 ? Math.min(100, Math.round((deck.masteredCount / deck.cardCount) * 100)) : 0;
  const statusLabel = progress >= 90 ? "ほぼ定着" : progress >= 50 ? "1回実施" : "未実施";
  const createdLabel = deck.createdAt
    ? new Date(deck.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : "日付なし";

  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-xl border p-3" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveRename();
                if (e.key === "Escape") onCancelRename();
              }}
              onBlur={onSaveRename}
              autoFocus
              className="w-full rounded-lg border px-2 py-1.5 text-sm font-bold outline-none"
              style={{
                background: "var(--muted-bg)",
                color: "var(--foreground)",
                borderColor: "var(--card-border)",
              }}
            />
          ) : (
            <h3 className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>
              {deck.name}
            </h3>
          )}
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
            {deck.description || "説明なし"}
          </p>

          <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            <span className="inline-flex items-center gap-1"><User size={12} />{deck.userName || "あなた"}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={12} />{createdLabel}</span>
            <span className="inline-flex items-center gap-1"><BookOpen size={12} />カード {deck.cardCount}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onOpenMenu}
            className="h-7 w-7 rounded-full border flex items-center justify-center"
            style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
          >
            <Ellipsis size={14} />
          </button>

          <button
            type="button"
            onClick={onToggleFavorite}
            className="h-7 w-7 rounded-full border flex items-center justify-center"
            style={{
              borderColor: isFavorite ? "#f59e0b" : "var(--card-border)",
              color: isFavorite ? "#f59e0b" : "var(--muted)",
              background: isFavorite ? "#f59e0b1f" : "transparent",
            }}
            title="お気に入り"
          >
            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {statusLabel}
        </span>
        <DonutProgress value={progress} color={deck.color} />
      </div>
    </motion.div>
  );
}

function DonutProgress({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-11 w-11 rounded-full grid place-items-center"
        style={{
          background: `conic-gradient(${color} ${value}%, #d4d4d8 ${value}% 100%)`,
        }}
      >
        <div
          className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        >
          {value}%
        </div>
      </div>
    </div>
  );
}

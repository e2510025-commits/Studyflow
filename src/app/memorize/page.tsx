"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Clock, TrendingUp, Search, Edit, Trash2, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  cardCount: number;
  dueCount: number;
  masteredCount: number;
  subjectId?: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function MemorizePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ deckId: string; x: number; y: number } | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    fetchDecks();
    fetchSubjects();
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const fetchDecks = async () => {
    try {
      const res = await fetch("/api/memorize/decks");
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
      const res = await fetch("/api/subjects");
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  };

  const filteredDecks = useMemo(() => {
    let filtered = decks;
    
    if (selectedCategory !== "all") {
      filtered = filtered.filter(d => d.subjectId === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [decks, selectedCategory, searchQuery]);

  const handleContextMenu = (e: React.MouseEvent, deckId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ deckId, x: e.clientX, y: e.clientY });
  };

  const handleRename = (deck: Deck) => {
    setEditingDeckId(deck.id);
    setEditingName(deck.name);
    setContextMenu(null);
  };

  const saveRename = async (deckId: string) => {
    if (!editingName.trim()) return;
    
    try {
      await fetch(`/api/memorize/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      fetchDecks();
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
      fetchDecks();
    } catch (error) {
      console.error("Failed to delete deck:", error);
    }
    setContextMenu(null);
  };

  const categories = [
    { id: "all", name: "全て", color: "#6366f1" },
    ...subjects.map(s => ({ id: s.id, name: s.name, color: s.color })),
  ];

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
              暗記
            </h1>
            <p className="text-base mt-1 font-medium" style={{ color: "var(--muted)" }}>
              フラッシュカードと穴埋め問題で効率的に記憶
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalDue > 0 && (
              <div className="px-4 py-2 rounded-xl font-bold" style={{ background: "#ef444422", color: "#ef4444" }}>
                {totalDue}枚
              </div>
            )}
            <button
              onClick={() => router.push("/memorize/create-deck")}
              className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Plus size={20} />
              作成
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<BookOpen />} label="総カード数" value={decks.reduce((sum, d) => sum + d.cardCount, 0)} color="#3b82f6" />
        <StatCard icon={<Clock />} label="復習待ち" value={totalDue} color="#ef4444" />
        <StatCard icon={<TrendingUp />} label="習得済み" value={decks.reduce((sum, d) => sum + d.masteredCount, 0)} color="#22c55e" />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2" size={20} style={{ color: "var(--muted)" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="デッキを検索..."
          className="w-full pl-12 pr-4 py-3 rounded-xl outline-none"
          style={{ background: "var(--card)", color: "var(--foreground)" }}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className="px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={{
              background: selectedCategory === cat.id ? `${cat.color}22` : "var(--card)",
              color: selectedCategory === cat.id ? cat.color : "var(--muted)",
              border: selectedCategory === cat.id ? `2px solid ${cat.color}40` : "2px solid transparent",
            }}
          >
            {cat.name}
          </button>
        ))}
        <Link href="/subjects" className="px-4 py-2 rounded-xl font-semibold whitespace-nowrap flex-shrink-0 flex items-center gap-2" style={{ background: "var(--card)", color: "var(--muted)" }}>
          <Plus size={18} />
          カテゴリー追加
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>読み込み中...</div>
      ) : filteredDecks.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>
          {searchQuery ? "検索結果がありません" : "デッキがありません。右上の「作成」ボタンから新しいデッキを作成しましょう。"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDecks.map((deck) => (
            <DeckTile
              key={deck.id}
              deck={deck}
              isEditing={editingDeckId === deck.id}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onSaveRename={() => saveRename(deck.id)}
              onCancelEdit={() => setEditingDeckId(null)}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 p-2 rounded-xl shadow-2xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { icon: <Edit size={16} />, label: "名前変更", onClick: () => handleRename(decks.find(d => d.id === contextMenu.deckId)!) },
              { icon: <Share2 size={16} />, label: "共有", onClick: () => alert("共有機能は開発中です") },
              { icon: <Trash2 size={16} />, label: "削除", onClick: () => handleDelete(contextMenu.deckId), danger: true },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: item.danger ? "#ef4444" : "var(--foreground)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: "var(--card)" }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: color + "22", color }}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>{label}</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function DeckTile({
  deck,
  isEditing,
  editingName,
  onEditingNameChange,
  onSaveRename,
  onCancelEdit,
  onContextMenu,
}: {
  deck: Deck;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelEdit: () => void;
  onContextMenu: (e: React.MouseEvent, deckId: string) => void;
}) {
  const router = useRouter();
  const progress = deck.cardCount > 0 ? (deck.masteredCount / deck.cardCount) * 100 : 0;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="p-5 rounded-2xl flex items-center justify-between group"
      style={{ background: "var(--card)", borderLeft: `4px solid ${deck.color}` }}
    >
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => !isEditing && router.push(`/memorize/deck/${deck.id}`)}
      >
        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveRename();
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={onSaveRename}
            autoFocus
            className="text-lg font-bold mb-1 px-2 py-1 rounded outline-none"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>{deck.name}</h3>
        )}
        <p className="text-sm mb-2 truncate" style={{ color: "var(--muted)" }}>{deck.description || "説明なし"}</p>
        <div className="flex items-center gap-4 text-sm mb-2">
          <span style={{ color: "var(--muted)" }}>全{deck.cardCount}枚</span>
          {deck.dueCount > 0 && <span style={{ color: "#ef4444" }}>復習{deck.dueCount}枚</span>}
          <span style={{ color: "#22c55e" }}>習得{deck.masteredCount}枚</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: "var(--accent)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: deck.color }} />
        </div>
      </div>
      <div
        className="ml-4 w-24 h-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => onContextMenu(e, deck.id)}
        style={{ color: "var(--muted)" }}
      >
        <span className="text-2xl">⋮</span>
      </div>
    </motion.div>
  );
}

"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  UserPlus,
  MessageCircle,
  Trash2,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { Friend } from "@/types";

/* ─── Demo searchable users (simulate server) ──────── */
const DEMO_USERS: Omit<Friend, "addedAt">[] = [
  { uid: "10000001", name: "はるか", avatar: "🧑‍🎓" },
  { uid: "10000002", name: "けんた", avatar: "👨‍💻" },
  { uid: "10000003", name: "さくら", avatar: "👩‍🔬" },
  { uid: "10000004", name: "りょう", avatar: "📚" },
  { uid: "10000005", name: "みなみ", avatar: "✍️" },
  { uid: "10000006", name: "たいき", avatar: "🎯" },
  { uid: "10000007", name: "あおい", avatar: "💡" },
  { uid: "10000008", name: "こうき", avatar: "🔬" },
  { uid: "10000009", name: "ゆうな", avatar: "📖" },
  { uid: "10000010", name: "しょうた", avatar: "⚡" },
];

export default function FriendsPage() {
  const { friends, addFriend, removeFriend, userProfile } = useStore();
  const [query, setQuery] = useState("");
  const [copiedUid, setCopiedUid] = useState(false);

  /* ── Search results ──────────────────────────────── */
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return DEMO_USERS.filter(
      (u) =>
        u.uid !== userProfile.uid &&
        !friends.some((f) => f.uid === u.uid) &&
        (u.name.toLowerCase().includes(q) || u.uid.includes(q))
    );
  }, [query, friends, userProfile.uid]);

  const handleCopyUid = () => {
    navigator.clipboard.writeText(userProfile.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <Users size={32} style={{ color: "var(--accent)" }} />
          <h1
            className="text-3xl sm:text-4xl font-black"
            style={{ color: "var(--foreground)" }}
          >
            フレンド
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          UIDで検索してフレンドを追加しよう
        </p>
      </motion.div>

      {/* My UID Card */}
      <motion.div
        className="glass-card p-4 flex items-center justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div>
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            あなたのUID
          </span>
          <p
            className="text-xl font-black font-mono tracking-widest"
            style={{ color: "var(--accent)" }}
          >
            {userProfile.uid}
          </p>
        </div>
        <motion.button
          onClick={handleCopyUid}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: copiedUid ? "#10b98120" : "var(--muted-bg)",
            color: copiedUid ? "#10b981" : "var(--foreground)",
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {copiedUid ? <Check size={14} /> : <Copy size={14} />}
          {copiedUid ? "コピー済" : "コピー"}
        </motion.button>
      </motion.div>

      {/* Search */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前またはUIDで検索..."
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium outline-none transition-all"
            style={{
              background: "var(--muted-bg)",
              color: "var(--foreground)",
              border: "2px solid transparent",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "transparent")
            }
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--muted)" }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              className="mt-3 space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {searchResults.map((user) => (
                <motion.div
                  key={user.uid}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--muted-bg)" }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "var(--accent-light)" }}
                  >
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-bold block truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {user.name}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--muted)" }}
                    >
                      UID: {user.uid}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => {
                      addFriend(user);
                      setQuery("");
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: "var(--accent)" }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus size={14} />
                    追加
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
          {query.trim() && searchResults.length === 0 && (
            <motion.p
              className="mt-3 text-center text-sm py-4"
              style={{ color: "var(--muted)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              「{query}」に一致するユーザーが見つかりません
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Friends list */}
      <motion.div
        className="glass-card overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: "var(--card-border)" }}
        >
          <Users size={18} style={{ color: "var(--accent)" }} />
          <h2
            className="text-base font-bold"
            style={{ color: "var(--foreground)" }}
          >
            フレンド一覧
          </h2>
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
          >
            {friends.length}
          </span>
        </div>

        {friends.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users
              size={48}
              className="mx-auto mb-3"
              style={{ color: "var(--muted)", opacity: 0.3 }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              フレンドがまだいません
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              上の検索ボックスから追加してみましょう
            </p>
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "var(--card-border)" }}
          >
            {friends.map((friend, i) => (
              <motion.div
                key={friend.uid}
                className="flex items-center gap-4 px-5 py-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: "var(--muted-bg)" }}
                >
                  {friend.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm font-bold block truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {friend.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--muted)" }}
                  >
                    UID: {friend.uid}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/friends/chat/${friend.uid}`}>
                    <motion.div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                      }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <MessageCircle size={16} />
                    </motion.div>
                  </Link>
                  <motion.button
                    onClick={() => removeFriend(friend.uid)}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--muted-bg)",
                      color: "var(--muted)",
                    }}
                    whileHover={{ scale: 1.15, color: "#ef4444" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

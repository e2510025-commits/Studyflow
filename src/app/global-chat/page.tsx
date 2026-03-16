"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { Loader2, RadioTower, Send } from "lucide-react";
import {
  sendGlobalStreamMessage,
  subscribeGlobalStreamMessages,
  syncAchievementSystemEvents,
} from "@/lib/firestore/community";
import type { CommunityStreamMessage } from "@/types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GlobalChatPage() {
  const { userProfile } = useStore();
  const [rows, setRows] = useState<CommunityStreamMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return subscribeGlobalStreamMessages(setRows);
  }, []);

  useEffect(() => {
    void syncAchievementSystemEvents().catch(() => {});
    const timer = window.setInterval(() => {
      void syncAchievementSystemEvents().catch(() => {});
    }, 120_000);
    return () => window.clearInterval(timer);
  }, []);

  const grouped = useMemo(() => rows.slice(0, 80), [rows]);

  const onSend = async () => {
    if (sending || !text.trim() || !userProfile.uid) return;
    setSending(true);
    try {
      await sendGlobalStreamMessage({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: text,
      });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <RadioTower size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>StudyFlow Stream</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            学習ログと会話が流れる全体チャット
          </p>
        </div>
      </div>

      <section className="glass-card p-4 h-[58vh] overflow-y-auto space-y-2">
        {grouped.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>まだ投稿がありません。</p>
        ) : (
          grouped.map((row) => {
            const isSystem = row.kind === "system";
            const isImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
            return (
              <motion.div
                key={`${row.kind}_${row.id}`}
                className="rounded-xl px-3 py-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: isSystem ? "rgba(14,116,144,0.14)" : "var(--muted-bg)" }}
              >
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                    {isImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold" style={{ color: isSystem ? "#22d3ee" : "var(--foreground)" }}>
                      {isSystem ? "SYSTEM" : row.name}
                      <span className="ml-2 text-[10px]" style={{ color: "var(--muted)" }}>{formatTime(row.createdAt)}</span>
                    </p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{row.body}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </section>

      <section className="glass-card p-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 800))}
          placeholder="みんなに共有したい学習ログや気づきを投稿..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-xl text-sm resize-none"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <button
          onClick={() => void onSend()}
          disabled={!text.trim() || sending}
          className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
          style={{ background: "var(--accent)" }}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 投稿
        </button>
      </section>
    </div>
  );
}

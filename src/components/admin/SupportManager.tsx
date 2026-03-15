"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

type ThreadRow = {
  uid: string;
  userName: string;
  userAvatar: string;
  status: "open" | "closed";
  lastMessage: string;
  lastMessageBy: "user" | "admin";
  lastMessageAt: string;
  unreadByAdmin: boolean;
};

type Msg = {
  id: string;
  fromRole: "user" | "admin";
  message: string;
  createdAt: string;
};

export default function SupportManager() {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/support", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { threads: ThreadRow[] };
    setThreads(json.threads || []);
    if (!selectedUid && json.threads?.length) {
      setSelectedUid(json.threads[0].uid);
    }
    setLoading(false);
  }, [selectedUid]);

  const loadMessages = useCallback(async () => {
    if (!selectedUid) {
      setMessages([]);
      return;
    }
    const res = await fetch(`/api/admin/support?uid=${selectedUid}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { messages: Msg[] };
    setMessages(json.messages || []);
  }, [selectedUid]);

  useEffect(() => {
    void loadThreads();
    const id = setInterval(() => {
      void loadThreads();
    }, 5000);
    return () => clearInterval(id);
  }, [loadThreads]);

  useEffect(() => {
    void loadMessages();
    const id = setInterval(() => {
      void loadMessages();
    }, 3000);
    return () => clearInterval(id);
  }, [loadMessages]);

  const selected = useMemo(() => threads.find((t) => t.uid === selectedUid) || null, [selectedUid, threads]);

  const reply = useCallback(async () => {
    const text = message.trim();
    if (!selectedUid || !text) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", uid: selectedUid, message: text }),
      });
      if (!res.ok) {
        alert("返信に失敗しました");
        return;
      }
      setMessage("");
      await Promise.all([loadMessages(), loadThreads()]);
    } finally {
      setSending(false);
    }
  }, [loadMessages, loadThreads, message, selectedUid]);

  const toggleStatus = useCallback(async () => {
    if (!selected) return;
    const next = selected.status === "closed" ? "open" : "closed";
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setStatus", uid: selected.uid, status: next }),
    });
    if (!res.ok) {
      alert("ステータス変更に失敗しました");
      return;
    }
    await loadThreads();
  }, [loadThreads, selected]);

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>お問い合わせを読み込み中...</p>;
  }

  return (
    <section className="glass-card p-4">
      <h2 className="text-base font-bold mb-3" style={{ color: "var(--foreground)" }}>お問い合わせ管理</h2>
      <div className="grid lg:grid-cols-[320px_1fr] gap-3">
        <div className="rounded-xl p-2 max-h-[560px] overflow-y-auto space-y-2" style={{ background: "var(--muted-bg)" }}>
          {threads.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>お問い合わせはまだありません。</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.uid}
                onClick={() => setSelectedUid(t.uid)}
                className="w-full text-left rounded-xl px-3 py-2"
                style={{
                  background: selectedUid === t.uid ? "var(--accent-light)" : "#ffffff22",
                  border: selectedUid === t.uid ? "1px solid var(--accent)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{t.userName}</span>
                  {t.unreadByAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#ef444420", color: "#ef4444" }}>NEW</span>}
                </div>
                <p className="text-[11px] mt-1 truncate" style={{ color: "var(--muted)" }}>{t.lastMessage}</p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{selected.userName}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>UID: {selected.uid}</p>
                </div>
                <button
                  onClick={() => void toggleStatus()}
                  className="px-3 py-1.5 rounded text-xs font-semibold"
                  style={{
                    background: selected.status === "closed" ? "#16a34a20" : "#ef444420",
                    color: selected.status === "closed" ? "#16a34a" : "#ef4444",
                  }}
                >
                  {selected.status === "closed" ? "再オープン" : "クローズ"}
                </button>
              </div>

              <div className="rounded-xl p-2 max-h-[420px] overflow-y-auto space-y-2" style={{ background: "#ffffff22" }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl px-3 py-2 max-w-[85%]"
                    style={{
                      marginLeft: m.fromRole === "admin" ? "auto" : 0,
                      background: m.fromRole === "admin" ? "var(--accent-light)" : "#ffffff33",
                    }}
                  >
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {m.fromRole === "admin" ? "運営" : "ユーザー"} / {new Date(m.createdAt).toLocaleString("ja-JP")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{m.message}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                  rows={2}
                  className="flex-1 rounded-xl px-3 py-2 text-sm"
                  style={{ background: "#ffffff22", color: "var(--foreground)" }}
                  placeholder="返信メッセージ"
                />
                <button
                  onClick={() => void reply()}
                  disabled={sending || !message.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>左からお問い合わせを選択してください。</p>
          )}
        </div>
      </div>
    </section>
  );
}

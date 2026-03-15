"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Loader2, MessageCircleQuestion } from "lucide-react";

type SupportMessage = {
  id: string;
  fromRole: "user" | "admin";
  message: string;
  createdAt: string;
};

type SupportThread = {
  status: "open" | "closed";
  lastMessage: string;
  updatedAt: string;
};

export default function SupportPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/support", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { thread: SupportThread | null; messages: SupportMessage[] };
    setThread(json.thread);
    setMessages(json.messages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const intervalId = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(intervalId);
  }, [load]);

  const statusLabel = useMemo(() => {
    if (!thread) return "未作成";
    return thread.status === "closed" ? "クローズ" : "対応中";
  }, [thread]);

  const send = useCallback(async () => {
    const message = text.trim();
    if (!message) return;
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        alert("送信に失敗しました");
        return;
      }
      setText("");
      await load();
    } finally {
      setSending(false);
    }
  }, [load, text]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 flex items-center justify-center gap-2" style={{ color: "var(--muted)" }}>
        <Loader2 size={18} className="animate-spin" /> 読み込み中...
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>お問い合わせ</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          専用フォームで運営と1対1で会話できます。返信は通知に届きます。
        </p>
      </div>

      <section className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>ステータス</p>
          <span
            className="text-xs px-2 py-1 rounded"
            style={{
              background: statusLabel === "クローズ" ? "#ef444420" : "#22c55e20",
              color: statusLabel === "クローズ" ? "#ef4444" : "#16a34a",
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="rounded-xl p-3 max-h-[420px] overflow-y-auto space-y-2" style={{ background: "var(--muted-bg)" }}>
          {messages.length === 0 ? (
            <div className="text-sm flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <MessageCircleQuestion size={16} /> まだ会話はありません。下から送信してください。
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl px-3 py-2 max-w-[85%]"
                style={{
                  marginLeft: m.fromRole === "user" ? "auto" : 0,
                  background: m.fromRole === "user" ? "var(--accent-light)" : "#ffffff22",
                  color: "var(--foreground)",
                }}
              >
                <p className="text-[11px] mb-1" style={{ color: "var(--muted)" }}>
                  {m.fromRole === "user" ? "あなた" : "運営"} / {new Date(m.createdAt).toLocaleString("ja-JP")}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="お問い合わせ内容を入力"
            className="flex-1 px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />
          <button
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </section>
    </div>
  );
}

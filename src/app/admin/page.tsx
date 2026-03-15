"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MissionManager from "@/components/admin/MissionManager";

interface AdminOverview {
  users: number;
  profiles: number;
  activeUsers24h: number;
  studyLogs: number;
  chatMessages: number;
  friends: number;
  groups: number;
  announcements: number;
  notifications: number;
}

interface AdminUser {
  uid: string;
  name: string;
  avatar: string;
  isOfficial: boolean;
  bio: string;
  banned: boolean;
  suspendedUntil: string;
  warnings: Array<{ message: string; at: string; by: string }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [warnText, setWarnText] = useState("運営からの警告です。");
  const [dmText, setDmText] = useState("運営からの連絡です。");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const verifyAdmin = useCallback(async () => {
    setChecking(true);
    const res = await fetch("/api/admin/me", { cache: "no-store" });
    if (!res.ok) {
      setAllowed(false);
      setChecking(false);
      router.replace("/");
      return;
    }
    setAllowed(true);
    setChecking(false);
  }, [router]);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.ok) {
      setOverview((await res.json()) as AdminOverview);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { users: AdminUser[] };
      setUsers(json.users);
    } finally {
      setLoadingUsers(false);
    }
  }, [q]);

  useEffect(() => {
    void verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    if (!allowed) return;
    void loadOverview();
    void loadUsers();
  }, [allowed, loadOverview, loadUsers]);

  const act = useCallback(
    async (targetUid: string, action: string, extras?: Record<string, unknown>) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid, action, ...extras }),
      });
      if (!res.ok) {
        alert("操作に失敗しました");
        return;
      }
      await Promise.all([loadUsers(), loadOverview()]);
    },
    [loadUsers, loadOverview]
  );

  const publishAnnouncement = useCallback(async () => {
    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    if (!title || !body) return;

    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    if (!res.ok) {
      alert("お知らせ投稿に失敗しました");
      return;
    }

    setAnnouncementTitle("");
    setAnnouncementBody("");
    await loadOverview();
  }, [announcementTitle, announcementBody, loadOverview]);

  const cards = useMemo(() => {
    if (!overview) return [];
    return [
      ["ユーザー数", overview.users],
      ["プロフィール数", overview.profiles],
      ["24hアクティブ", overview.activeUsers24h],
      ["学習ログ総数", overview.studyLogs],
      ["DM総数", overview.chatMessages],
      ["フレンド関係", overview.friends],
      ["グループ数", overview.groups],
      ["お知らせ数", overview.announcements],
      ["通知数", overview.notifications],
    ] as const;
  }, [overview]);

  if (checking) {
    return <div className="max-w-4xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>管理者権限を確認中...</div>;
  }

  if (!allowed) return null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>管理者ページ</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          ユーザー管理・警告/利用停止・公式アカウント設定・お知らせ発信
        </p>
      </div>

      <section className="glass-card p-4">
        <h2 className="text-base font-bold mb-3" style={{ color: "var(--foreground)" }}>全体統計</h2>
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
              <p className="text-xl font-black" style={{ color: "var(--accent)" }}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card p-4 space-y-3">
        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>お知らせ配信</h2>
        <input
          value={announcementTitle}
          onChange={(e) => setAnnouncementTitle(e.target.value)}
          placeholder="お知らせタイトル"
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <textarea
          value={announcementBody}
          onChange={(e) => setAnnouncementBody(e.target.value)}
          rows={3}
          placeholder="本文"
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <button
          onClick={publishAnnouncement}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          お知らせを投稿
        </button>
      </section>

      <MissionManager />

      <section className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>ユーザー管理</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・UID検索"
            className="ml-auto px-3 py-2 rounded-xl text-sm w-64"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />
          <button onClick={() => void loadUsers()} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            検索
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={warnText}
            onChange={(e) => setWarnText(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            placeholder="警告メッセージ"
          />
          <input
            value={dmText}
            onChange={(e) => setDmText(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            placeholder="運営DMメッセージ"
          />
        </div>

        {loadingUsers ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>ユーザー読み込み中...</p>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {users.map((u) => (
              <div key={u.uid} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {u.name} {u.isOfficial ? <span style={{ color: "#38bdf8" }}>✓</span> : null}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>UID: {u.uid}</span>
                  {u.banned && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#ef444420", color: "#ef4444" }}>BAN中</span>}
                  {!!u.suspendedUntil && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#f59e0b20", color: "#f59e0b" }}>停止中</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => void act(u.uid, "warn", { message: warnText })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#f59e0b20", color: "#f59e0b" }}>警告</button>
                  <button onClick={() => void act(u.uid, "ban")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>BAN</button>
                  <button onClick={() => void act(u.uid, "unban")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#16a34a20", color: "#16a34a" }}>BAN解除</button>
                  <button onClick={() => void act(u.uid, "suspend", { days: 1 })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#f59e0b20", color: "#f59e0b" }}>1日停止</button>
                  <button onClick={() => void act(u.uid, "unsuspend")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#16a34a20", color: "#16a34a" }}>停止解除</button>
                  <button onClick={() => void act(u.uid, u.isOfficial ? "unofficial" : "official")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#38bdf820", color: "#38bdf8" }}>{u.isOfficial ? "公式解除" : "公式登録"}</button>
                  <button onClick={() => void act(u.uid, "dm", { message: dmText })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>DM送信</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

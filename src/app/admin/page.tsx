"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AchievementManager from "@/components/admin/AchievementManager";
import SupportManager from "@/components/admin/SupportManager";

type AdminSection = "overview" | "support" | "announcements" | "missions" | "users";

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
  droppingUsers: number;
  dropAlerts?: Array<{
    uid: string;
    prevDuration: number;
    recentDuration: number;
    dropRate: number;
  }>;
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

interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  scheduledAt?: string;
  notifyAsMissionStart?: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [dmText, setDmText] = useState("運営からの連絡です。");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementScheduledAt, setAnnouncementScheduledAt] = useState("");
  const [announcementMissionNotify, setAnnouncementMissionNotify] = useState(false);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [editingScheduledAt, setEditingScheduledAt] = useState("");
  const [editingMissionNotify, setEditingMissionNotify] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [section, setSection] = useState<AdminSection>("overview");
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [savingVersion, setSavingVersion] = useState(false);

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

  const loadAnnouncements = useCallback(async () => {
    const res = await fetch("/api/admin/announcements", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { announcements: AdminAnnouncement[] };
    setAnnouncements(json.announcements || []);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { version?: string };
    setAppVersion((json.version || "1.0.0").trim() || "1.0.0");
  }, []);

  useEffect(() => {
    void verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    if (!allowed) return;
    void loadOverview();
    void loadUsers();
    void loadAnnouncements();
    void loadSettings();
  }, [allowed, loadAnnouncements, loadOverview, loadSettings, loadUsers]);

  const saveSettings = useCallback(async () => {
    const version = appVersion.trim();
    if (!version) return;
    setSavingVersion(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        alert("バージョン保存に失敗しました");
        return;
      }
      setAppVersion(version);
    } finally {
      setSavingVersion(false);
    }
  }, [appVersion]);

  const act = useCallback(
    async (targetUid: string, action: string, extras?: Record<string, unknown>) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid, action, ...extras }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "操作に失敗しました");
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
      body: JSON.stringify({
        title,
        body,
        scheduledAt: announcementScheduledAt || null,
        notifyAsMissionStart: announcementMissionNotify,
      }),
    });

    if (!res.ok) {
      alert("お知らせ投稿に失敗しました");
      return;
    }

    setAnnouncementTitle("");
    setAnnouncementBody("");
    setAnnouncementScheduledAt("");
    setAnnouncementMissionNotify(false);
    await Promise.all([loadOverview(), loadAnnouncements()]);
  }, [announcementTitle, announcementBody, announcementScheduledAt, loadAnnouncements, loadOverview]);

  const startEditAnnouncement = useCallback((row: AdminAnnouncement) => {
    setEditingAnnouncementId(row.id);
    setEditingTitle(row.title);
    setEditingBody(row.body);
    setEditingScheduledAt(row.scheduledAt ? row.scheduledAt.slice(0, 16) : "");
    setEditingMissionNotify(Boolean(row.notifyAsMissionStart));
  }, []);

  const saveAnnouncementEdit = useCallback(async () => {
    if (!editingAnnouncementId) return;
    const title = editingTitle.trim();
    const body = editingBody.trim();
    if (!title || !body) return;

    const res = await fetch("/api/admin/announcements", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingAnnouncementId,
        title,
        body,
        scheduledAt: editingScheduledAt || null,
        notifyAsMissionStart: editingMissionNotify,
      }),
    });
    if (!res.ok) {
      alert("お知らせ更新に失敗しました");
      return;
    }

    setEditingAnnouncementId("");
    setEditingTitle("");
    setEditingBody("");
    setEditingScheduledAt("");
    setEditingMissionNotify(false);
    await loadAnnouncements();
  }, [editingAnnouncementId, editingTitle, editingBody, loadAnnouncements]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    const res = await fetch("/api/admin/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      alert("お知らせ削除に失敗しました");
      return;
    }
    if (editingAnnouncementId === id) {
      setEditingAnnouncementId("");
      setEditingTitle("");
      setEditingBody("");
    }
    await loadAnnouncements();
  }, [editingAnnouncementId, loadAnnouncements]);

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
      ["学習低下ユーザー", overview.droppingUsers],
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
          ユーザー管理・警告/利用停止・勲章設定・お知らせ発信
        </p>
      </div>

      <div className="glass-card p-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ["overview", "全体統計"],
          ["support", "お問い合わせ"],
          ["announcements", "お知らせ"],
          ["missions", "勲章"],
          ["users", "ユーザー管理"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key as AdminSection)}
            className="px-3 py-2 rounded-xl text-sm font-bold"
            style={{
              background: section === key ? "var(--accent-light)" : "var(--muted-bg)",
              color: section === key ? "var(--accent)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "overview" && (
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

          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>アプリ表示設定</h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              左下に表示されるバージョン値を変更できます
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={appVersion}
                onChange={(e) => setAppVersion(e.target.value)}
                placeholder="例: 1.1.0"
                className="px-3 py-2 rounded-xl text-sm w-52"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              />
              <button
                onClick={() => void saveSettings()}
                disabled={savingVersion || !appVersion.trim()}
                className="px-3 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                {savingVersion ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </section>
      )}

      {section === "support" && <SupportManager />}

      {section === "announcements" && (
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
          <div>
            <label className="text-xs" style={{ color: "var(--muted)" }}>予約投稿日時（任意）</label>
            <input
              type="datetime-local"
              value={announcementScheduledAt}
              onChange={(e) => setAnnouncementScheduledAt(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            <label className="mt-2 text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={announcementMissionNotify}
                onChange={(e) => setAnnouncementMissionNotify(e.target.checked)}
              />
              この投稿を「ミッション開始通知」として予約配信する
            </label>
          </div>
          <button
            onClick={publishAnnouncement}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            お知らせを投稿
          </button>

          <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>お知らせ履歴</h3>
            {announcements.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>履歴はまだありません。</p>
            ) : (
              announcements.map((row) => (
                <div key={row.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                  {editingAnnouncementId === row.id ? (
                    <div className="space-y-2">
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                      />
                      <textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                      />
                      <input
                        type="datetime-local"
                        value={editingScheduledAt}
                        onChange={(e) => setEditingScheduledAt(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                      />
                      <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
                        <input
                          type="checkbox"
                          checked={editingMissionNotify}
                          onChange={(e) => setEditingMissionNotify(e.target.checked)}
                        />
                        ミッション開始通知として配信
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => void saveAnnouncementEdit()} className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ background: "var(--accent)" }}>保存</button>
                        <button onClick={() => setEditingAnnouncementId("")} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: "#ffffff22", color: "var(--foreground)" }}>キャンセル</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{row.title}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{row.body}</p>
                      <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                        {new Date(row.createdAt).toLocaleString("ja-JP")} / by {row.createdBy}
                      </p>
                      {row.scheduledAt && (
                        <p className="text-[10px] mt-1" style={{ color: "#f59e0b" }}>
                          予約: {new Date(row.scheduledAt).toLocaleString("ja-JP")}
                        </p>
                      )}
                      {row.notifyAsMissionStart && (
                        <p className="text-[10px] mt-1" style={{ color: "#22c55e" }}>
                          ミッション開始通知: ON
                        </p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => startEditAnnouncement(row)} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>編集</button>
                        <button onClick={() => void deleteAnnouncement(row.id)} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>削除</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {section === "overview" && overview?.dropAlerts && overview.dropAlerts.length > 0 && (
        <section className="glass-card p-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>
            学習時間急減ユーザー（前週比）
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {overview.dropAlerts.map((row) => (
              <div key={row.uid} className="rounded-lg p-2 text-xs" style={{ background: "var(--muted-bg)" }}>
                <span style={{ color: "var(--foreground)" }}>UID: {row.uid}</span>
                <span className="ml-3" style={{ color: "var(--muted)" }}>
                  先週 {Math.round(row.prevDuration / 3600)}h → 今週 {Math.round(row.recentDuration / 3600)}h
                </span>
                <span className="ml-3" style={{ color: "#ef4444" }}>
                  {Math.round(row.dropRate * 100)}% 減
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {section === "missions" && <AchievementManager />}

      {section === "users" && (
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
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            placeholder="警告/BAN/停止の理由（必須）"
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
                  <button onClick={() => void act(u.uid, "warn", { reason: actionReason })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#f59e0b20", color: "#f59e0b" }}>警告</button>
                  <button onClick={() => void act(u.uid, "ban", { reason: actionReason })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>BAN</button>
                  <button onClick={() => void act(u.uid, "unban")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#16a34a20", color: "#16a34a" }}>BAN解除</button>
                  <button onClick={() => void act(u.uid, "suspend", { days: 1, reason: actionReason })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#f59e0b20", color: "#f59e0b" }}>1日停止</button>
                  <button onClick={() => void act(u.uid, "unsuspend")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#16a34a20", color: "#16a34a" }}>停止解除</button>
                  <button onClick={() => void act(u.uid, u.isOfficial ? "unofficial" : "official")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#38bdf820", color: "#38bdf8" }}>{u.isOfficial ? "公式解除" : "公式登録"}</button>
                  <button onClick={() => void act(u.uid, "dm", { message: dmText })} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>DM送信</button>
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      )}
    </div>
  );
}

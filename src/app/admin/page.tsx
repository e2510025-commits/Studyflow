"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MissionManager from "@/components/admin/MissionManager";
import SupportManager from "@/components/admin/SupportManager";

type AdminSection = "overview" | "support" | "announcements" | "missions" | "users" | "reports" | "timelineDeletes";

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

interface AdminViolationReport {
  id: string;
  targetType: "timeline" | "global_chat";
  targetId: string;
  targetUid: string;
  targetBody: string;
  reporterUid: string;
  reporterName: string;
  reason: string;
  detail: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
}

interface AdminTimelineDeletionLog {
  id: string;
  postId: string;
  postUid: string;
  postUserName: string;
  postUserAvatar: string;
  postBody: string;
  postImageUrl: string;
  postCreatedAt: string;
  deletedAt: string;
  deletedByUid: string;
  deletedByName: string;
  deletedByAvatar: string;
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
  const [manualStudyHours, setManualStudyHours] = useState("1");
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
  const [reports, setReports] = useState<AdminViolationReport[]>([]);
  const [reportNote, setReportNote] = useState("");
  const [timelineDeletionLogs, setTimelineDeletionLogs] = useState<AdminTimelineDeletionLog[]>([]);
  const [loadingTimelineDeletionLogs, setLoadingTimelineDeletionLogs] = useState(false);

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

  const loadReports = useCallback(async () => {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { reports: AdminViolationReport[] };
    setReports(json.reports || []);
  }, []);

  const loadTimelineDeletionLogs = useCallback(async () => {
    setLoadingTimelineDeletionLogs(true);
    try {
      const res = await fetch("/api/admin/timeline/deletions", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { logs: AdminTimelineDeletionLog[] };
      setTimelineDeletionLogs(json.logs || []);
    } finally {
      setLoadingTimelineDeletionLogs(false);
    }
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
    void loadReports();
    void loadTimelineDeletionLogs();
  }, [allowed, loadAnnouncements, loadOverview, loadReports, loadSettings, loadTimelineDeletionLogs, loadUsers]);

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

  const markReport = useCallback(
    async (reportId: string, status: AdminViolationReport["status"]) => {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status, adminNote: reportNote }),
      });
      if (!res.ok) {
        alert("通報ステータスの更新に失敗しました");
        return;
      }
      await loadReports();
    },
    [loadReports, reportNote]
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
          ユーザー管理・警告/利用停止・ミッション設定・お知らせ発信
        </p>
      </div>

      <div className="glass-card p-2 grid grid-cols-2 sm:grid-cols-8 gap-2">
        {[
          ["overview", "全体統計"],
          ["support", "お問い合わせ"],
          ["announcements", "お知らせ"],
          ["missions", "ミッション"],
          ["users", "ユーザー管理"],
          ["reports", "違反報告"],
          ["timelineDeletes", "削除履歴"],
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

      {section === "missions" && <MissionManager />}


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

        <div className="grid sm:grid-cols-[240px_1fr] gap-2 items-center">
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={manualStudyHours}
            onChange={(e) => setManualStudyHours(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            placeholder="追加時間(時間)"
          />
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            下の「学習時間追加」ボタンで、対象ユーザーに時間単位で手動加算できます。
          </p>
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
                  <button
                    onClick={() => void act(u.uid, "addStudyHours", { hours: Number(manualStudyHours) })}
                    className="px-2.5 py-1.5 rounded text-xs"
                    style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                  >
                    学習時間追加
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      )}

      {section === "reports" && (
        <section className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>違反報告</h2>
            <button
              onClick={() => void loadReports()}
              className="ml-auto px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              更新
            </button>
          </div>

          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="管理メモ（対応内容や判断理由）"
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />

          {reports.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>通報はありません。</p>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {reports.map((report) => {
                const moderationReason =
                  actionReason.trim() ||
                  `[通報対応] ${report.reason}${report.detail ? ` / ${report.detail}` : ""}`;
                return (
                  <div key={report.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded" style={{ background: "var(--card-bg)", color: "var(--foreground)" }}>
                        {report.targetType === "timeline" ? "タイムライン" : "全体チャット"}
                      </span>
                      <span className="px-2 py-0.5 rounded" style={{ background: "#ffffff22", color: "var(--muted)" }}>
                        {report.status}
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        {new Date(report.createdAt).toLocaleString("ja-JP")}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      理由: {report.reason}
                    </p>
                    {report.detail && (
                      <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                        詳細: {report.detail}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      対象UID: {report.targetUid} / 通報者: {report.reporterName} ({report.reporterUid})
                    </p>
                    {report.targetBody && (
                      <p className="text-xs mt-1 p-2 rounded" style={{ background: "var(--card-bg)", color: "var(--foreground)" }}>
                        投稿内容: {report.targetBody}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => void markReport(report.id, "reviewing")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#38bdf820", color: "#0284c7" }}>確認中</button>
                      <button onClick={() => void markReport(report.id, "resolved")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#16a34a20", color: "#16a34a" }}>対応済み</button>
                      <button onClick={() => void markReport(report.id, "dismissed")} className="px-2.5 py-1.5 rounded text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>却下</button>
                      <button
                        onClick={async () => {
                          await act(report.targetUid, "warn", { reason: moderationReason });
                          await markReport(report.id, "resolved");
                        }}
                        className="px-2.5 py-1.5 rounded text-xs"
                        style={{ background: "#f59e0b20", color: "#f59e0b" }}
                      >
                        警告して完了
                      </button>
                      <button
                        onClick={async () => {
                          await act(report.targetUid, "suspend", { days: 1, reason: moderationReason });
                          await markReport(report.id, "resolved");
                        }}
                        className="px-2.5 py-1.5 rounded text-xs"
                        style={{ background: "#f59e0b20", color: "#b45309" }}
                      >
                        1日停止して完了
                      </button>
                      <button
                        onClick={async () => {
                          await act(report.targetUid, "ban", { reason: moderationReason });
                          await markReport(report.id, "resolved");
                        }}
                        className="px-2.5 py-1.5 rounded text-xs"
                        style={{ background: "#ef444420", color: "#ef4444" }}
                      >
                        BANして完了
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {section === "timelineDeletes" && (
        <section className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>タイムライン削除履歴</h2>
            <button
              onClick={() => void loadTimelineDeletionLogs()}
              className="ml-auto px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              更新
            </button>
          </div>

          {loadingTimelineDeletionLogs ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>読み込み中...</p>
          ) : timelineDeletionLogs.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>削除履歴はありません。</p>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto">
              {timelineDeletionLogs.map((row) => {
                const postAvatarIsImage = row.postUserAvatar.startsWith("http") || row.postUserAvatar.startsWith("data:");
                const deleterAvatarIsImage = row.deletedByAvatar.startsWith("http") || row.deletedByAvatar.startsWith("data:");
                return (
                  <article key={row.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                      <span>投稿日時: {new Date(row.postCreatedAt).toLocaleString("ja-JP")}</span>
                      <span>削除日時: {new Date(row.deletedAt).toLocaleString("ja-JP")}</span>
                    </div>

                    <div className="mt-2 flex items-start gap-3">
                      <span className="w-9 h-9 rounded-full overflow-hidden inline-flex items-center justify-center shrink-0" style={{ background: "var(--card-bg)" }}>
                        {postAvatarIsImage ? <img src={row.postUserAvatar} alt={row.postUserName} className="w-full h-full object-cover" /> : row.postUserAvatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                          投稿者: {row.postUserName}
                          <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>UID: {row.postUid}</span>
                        </p>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: "var(--foreground)" }}>
                          {row.postBody || "(本文なし)"}
                        </p>
                        {row.postImageUrl ? (
                          <img src={row.postImageUrl} alt="deleted timeline" className="mt-2 rounded-lg max-h-44 object-cover" />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs" style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}>
                      <span className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center shrink-0" style={{ background: "var(--card-bg)" }}>
                        {deleterAvatarIsImage ? <img src={row.deletedByAvatar} alt={row.deletedByName} className="w-full h-full object-cover" /> : row.deletedByAvatar}
                      </span>
                      <span>
                        削除者: {row.deletedByName} ({row.deletedByUid})
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

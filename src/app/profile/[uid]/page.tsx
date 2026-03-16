"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import {
  canViewProfile,
  fetchProfileCheerSummary,
  fetchPublicProfile,
  fetchUserFriendsPreview,
  fetchUserHeatmap,
  fetchUserStudyStats,
  saveDisplayProfile,
  setProfileCheer,
} from "@/lib/firestore/profile";
import { subscribeActiveStudyUsers } from "@/lib/firestore/focusRoom";
import { subscribeUserPresenceStatus, subscribeUsersOnlineStatus } from "@/lib/firestore/presence";
import { getAchievementMeta } from "@/lib/achievements";
import { formatHoursMinutes } from "@/lib/utils";
import { BadgeCheck, Flame, PenLine, Send } from "lucide-react";

type PresenceColor = "online" | "away" | "offline" | "studying";

function dateKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function detectDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent.toLowerCase();
  const mobile = /iphone|ipad|android|mobile/.test(ua);
  if (mobile) {
    if (ua.includes("iphone") || ua.includes("ipad")) return "Mobile (iOS)";
    return "Mobile (Android)";
  }
  if (ua.includes("windows")) return "PC (Windows)";
  if (ua.includes("mac")) return "PC (macOS)";
  return "PC (Web)";
}

function calcRadarValues(heatmap: Record<string, number>): number[] {
  const bins = [0, 0, 0, 0, 0, 0, 0];
  Object.entries(heatmap).forEach(([key, sec]) => {
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const idx = (d.getDay() + 6) % 7;
    bins[idx] += sec;
  });
  const max = Math.max(...bins, 1);
  return bins.map((v) => v / max);
}

function polarPoint(center: number, radius: number, ratio: number, axis: number, total: number) {
  const angle = (Math.PI * 2 * axis) / total - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius * ratio,
    y: center + Math.sin(angle) * radius * ratio,
  };
}

export default function PublicProfilePage() {
  const params = useParams<{ uid?: string | string[] }>();
  const uid = useMemo(() => {
    const value = params.uid;
    return Array.isArray(value) ? value[0] : value || "";
  }, [params.uid]);

  const { userProfile, updateUserProfile } = useStore();
  const isSelf = !!uid && uid === userProfile.uid;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchPublicProfile>>>(null);
  const [stats, setStats] = useState({ totalSeconds: 0, totalSessions: 0 });
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [friends, setFriends] = useState<Array<{ uid: string; name: string; avatar: string }>>([]);
  const [friendOnlineSet, setFriendOnlineSet] = useState<Set<string>>(new Set());
  const [activeStudySet, setActiveStudySet] = useState<Set<string>>(new Set());
  const [presence, setPresence] = useState<{ isOnline: boolean; updatedAtMs: number }>({ isOnline: false, updatedAtMs: 0 });
  const [cheerCount, setCheerCount] = useState(0);
  const [cheered, setCheered] = useState(false);
  const [savingCheer, setSavingCheer] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editHeader, setEditHeader] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const visible = await canViewProfile(uid, userProfile.uid);
        if (cancelled) return;
        setAllowed(visible);
        if (!visible) return;

        const [p, s, hm, fr, cheer] = await Promise.all([
          fetchPublicProfile(uid),
          fetchUserStudyStats(uid),
          fetchUserHeatmap(uid, 84),
          fetchUserFriendsPreview(uid, 16),
          fetchProfileCheerSummary(uid, userProfile.uid),
        ]);

        if (cancelled) return;
        setProfile(p);
        setStats(s);
        setHeatmap(hm);
        setFriends(fr);
        setCheerCount(cheer.count);
        setCheered(cheer.cheeredByViewer);

        if (p) {
          setEditName(p.name || "");
          setEditBio(p.bio || "");
          setEditStatus(p.statusMessage || "");
          setEditAvatar(p.avatar || "👤");
          setEditHeader(p.headerImage || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, userProfile.uid]);

  useEffect(() => {
    return subscribeActiveStudyUsers((rows) => {
      setActiveStudySet(new Set(rows.map((r) => r.userUid)));
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeUserPresenceStatus(uid, setPresence);
  }, [uid]);

  useEffect(() => {
    const uids = friends.map((f) => f.uid);
    if (uids.length === 0) {
      setFriendOnlineSet(new Set());
      return;
    }
    return subscribeUsersOnlineStatus(uids, setFriendOnlineSet);
  }, [friends]);

  const statusColor = useMemo<PresenceColor>(() => {
    if (activeStudySet.has(uid)) return "studying";
    if (!presence.isOnline) return "offline";
    const age = Date.now() - (presence.updatedAtMs || 0);
    if (age <= 90 * 1000) return "online";
    return "away";
  }, [activeStudySet, presence.isOnline, presence.updatedAtMs, uid]);

  const statusStyle = {
    online: { bg: "#22c55e", label: "オンライン" },
    away: { bg: "#facc15", label: "離席" },
    offline: { bg: "#9ca3af", label: "オフライン" },
    studying: { bg: "#a855f7", label: "学習中" },
  }[statusColor];

  const isImageAvatar = Boolean(profile?.avatar?.startsWith("http") || profile?.avatar?.startsWith("data:"));
  const equipped = (profile?.equippedBadges || []).slice(0, 3);

  const heatDays = useMemo(() => Array.from({ length: 84 }, (_, i) => dateKey(83 - i)), []);
  const heatMax = useMemo(() => Math.max(1, ...Object.values(heatmap), 1), [heatmap]);
  const radar = useMemo(() => calcRadarValues(heatmap), [heatmap]);

  const activeSince = useMemo(() => {
    const keys = Object.keys(heatmap).sort();
    return keys[0] || "----/--/--";
  }, [heatmap]);

  const saveProfileEdit = async () => {
    if (!profile || !isSelf) return;
    setSavingProfile(true);
    try {
      const deviceLabel = profile.deviceLabel || detectDeviceLabel();
      await saveDisplayProfile({
        uid: profile.uid,
        name: editName,
        avatar: editAvatar,
        bio: editBio,
        statusMessage: editStatus,
        headerImage: editHeader,
        visibility: profile.visibility,
        dailyGoal: profile.dailyGoal,
        totalPoints: profile.totalPoints,
        bonusPoints: profile.bonusPoints || 0,
        profileSetupDone: true,
        equippedBadges: profile.equippedBadges || [],
        deviceLabel,
      });
      const next = await fetchPublicProfile(profile.uid);
      setProfile(next);
      if (next && isSelf) {
        updateUserProfile({
          name: next.name,
          avatar: next.avatar,
          statusMessage: next.statusMessage,
          headerImage: next.headerImage,
          deviceLabel: next.deviceLabel,
        });
      }
      setEditOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const updateImage = (kind: "avatar" | "header", file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("画像サイズは3MB以下にしてください");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const isHeader = kind === "header";
        const width = isHeader ? 1200 : 160;
        const height = isHeader ? 360 : 160;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const ratio = Math.max(width / img.width, height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (width - w) / 2;
        const y = (height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        const dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (kind === "header") setEditHeader(dataUrl);
        else setEditAvatar(dataUrl);
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const toggleCheer = async () => {
    if (!uid || !userProfile.uid || isSelf || savingCheer) return;
    setSavingCheer(true);
    try {
      const next = !cheered;
      await setProfileCheer(uid, userProfile.uid, next);
      setCheered(next);
      setCheerCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
    } finally {
      setSavingCheer(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (!allowed || !profile) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <p className="text-sm" style={{ color: "var(--muted)" }}>このプロフィールは表示できません。</p>
        <Link href="/friends" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          フレンドへ戻る
        </Link>
      </div>
    );
  }

  const headerBackground = profile.headerImage
    ? `url(${profile.headerImage}) center/cover`
    : "linear-gradient(135deg, #082f49, #0f172a 45%, #1e293b)";

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <section className="glass-card overflow-hidden">
        <div className="h-44 sm:h-52" style={{ background: headerBackground }} />
        <div className="p-5 -mt-10">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-end gap-4">
              <div className="relative">
                {isImageAvatar ? (
                  <img src={profile.avatar} alt={profile.name} className="w-20 h-20 rounded-full object-cover border-4" style={{ borderColor: "var(--card-bg)" }} />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4" style={{ borderColor: "var(--card-bg)", background: "var(--accent-light)" }}>
                    {profile.avatar}
                  </div>
                )}
                <span
                  className="absolute right-1 bottom-1 w-4 h-4 rounded-full border-2"
                  style={{ background: statusStyle.bg, borderColor: "var(--card-bg)" }}
                  title={statusStyle.label}
                />
              </div>
              <div>
                <h1 className="text-2xl font-black flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                  {profile.name}
                  {profile.isOfficial ? <BadgeCheck size={18} style={{ color: "#38bdf8" }} /> : null}
                </h1>
                <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>UID: {profile.uid}</p>
                <p className="text-xs mt-1" style={{ color: statusStyle.bg }}>
                  {statusStyle.label}
                  {profile.deviceLabel ? ` / ${profile.deviceLabel}` : ""}
                </p>
                {profile.statusMessage ? (
                  <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>{profile.statusMessage}</p>
                ) : null}
              </div>
            </div>
            {isSelf ? (
              <button
                onClick={() => setEditOpen(true)}
                className="px-3 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                <PenLine size={14} /> 編集
              </button>
            ) : (
              <button
                onClick={() => void toggleCheer()}
                disabled={savingCheer}
                className="px-3 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: cheered ? "#f9731622" : "var(--muted-bg)", color: cheered ? "#f97316" : "var(--foreground)" }}
              >
                <Flame size={14} /> {cheered ? "応援中" : "応援する"}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>学習時間</p>
          <p className="text-xl font-black" style={{ color: "var(--accent)" }}>{formatHoursMinutes(stats.totalSeconds)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>セッション</p>
          <p className="text-xl font-black" style={{ color: "var(--accent)" }}>{stats.totalSessions}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>ポイント</p>
          <p className="text-xl font-black" style={{ color: "var(--accent)" }}>{profile.totalPoints}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>応援数</p>
          <p className="text-xl font-black" style={{ color: "#f97316" }}>{cheerCount}</p>
        </div>
      </section>

      <section className="glass-card p-4">
        <h2 className="text-base font-black" style={{ color: "var(--foreground)" }}>装備中の勲章</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {equipped.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>装備中の勲章はありません</p>
          ) : (
            equipped.map((id) => {
              const meta = getAchievementMeta(id);
              return (
                <div key={id} className="min-w-[120px] rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                  <div
                    className="w-12 h-12 mx-auto flex items-center justify-center text-[10px] font-black"
                    style={{
                      clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
                      background: "linear-gradient(145deg,#334155,#06b6d4)",
                      color: "#ecfeff",
                    }}
                  >
                    {String(meta?.rarity || "R").slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-xs font-bold mt-2 text-center" style={{ color: "var(--foreground)" }}>
                    {meta?.title || id}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="grid xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-black" style={{ color: "var(--foreground)" }}>学習ヒートマップ</h3>
          <div className="mt-3 grid grid-cols-12 gap-1.5">
            {heatDays.map((k) => {
              const value = heatmap[k] || 0;
              const alpha = value > 0 ? Math.max(0.16, value / heatMax) : 0.04;
              return (
                <div
                  key={k}
                  className="w-full pt-[100%] rounded"
                  style={{ background: `rgba(34,211,238,${alpha.toFixed(2)})` }}
                  title={`${k} ${Math.round(value / 60)}分`}
                />
              );
            })}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-black" style={{ color: "var(--foreground)" }}>Activity Radar</h3>
          <svg viewBox="0 0 220 220" className="w-full mt-2">
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const points = Array.from({ length: 7 }, (_, i) => polarPoint(110, 84, ratio, i, 7));
              return (
                <polygon key={ratio} points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#94a3b844" />
              );
            })}
            <polygon
              points={radar
                .map((ratio, i) => polarPoint(110, 84, ratio, i, 7))
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill="rgba(34,211,238,0.32)"
              stroke="#22d3ee"
              strokeWidth={2}
            />
          </svg>
          <p className="text-xs" style={{ color: "var(--muted)" }}>曜日ごとの学習強度</p>
        </div>
      </section>

      <section className="glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black" style={{ color: "var(--foreground)" }}>フレンド / フォロワー</h3>
          <Link href="/friends" className="text-xs" style={{ color: "var(--accent)" }}>一覧へ</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {friends.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>フレンドがまだいません</p>
          ) : (
            friends.map((f) => {
              const studying = activeStudySet.has(f.uid);
              const online = friendOnlineSet.has(f.uid);
              const dot = studying ? "#a855f7" : online ? "#22c55e" : "#9ca3af";
              const isImg = f.avatar.startsWith("http") || f.avatar.startsWith("data:");
              return (
                <Link key={f.uid} href={`/friends/chat/${f.uid}`} className="rounded-xl px-2 py-2 inline-flex items-center gap-2" style={{ background: "var(--muted-bg)" }}>
                  <span className="relative">
                    {isImg ? (
                      <img src={f.avatar} alt={f.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-full inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>{f.avatar}</span>
                    )}
                    <span className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full border" style={{ background: dot, borderColor: "var(--card-bg)" }} />
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{f.name}</span>
                  <Send size={12} style={{ color: "var(--muted)" }} />
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="glass-card p-4">
        <h3 className="text-sm font-black" style={{ color: "var(--foreground)" }}>自己紹介</h3>
        <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
          {profile.bio || "自己紹介はまだ設定されていません"}
        </p>
        <div className="mt-4 text-xs space-y-1" style={{ color: "var(--muted)" }}>
          <p>System Status: Certified Scholar</p>
          <p>Active Since: {activeSince}</p>
          <p>Primary Skill: Mathematics / Science-Track</p>
        </div>
      </section>

      {editOpen && isSelf && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-5 glass-card max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black" style={{ color: "var(--foreground)" }}>プロフィール編集</h3>
              <button onClick={() => setEditOpen(false)} className="text-sm" style={{ color: "var(--muted)" }}>閉じる</button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="text-xs" style={{ color: "var(--muted)" }}>
                名前
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }} />
              </label>

              <label className="text-xs" style={{ color: "var(--muted)" }}>
                一言ステータス
                <input value={editStatus} onChange={(e) => setEditStatus(e.target.value.slice(0, 120))} placeholder="明日は模試なので夜までいません" className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }} />
              </label>

              <label className="text-xs" style={{ color: "var(--muted)" }}>
                自己紹介
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value.slice(0, 280))} rows={4} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }} />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>アイコン画像</p>
                  <button onClick={() => avatarInputRef.current?.click()} className="mt-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    アップロード
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) updateImage("avatar", file);
                  }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>ヘッダー画像</p>
                  <button onClick={() => headerInputRef.current?.click()} className="mt-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    アップロード
                  </button>
                  <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) updateImage("header", file);
                  }} />
                </div>
              </div>

              {editHeader ? (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
                  <img src={editHeader} alt="header-preview" className="w-full h-28 object-cover" />
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                キャンセル
              </button>
              <button onClick={() => void saveProfileEdit()} disabled={savingProfile} className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>
                {savingProfile ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

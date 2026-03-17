"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { useStore } from "@/store/useStore";
import {
  canViewProfile,
  fetchFollowLists,
  fetchProfileCheerSummary,
  fetchPublicProfile,
  fetchUserHeatmap,
  fetchRecentProfileActivity,
  fetchUserStudyStats,
  saveDisplayProfile,
  setFollow,
  setProfileCheer,
  subscribeFriendCount,
  subscribeFollowCounts,
  subscribeFollowState,
  type FollowListUser,
  type ProfileActivityItem,
} from "@/lib/firestore/profile";
import {
  subscribeMyRespectedGlobalPostIds,
  subscribeUserTimelinePosts,
  toggleGlobalStreamRespect,
} from "@/lib/firestore/community";
import { subscribeActiveStudyUsers } from "@/lib/firestore/focusRoom";
import { subscribeUserPresenceStatus, subscribeUsersOnlineStatus } from "@/lib/firestore/presence";
import { getAchievementMeta } from "@/lib/achievements";
import { formatHoursMinutes } from "@/lib/utils";
import { BadgeCheck, Flame, PenLine, Search, Send, Sparkles, UserRound } from "lucide-react";
import type { CommunityStreamMessage } from "@/types";

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

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "今";
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  return `${day}日前`;
}

function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
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

const SafeCropper = Cropper as unknown as React.ComponentType<Record<string, unknown>>;

async function buildCroppedImageDataUrl(params: {
  source: string;
  area: Area;
  width: number;
  height: number;
}): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = params.source;
  });

  const canvas = document.createElement("canvas");
  canvas.width = params.width;
  canvas.height = params.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");

  ctx.drawImage(
    image,
    params.area.x,
    params.area.y,
    params.area.width,
    params.area.height,
    0,
    0,
    params.width,
    params.height
  );

  return canvas.toDataURL("image/webp", 0.86);
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
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [friendCount, setFriendCount] = useState(0);
  const [followBump, setFollowBump] = useState<"following" | "followers" | "friends" | null>(null);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<"following" | "followers" | "friends">("following");
  const [followSearch, setFollowSearch] = useState("");
  const [followLists, setFollowLists] = useState<{ following: FollowListUser[]; followers: FollowListUser[]; friends: FollowListUser[] }>({
    following: [],
    followers: [],
    friends: [],
  });
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followerSet, setFollowerSet] = useState<Set<string>>(new Set());
  const [followOnlineSet, setFollowOnlineSet] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<ProfileActivityItem[]>([]);
  const [activeStudySet, setActiveStudySet] = useState<Set<string>>(new Set());
  const [presence, setPresence] = useState<{ isOnline: boolean; updatedAtMs: number }>({ isOnline: false, updatedAtMs: 0 });
  const [cheerCount, setCheerCount] = useState(0);
  const [cheered, setCheered] = useState(false);
  const [savingCheer, setSavingCheer] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editHeader, setEditHeader] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [cropKind, setCropKind] = useState<"avatar" | "header">("avatar");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [timelineRows, setTimelineRows] = useState<CommunityStreamMessage[]>([]);
  const [viewerRespectIds, setViewerRespectIds] = useState<Set<string>>(new Set());
  const [profileLikedPostIds, setProfileLikedPostIds] = useState<Set<string>>(new Set());
  const [profileTimelineTab, setProfileTimelineTab] = useState<"posts" | "replies" | "media" | "likes">("posts");

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

        const [p, s, hm, follow, cheer, recent] = await Promise.all([
          fetchPublicProfile(uid),
          fetchUserStudyStats(uid),
          fetchUserHeatmap(uid, 84),
          fetchFollowLists(uid, 300),
          fetchProfileCheerSummary(uid, userProfile.uid),
          fetchRecentProfileActivity(uid, 9),
        ]);

        if (cancelled) return;
        setProfile(p);
        setStats(s);
        setHeatmap(hm);
        setFollowLists({ following: follow.following, followers: follow.followers, friends: follow.friends });
        setFollowingSet(new Set(follow.followingSet));
        setFollowerSet(new Set(follow.followerSet));
        setFollowCounts({ following: follow.following.length, followers: follow.followers.length });
        setFriendCount(follow.friends.length);
        setCheerCount(cheer.count);
        setCheered(cheer.cheeredByViewer);
        setActivities(recent);

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
    const uids = Array.from(
      new Set([
        ...followLists.following.map((f) => f.uid),
        ...followLists.followers.map((f) => f.uid),
        ...followLists.friends.map((f) => f.uid),
      ])
    );
    if (uids.length === 0) {
      setFollowOnlineSet(new Set());
      return;
    }
    return subscribeUsersOnlineStatus(uids, setFollowOnlineSet);
  }, [followLists.friends, followLists.followers, followLists.following]);

  useEffect(() => {
    if (!uid) return;
    return subscribeFollowCounts(uid, (next) => {
      setFollowCounts((prev) => {
        if (prev.following !== next.following) setFollowBump("following");
        if (prev.followers !== next.followers) setFollowBump("followers");
        return next;
      });
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeFriendCount(uid, (nextCount) => {
      setFriendCount((prev) => {
        if (prev !== nextCount) setFollowBump("friends");
        return nextCount;
      });
    });
  }, [uid]);

  useEffect(() => {
    if (!followBump) return;
    const timer = window.setTimeout(() => setFollowBump(null), 380);
    return () => window.clearTimeout(timer);
  }, [followBump]);

  useEffect(() => {
    if (!userProfile.uid || !uid || isSelf) {
      setIsFollowingUser(false);
      return;
    }
    return subscribeFollowState(userProfile.uid, uid, setIsFollowingUser);
  }, [isSelf, uid, userProfile.uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeUserTimelinePosts(uid, setTimelineRows);
  }, [uid]);

  useEffect(() => {
    if (!userProfile.uid) {
      setViewerRespectIds(new Set());
      return;
    }
    return subscribeMyRespectedGlobalPostIds(userProfile.uid, setViewerRespectIds);
  }, [userProfile.uid]);

  useEffect(() => {
    if (!uid) {
      setProfileLikedPostIds(new Set());
      return;
    }
    return subscribeMyRespectedGlobalPostIds(uid, setProfileLikedPostIds);
  }, [uid]);

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
  const modalRows =
    followModalTab === "following"
      ? followLists.following
      : followModalTab === "followers"
      ? followLists.followers
      : followLists.friends;
  const searchText = normalizeSearchText(followSearch);
  const filteredModalRows = useMemo(() => {
    if (!searchText) return modalRows;
    return modalRows.filter((row) => {
      const name = normalizeSearchText(row.name);
      const uidText = normalizeSearchText(row.uid);
      return name.includes(searchText) || uidText.includes(searchText);
    });
  }, [modalRows, searchText]);

  const heatDays = useMemo(() => Array.from({ length: 84 }, (_, i) => dateKey(83 - i)), []);
  const heatMax = useMemo(() => Math.max(1, ...Object.values(heatmap), 1), [heatmap]);
  const radar = useMemo(() => calcRadarValues(heatmap), [heatmap]);

  const activeSince = useMemo(() => {
    const keys = Object.keys(heatmap).sort();
    return keys[0] || "----/--/--";
  }, [heatmap]);

  const profileTimelineRows = useMemo(() => {
    if (profileTimelineTab === "likes") {
      return timelineRows.filter((row) => profileLikedPostIds.has(row.id));
    }
    if (profileTimelineTab === "media") {
      return timelineRows.filter((row) => row.messageType === "image");
    }
    if (profileTimelineTab === "replies") {
      return timelineRows.filter((row) => Boolean(row.replyToId));
    }
    return timelineRows;
  }, [profileLikedPostIds, profileTimelineTab, timelineRows]);

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
    if (file.size > 8 * 1024 * 1024) {
      alert("画像サイズは8MB以下にしてください");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = String(ev.target?.result || "");
      if (!result) return;
      setCropKind(kind);
      setCropSource(result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!cropSource || !croppedAreaPixels) return;
    try {
      const isHeader = cropKind === "header";
      const dataUrl = await buildCroppedImageDataUrl({
        source: cropSource,
        area: croppedAreaPixels,
        width: isHeader ? 1500 : 160,
        height: isHeader ? 500 : 160,
      });
      if (cropKind === "header") setEditHeader(dataUrl);
      else setEditAvatar(dataUrl);
      setCropModalOpen(false);
    } catch {
      alert("画像の切り抜きに失敗しました");
    }
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

  const openFollowModal = async (tab: "following" | "followers" | "friends") => {
    setFollowModalTab(tab);
    setFollowSearch("");
    setFollowModalOpen(true);
    if (!uid) return;
    const next = await fetchFollowLists(uid, 300).catch(() => null);
    if (!next) return;
    setFollowLists({ following: next.following, followers: next.followers, friends: next.friends });
    setFollowingSet(new Set(next.followingSet));
    setFollowerSet(new Set(next.followerSet));
    setFriendCount(next.friends.length);
  };

  const toggleFollow = async () => {
    if (!userProfile.uid || !uid || isSelf || followPending) return;
    setFollowPending(true);
    try {
      const next = !isFollowingUser;
      await setFollow(userProfile.uid, uid, next);
      setIsFollowingUser(next);
    } finally {
      setFollowPending(false);
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
  const canShowFollowing = isSelf || profile.showFollowCount !== false;
  const canShowFollowers = isSelf || profile.showFollowerCount !== false;
  const canShowFriendCount = isSelf || profile.showFriendCount !== false;

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
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                    {profile.name}
                    {profile.isOfficial ? <BadgeCheck size={18} style={{ color: "#38bdf8" }} /> : null}
                  </h1>
                  {(canShowFollowing || canShowFollowers) && <span className="text-xs" style={{ color: "var(--card-border)" }}>|</span>}
                  {canShowFollowing ? (
                    <button
                      onClick={() => void openFollowModal("following")}
                      className="text-[12.5px] font-semibold px-2 py-0.5 rounded-md transition-all"
                      style={{
                        color: "#94a3b8",
                        background: followBump === "following" ? "rgba(34,211,238,0.14)" : "transparent",
                        transform: followBump === "following" ? "scale(1.06)" : "scale(1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--foreground)";
                        e.currentTarget.style.background = "rgba(148,163,184,0.14)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.background =
                          followBump === "following" ? "rgba(34,211,238,0.14)" : "transparent";
                      }}
                    >
                      {followCounts.following.toLocaleString()} フォロー
                    </button>
                  ) : null}
                  {canShowFollowers ? (
                    <button
                      onClick={() => void openFollowModal("followers")}
                      className="text-[12.5px] font-semibold px-2 py-0.5 rounded-md transition-all"
                      style={{
                        color: "#94a3b8",
                        background: followBump === "followers" ? "rgba(34,211,238,0.14)" : "transparent",
                        transform: followBump === "followers" ? "scale(1.06)" : "scale(1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--foreground)";
                        e.currentTarget.style.background = "rgba(148,163,184,0.14)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.background =
                          followBump === "followers" ? "rgba(34,211,238,0.14)" : "transparent";
                      }}
                    >
                      {followCounts.followers.toLocaleString()} フォロワー
                    </button>
                  ) : null}
                  {!isSelf ? (
                    <button
                      onClick={() => void toggleFollow()}
                      disabled={followPending}
                      className="ml-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{
                        border: "1px solid rgba(56,189,248,0.7)",
                        color: isFollowingUser ? "#38bdf8" : "var(--foreground)",
                        background: "transparent",
                      }}
                    >
                      {followPending ? "処理中..." : isFollowingUser ? "フォロー中" : "+ フォローする"}
                    </button>
                  ) : null}
                </div>
                <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>UID: {profile.uid}</p>
                <p className="text-xs mt-1" style={{ color: statusStyle.bg }}>
                  {statusStyle.label}
                  {profile.deviceLabel ? ` / ${profile.deviceLabel}` : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {profile.statusMessage ? (
                    <span
                      className="px-2.5 py-1 rounded-full text-xs"
                      style={{ background: "rgba(14,165,233,0.12)", color: "#0369a1" }}
                    >
                      {profile.statusMessage}
                    </span>
                  ) : null}
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Active Since: {activeSince}
                  </span>
                </div>
                <p
                  className="mt-2 px-3 py-2 rounded-2xl text-sm max-w-[520px]"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                >
                  {profile.bio || "一言メッセージはまだ設定されていません"}
                </p>
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
                className="px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
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
          <p className="text-xs" style={{ color: "var(--muted)" }}>応援数</p>
          <p className="text-xl font-black" style={{ color: "#f97316" }}>{cheerCount}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            役立った {Math.max(0, Number(profile.helpfulReceived || 0))}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>フレンド</p>
          <p className="text-xl font-black" style={{ color: "var(--accent)" }}>
            {canShowFriendCount ? friendCount : "--"}
          </p>
        </div>
      </section>

      <section className="glass-card p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-black" style={{ color: "var(--foreground)" }}>StudyFlow Timeline</h2>
          <div className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
            SYS.TIMELINE/{profile.uid}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            ["posts", "投稿"],
            ["replies", "返信"],
            ["media", "メディア"],
            ["likes", "いいね"],
          ].map(([key, label]) => {
            const active = profileTimelineTab === key;
            return (
              <button
                key={key}
                onClick={() => setProfileTimelineTab(key as "posts" | "replies" | "media" | "likes")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: active ? "var(--accent-light)" : "var(--muted-bg)",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          {profileTimelineRows.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>該当する投稿はありません</p>
          ) : (
            profileTimelineRows.slice(0, 60).map((row) => {
              const respectedByMe = viewerRespectIds.has(row.id);
              return (
                <article key={row.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {formatRelativeTime(row.createdAt)}
                    {row.replyToId ? " ・返信" : ""}
                  </p>
                  <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                    {row.body}
                  </p>
                  {row.messageType === "image" && row.imageUrl && (
                    <img src={row.imageUrl} alt="timeline-media" className="mt-2 rounded-lg max-h-64 object-cover" />
                  )}
                  <button
                    onClick={() => void toggleGlobalStreamRespect({ postId: row.id, uid: userProfile.uid })}
                    className="mt-2 px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                    style={{
                      background: respectedByMe ? "rgba(14,165,233,0.18)" : "var(--card-bg)",
                      color: respectedByMe ? "#0284c7" : "var(--muted)",
                    }}
                  >
                    <Sparkles size={12} /> Respect {Math.max(0, Number(row.respectCount || 0))}
                  </button>
                </article>
              );
            })
          )}
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

      <section className="glass-card p-5">
        <h3 className="text-sm font-black" style={{ color: "var(--foreground)" }}>アクティビティ</h3>
        <div className="mt-3 space-y-2">
          {activities.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>最近のアクティビティはまだありません</p>
          ) : (
            activities.map((item) => (
              <div key={item.id} className="rounded-xl px-3 py-2" style={{ background: "var(--muted-bg)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {item.type === "badge" ? "勲章" : "学習"}・{item.label}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {item.detail || ""} {formatRelativeTime(item.createdAt)}
                </p>
              </div>
            ))
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

      {followModalOpen && (
        <div className="fixed inset-0 z-[118] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.68)" }}>
          <div className="w-full max-w-2xl rounded-2xl glass-card p-4 max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>
                {followModalTab === "following" ? "フォロー一覧" : "フォロワー一覧"}
              </h3>
              <button onClick={() => setFollowModalOpen(false)} className="text-sm" style={{ color: "var(--muted)" }}>
                閉じる
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setFollowModalTab("following")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: followModalTab === "following" ? "var(--accent-light)" : "var(--muted-bg)",
                  color: followModalTab === "following" ? "var(--accent)" : "var(--muted)",
                }}
              >
                フォロー {followCounts.following}
              </button>
              <button
                onClick={() => setFollowModalTab("followers")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: followModalTab === "followers" ? "var(--accent-light)" : "var(--muted-bg)",
                  color: followModalTab === "followers" ? "var(--accent)" : "var(--muted)",
                }}
              >
                フォロワー {followCounts.followers}
              </button>
              <button
                onClick={() => setFollowModalTab("friends")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: followModalTab === "friends" ? "var(--accent-light)" : "var(--muted-bg)",
                  color: followModalTab === "friends" ? "var(--accent)" : "var(--muted)",
                }}
              >
                フレンド {friendCount}
              </button>
            </div>

            <div className="mt-3 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input
                value={followSearch}
                onChange={(e) => setFollowSearch(e.target.value)}
                placeholder="名前・UIDで検索"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              />
            </div>

            <div className="mt-3 overflow-y-auto pr-1 space-y-2">
              {filteredModalRows.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>該当ユーザーがいません</p>
              ) : (
                filteredModalRows.map((row) => {
                  const isImg = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
                  const studying = activeStudySet.has(row.uid);
                  const online = followOnlineSet.has(row.uid);
                  const dot = studying ? "#a855f7" : online ? "#22c55e" : "#9ca3af";
                  const isMutual = followingSet.has(row.uid) && followerSet.has(row.uid);
                  return (
                    <div key={`${followModalTab}_${row.uid}`} className="rounded-xl px-3 py-2.5" style={{ background: "var(--muted-bg)" }}>
                      <div className="flex items-center gap-3">
                        <span className="relative">
                          {isImg ? (
                            <img src={row.avatar} alt={row.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="w-10 h-10 rounded-full inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>{row.avatar}</span>
                          )}
                          <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full border" style={{ background: dot, borderColor: "var(--card-bg)" }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{row.name}</p>
                          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>UID: {row.uid}</p>
                        </div>
                        {followModalTab === "friends" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.16)", color: "#22c55e" }}>
                            FRIEND
                          </span>
                        ) : isMutual ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(34,211,238,0.16)", color: "#22d3ee" }}>
                            相互
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Link href={`/profile/${row.uid}`} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: "var(--card-bg)", color: "var(--foreground)" }}>
                          プロフィールを見る
                        </Link>
                        {row.uid !== userProfile.uid ? (
                          <Link href={`/friends/chat/${row.uid}`} className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                            <Send size={12} /> メッセージ
                          </Link>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1" style={{ background: "var(--card-bg)", color: "var(--muted)" }}>
                            <UserRound size={12} /> あなた
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {cropModalOpen && (
        <div className="fixed inset-0 z-[119] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.72)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-4 glass-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>
                {cropKind === "header" ? "ヘッダー画像を調整" : "アイコン画像を調整"}
              </h3>
              <button onClick={() => setCropModalOpen(false)} className="text-sm" style={{ color: "var(--muted)" }}>
                閉じる
              </button>
            </div>
            <div className="mt-3 relative w-full overflow-hidden rounded-xl" style={{ background: "#0b1120", height: 360 }}>
              <SafeCropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={cropKind === "header" ? 3 : 1}
                cropShape={cropKind === "avatar" ? "round" : "rect"}
                showGrid={cropKind === "header"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_: Area, areaPixels: Area) => setCroppedAreaPixels(areaPixels)}
              />
            </div>
            <div className="mt-3">
              <p className="text-xs" style={{ color: "var(--muted)" }}>ズーム</p>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                {cropKind === "header" ? "出力サイズ: 1500 x 500" : "出力サイズ: 160 x 160"}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setCropModalOpen(false)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void applyCrop()}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                この範囲で保存
              </button>
            </div>
          </div>
        </div>
      )}

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



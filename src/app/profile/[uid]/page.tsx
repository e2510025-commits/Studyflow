"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import { fetchPublicProfile, canViewProfile, fetchUserStudyStats } from "@/lib/firestore/profile";
import { formatHoursMinutes } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

export default function PublicProfilePage() {
  const params = useParams<{ uid?: string | string[] }>();
  const uid = useMemo(() => {
    const value = params.uid;
    return Array.isArray(value) ? value[0] : value || "";
  }, [params.uid]);
  const { userProfile } = useStore();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchPublicProfile>>>(null);
  const [stats, setStats] = useState({ totalSeconds: 0, totalSessions: 0 });

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

        const [p, s] = await Promise.all([
          fetchPublicProfile(uid),
          fetchUserStudyStats(uid),
        ]);
        if (cancelled) return;
        setProfile(p);
        setStats(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, userProfile.uid]);

  if (loading) {
    return <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>読み込み中...</div>;
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

  const isImageAvatar = profile.avatar.startsWith("http") || profile.avatar.startsWith("data:");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <section className="glass-card p-5">
        <div className="flex items-center gap-4">
          {isImageAvatar ? (
            <img src={profile.avatar} alt={profile.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: "var(--accent-light)" }}>
              {profile.avatar}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black flex items-center gap-1" style={{ color: "var(--foreground)" }}>
              {profile.name}
              {profile.isOfficial ? <BadgeCheck size={18} style={{ color: "#38bdf8" }} /> : null}
            </h1>
            <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>UID: {profile.uid}</p>
          </div>
        </div>
      </section>

      <section className="glass-card p-5 space-y-3">
        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>自己紹介</h2>
        <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
          {profile.bio || "自己紹介はまだ設定されていません"}
        </p>
      </section>

      <section className="glass-card p-5 grid sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>累計勉強時間</p>
          <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{formatHoursMinutes(stats.totalSeconds)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>学習セッション</p>
          <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{stats.totalSessions}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>合計ポイント</p>
          <p className="text-lg font-black" style={{ color: "var(--accent)" }}>{profile.totalPoints}</p>
        </div>
      </section>
    </div>
  );
}

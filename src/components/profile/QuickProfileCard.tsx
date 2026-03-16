"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ExternalLink, MessageCircle, X } from "lucide-react";
import { fetchPublicProfile } from "@/lib/firestore/profile";
import { subscribeUserPresenceStatus } from "@/lib/firestore/presence";
import { subscribeActiveStudyUsers } from "@/lib/firestore/focusRoom";
import { getAchievementMeta } from "@/lib/achievements";

interface QuickProfileCardProps {
  open: boolean;
  uid: string | null;
  viewerUid?: string;
  onClose: () => void;
}

function avatarNode(avatar: string, name: string) {
  const isImage = avatar.startsWith("http") || avatar.startsWith("data:");
  if (isImage) {
    return <img src={avatar} alt={name} className="w-14 h-14 rounded-full object-cover" />;
  }
  return (
    <span
      className="w-14 h-14 rounded-full inline-flex items-center justify-center text-2xl"
      style={{ background: "var(--accent-light)" }}
    >
      {avatar || "👤"}
    </span>
  );
}

export default function QuickProfileCard({ open, uid, viewerUid, onClose }: QuickProfileCardProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchPublicProfile>>>(null);
  const [presence, setPresence] = useState<{ isOnline: boolean; updatedAtMs: number }>({ isOnline: false, updatedAtMs: 0 });
  const [activeSet, setActiveSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !uid) {
      setProfile(null);
      return;
    }
    setLoading(true);
    void fetchPublicProfile(uid)
      .then((row) => setProfile(row))
      .finally(() => setLoading(false));
  }, [open, uid]);

  useEffect(() => {
    if (!open || !uid) return;
    return subscribeUserPresenceStatus(uid, setPresence);
  }, [open, uid]);

  useEffect(() => {
    if (!open) return;
    return subscribeActiveStudyUsers((rows) => {
      setActiveSet(new Set(rows.map((r) => r.userUid)));
    });
  }, [open]);

  const title = useMemo(() => {
    const badge = profile?.equippedBadges?.[0];
    if (!badge) return "New Challenger";
    return getAchievementMeta(badge)?.title || badge;
  }, [profile?.equippedBadges]);

  const status = useMemo(() => {
    if (!uid) return { label: "オフライン", color: "#9ca3af" };
    if (activeSet.has(uid)) return { label: "集中モード", color: "#38bdf8" };
    if (!presence.isOnline) return { label: "オフライン", color: "#9ca3af" };
    const age = Date.now() - (presence.updatedAtMs || 0);
    if (age <= 90_000) return { label: "オンライン", color: "#22c55e" };
    return { label: "離席", color: "#f59e0b" };
  }, [activeSet, presence.isOnline, presence.updatedAtMs, uid]);

  const canMessage = Boolean(uid && viewerUid && uid !== viewerUid);

  return (
    <AnimatePresence>
      {open && uid && (
        <>
          <motion.div
            className="fixed inset-0 z-[130]"
            style={{ background: "rgba(2,6,23,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[131] flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-4 glass-card"
              style={{ border: "1px solid var(--card-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Quick Profile
                </p>
                <button onClick={onClose} className="w-7 h-7 rounded-full inline-flex items-center justify-center" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                  <X size={14} />
                </button>
              </div>

              {loading || !profile ? (
                <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>読み込み中...</p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="relative">
                      {avatarNode(profile.avatar, profile.name)}
                      <span
                        className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border"
                        style={{ background: status.color, borderColor: "var(--card-bg)" }}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#22d3ee" }}>
                        {title}
                      </p>
                      <p className="text-base font-black truncate flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                        {profile.name}
                        {profile.isOfficial ? <BadgeCheck size={14} style={{ color: "#38bdf8" }} /> : null}
                      </p>
                      <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>UID: {profile.uid}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "var(--muted-bg)" }}>
                    <p className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {profile.statusMessage || "ステータスメッセージは未設定"}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      href={`/profile/${profile.uid}`}
                      className="px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
                      onClick={onClose}
                    >
                      <ExternalLink size={12} /> 詳細を見る
                    </Link>
                    {canMessage ? (
                      <Link
                        href={`/friends/chat/${profile.uid}`}
                        className="px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1"
                        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                        onClick={onClose}
                      >
                        <MessageCircle size={12} /> メッセージ
                      </Link>
                    ) : (
                      <div className="px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                        あなた
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

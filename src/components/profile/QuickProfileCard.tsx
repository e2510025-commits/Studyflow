"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Dialog from "@/components/ui/Dialog";
import { BadgeCheck, ExternalLink, MessageCircle } from "lucide-react";
import { fetchPublicProfile } from "@/lib/firestore/profile";
import {
  subscribeUserPresenceAgents,
  subscribeUserPresenceStatus,
  type PresenceAgentInfo,
} from "@/lib/firestore/presence";
import { subscribeActiveStudyUsers } from "@/lib/firestore/focusRoom";

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
  const [result, setResult] = useState<{ uid: string; profile: Awaited<ReturnType<typeof fetchPublicProfile>>; error: boolean } | null>(null);
  const profile = result?.uid === uid ? result.profile : null;
  const loading = result?.uid !== uid;
  const [presence, setPresence] = useState<{ isOnline: boolean; updatedAtMs: number }>({ isOnline: false, updatedAtMs: 0 });
  const [presenceAgents, setPresenceAgents] = useState<PresenceAgentInfo[]>([]);
  const [activeSet, setActiveSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !uid) return;
    let disposed = false;
    void fetchPublicProfile(uid).then((row) => {
      if (!disposed) setResult({ uid, profile: row, error: false });
    }).catch(() => {
      if (!disposed) setResult({ uid, profile: null, error: true });
    });
    return () => { disposed = true; };
  }, [open, uid]);

  useEffect(() => {
    if (!open || !uid) return;
    return subscribeUserPresenceStatus(uid, setPresence);
  }, [open, uid]);

  useEffect(() => {
    if (!open || !uid) return;
    return subscribeUserPresenceAgents(uid, setPresenceAgents);
  }, [open, uid]);

  useEffect(() => {
    if (!open) return;
    return subscribeActiveStudyUsers((rows) => {
      setActiveSet(new Set(rows.map((r) => r.userUid)));
    });
  }, [open]);


  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [open]);

  const status = useMemo(() => {
    if (!uid) return { label: "オフライン", color: "#9ca3af" };
    if (activeSet.has(uid)) return { label: "集中モード", color: "#38bdf8" };
    if (!presence.isOnline) return { label: "オフライン", color: "#9ca3af" };
    const age = now - (presence.updatedAtMs || 0);
    if (age <= 90_000) return { label: "オンライン", color: "#22c55e" };
    return { label: "離席", color: "#f59e0b" };
  }, [activeSet, presence.isOnline, presence.updatedAtMs, uid, now]);

  const canMessage = Boolean(uid && viewerUid && uid !== viewerUid);

  return (
    <Dialog open={Boolean(open && uid)} onClose={onClose} title="プロフィール">
              {loading || !profile ? (
                <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>{loading ? "読み込み中..." : result?.error ? "プロフィールを読み込めませんでした" : "プロフィールが見つかりません"}</p>
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
                    {presenceAgents.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {presenceAgents.slice(0, 4).map((agent) => (
                          <span
                            key={agent.sessionId}
                            className="px-2 py-0.5 rounded-full text-[10px]"
                            style={{
                              background: agent.isOnline ? "rgba(34,197,94,0.14)" : "var(--card-bg)",
                              color: agent.isOnline ? "#16a34a" : "var(--muted)",
                            }}
                          >
                            {agent.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      href={`/profile/${profile.uid}`}
                      className="secondary-button"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
                      onClick={onClose}
                    >
                      <ExternalLink size={12} /> 詳細を見る
                    </Link>
                    {canMessage ? (
                      <Link
                        href={`/friends/chat/${profile.uid}`}
                        className="secondary-button"
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
    </Dialog>
  );
}

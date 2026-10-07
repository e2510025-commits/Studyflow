"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellDot, X } from "lucide-react";
import {
  subscribeIncomingFriendRequests,
  respondFriendRequest,
} from "@/lib/firestore/friends";
import {
  markNotificationAsRead,
  subscribeAnnouncements,
  subscribeUserNotifications,
} from "@/lib/firestore/notifications";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import type { FriendRequest, Announcement, AppNotification } from "@/types";

function AvatarPill({ avatar }: { avatar: string }) {
  const safe = sanitizeAvatar(avatar);
  const isImage = safe.startsWith("http") || safe.startsWith("data:");
  if (isImage) {
    return <img src={safe} alt="avatar" className="w-8 h-8 rounded-full object-cover" />;
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "var(--accent-light)" }}>
      {safe}
    </div>
  );
}

export default function NotificationBell() {
  const { userProfile } = useStore();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<AppNotification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!userProfile.uid) return;
    const unsubReq = subscribeIncomingFriendRequests(userProfile.uid, setRequests);
    const unsubPersonal = subscribeUserNotifications(userProfile.uid, setPersonalNotifications);
    const unsubAnnouncements = subscribeAnnouncements((rows) => {
      // Show only recent announcements (last 7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = rows.filter((row) => new Date(row.createdAt).getTime() > sevenDaysAgo);
      setAnnouncements(recent.slice(0, 20));
    });

    return () => {
      unsubReq();
      unsubPersonal();
      unsubAnnouncements();
    };
  }, [userProfile.uid]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const unreadIds = personalNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    void Promise.all(unreadIds.map((id) => markNotificationAsRead(id))).catch(() => {});
  }, [open, personalNotifications]);

  const hasIncoming = useMemo(
    () => requests.length > 0 || personalNotifications.some((n) => !n.read) || announcements.length > 0,
    [requests, personalNotifications, announcements]
  );
  const unreadPersonalCount = useMemo(
    () => personalNotifications.filter((row) => !row.read).length,
    [personalNotifications]
  );
  const incomingCount = requests.length + unreadPersonalCount + announcements.length;

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        ref={buttonRef}
        className="icon-button relative"
        aria-label={incomingCount > 0 ? `通知、${incomingCount}件` : "通知"}
        aria-expanded={open}
        aria-controls="notification-panel"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        title="通知"
      >
        {hasIncoming ? <BellDot size={18} style={{ color: "#84cc16" }} /> : <Bell size={18} style={{ color: "var(--foreground)" }} />}
        {hasIncoming && (
          <>
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "#84cc16", color: "#052e16", boxShadow: "0 0 10px #84cc16aa" }}
            >
              {incomingCount > 99 ? "99+" : incomingCount}
            </span>
            <span
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: "0 0 0 1px #84cc1655, 0 0 12px #84cc1633" }}
            />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="notification-panel"
            className="notification-panel rounded-2xl"
            role="region"
            aria-label="通知一覧"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                通知
              </p>
              <button type="button" className="icon-button" aria-label="通知を閉じる" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}><X size={20} aria-hidden="true" /></button>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-3 space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="rounded-xl p-2.5" style={{ background: "var(--muted-bg)" }}>
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${req.fromUid}`}>
                      <AvatarPill avatar={req.fromAvatar} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "var(--foreground)" }}>
                        {sanitizeDisplayName(req.fromName)} さんからフレンド申請
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>承認または却下してください</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => respondFriendRequest(req.id, "accept")}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white"
                      style={{ background: "#16a34a" }}
                    >
                      承認
                    </button>
                    <button
                      onClick={() => respondFriendRequest(req.id, "decline")}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                      style={{ background: "#ef444420", color: "#ef4444" }}
                    >
                      却下
                    </button>
                  </div>
                </div>
              ))}

              {personalNotifications.map((row) => (
                <div key={row.id} className="rounded-xl p-2.5" style={{ background: "var(--muted-bg)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{row.title}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{row.body}</p>
                  {row.link && (
                    <Link href={row.link} className="text-[10px] mt-1 inline-block" style={{ color: "var(--accent)" }}>
                      詳細を見る
                    </Link>
                  )}
                </div>
              ))}

              {announcements.map((row) => (
                <div key={row.id} className="rounded-xl p-2.5" style={{ background: "var(--muted-bg)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>お知らせ: {row.title}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{row.body}</p>
                  <Link href="/announcements" className="text-[10px] mt-1 inline-block" style={{ color: "var(--accent)" }}>
                    お知らせ一覧へ
                  </Link>
                </div>
              ))}

              {requests.length === 0 && personalNotifications.length === 0 && announcements.length === 0 && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>新しい通知はありません</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

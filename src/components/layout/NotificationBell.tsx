"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellDot } from "lucide-react";
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

  useEffect(() => {
    if (!userProfile.uid) return;
    const unsubReq = subscribeIncomingFriendRequests(userProfile.uid, setRequests);
    const unsubPersonal = subscribeUserNotifications(userProfile.uid, setPersonalNotifications);
    const unsubAnnouncements = subscribeAnnouncements((rows) => setAnnouncements(rows.slice(0, 20)));

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
    () => requests.length > 0 || personalNotifications.some((n) => !n.read),
    [requests, personalNotifications]
  );

  return (
    <div ref={rootRef} className="fixed top-4 right-16 z-50">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-xl flex items-center justify-center glass-card relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        title="通知"
      >
        {hasIncoming ? <BellDot size={18} style={{ color: "#84cc16" }} /> : <Bell size={18} style={{ color: "var(--foreground)" }} />}
        {hasIncoming && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
            style={{ background: "#84cc16", boxShadow: "0 0 10px #84cc16aa" }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-12 right-0 w-[340px] rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                通知
              </p>
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

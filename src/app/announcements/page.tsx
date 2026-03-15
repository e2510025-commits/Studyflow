"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import {
  markNotificationAsRead,
  subscribeAnnouncements,
  subscribeUserNotifications,
} from "@/lib/firestore/notifications";
import type { Announcement, AppNotification } from "@/types";

export default function AnnouncementsPage() {
  const { userProfile } = useStore();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [criticalRows, setCriticalRows] = useState<AppNotification[]>([]);

  useEffect(() => {
    return subscribeAnnouncements(setRows);
  }, []);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUserNotifications(userProfile.uid, (notifications) => {
      setCriticalRows(
        notifications.filter(
          (row) => row.type === "warning" || row.type === "ban" || row.type === "suspend"
        )
      );
    });
  }, [userProfile.uid]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>お知らせ</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          運営からのお知らせ・重要通知
        </p>
      </div>

      {criticalRows.length > 0 && (
        <section className="space-y-3">
          {criticalRows.map((row) => {
            const isBan = row.type === "ban";
            const isSuspend = row.type === "suspend";
            const panelBg = isBan ? "#ef444420" : isSuspend ? "#f59e0b20" : "#fde04733";
            const titleColor = isBan ? "#ef4444" : isSuspend ? "#f59e0b" : "#ca8a04";
            return (
              <article key={row.id} className="rounded-2xl p-5 border-2" style={{ background: panelBg, borderColor: titleColor }}>
                <p className="text-xs font-bold tracking-wide" style={{ color: titleColor }}>
                  重要なお知らせ
                </p>
                <h2 className="text-xl font-black mt-1" style={{ color: "var(--foreground)" }}>{row.title}</h2>
                <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{row.body}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(row.createdAt).toLocaleString("ja-JP")}
                  </p>
                  {!row.read && (
                    <button
                      onClick={() => void markNotificationAsRead(row.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                    >
                      確認済みにする
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="glass-card p-6 text-sm" style={{ color: "var(--muted)" }}>お知らせはまだありません。</div>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="glass-card p-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{row.title}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {new Date(row.createdAt).toLocaleString("ja-JP")} / by {row.createdBy}
              </p>
              <p className="text-sm mt-3 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{row.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

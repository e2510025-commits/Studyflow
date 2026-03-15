"use client";

import React, { useEffect, useState } from "react";
import { subscribeAnnouncements } from "@/lib/firestore/notifications";
import type { Announcement } from "@/types";

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([]);

  useEffect(() => {
    return subscribeAnnouncements(setRows);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>お知らせ</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          運営からのお知らせ・重要通知
        </p>
      </div>

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

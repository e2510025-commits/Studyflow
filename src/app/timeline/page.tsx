"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock3, Sparkles, Waves } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  subscribeGlobalStreamMessages,
  subscribeMyRespectedGlobalPostIds,
  toggleGlobalStreamRespect,
} from "@/lib/firestore/community";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import type { CommunityStreamMessage } from "@/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TimelinePage() {
  const { userProfile } = useStore();
  const [rows, setRows] = useState<CommunityStreamMessage[]>([]);
  const [respectIds, setRespectIds] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    return subscribeGlobalStreamMessages((next) => setRows(next.filter((row) => row.kind === "user")));
  }, []);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyRespectedGlobalPostIds(userProfile.uid, setRespectIds);
  }, [userProfile.uid]);

  const feed = useMemo(() => [...rows].slice(0, 120), [rows]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Waves size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>タイムライン</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>学習ログと投稿を時系列で表示</p>
        </div>
      </div>

      <section className="glass-card p-4 space-y-3">
        {feed.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>投稿はまだありません。</p>
        ) : (
          feed.map((row) => {
            const isAvatarImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
            const respectedByMe = respectIds.has(row.id);
            return (
              <motion.article
                key={row.id}
                className="rounded-xl p-3"
                style={{ background: "var(--muted-bg)" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                    {isAvatarImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <Link href={`/profile/${row.uid}`} className="font-semibold hover:underline" style={{ color: "var(--foreground)" }}>
                        {row.name}
                      </Link>
                      <VerifiedBadge show={row.isOfficial} size={13} />
                      <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {formatTime(row.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                      {row.isDeleted ? "この投稿は削除されました" : row.body}
                    </p>
                    {row.messageType === "image" && row.imageUrl && !row.isDeleted && (
                      <img
                        src={row.imageUrl}
                        alt="timeline"
                        className="mt-2 rounded-lg max-h-72 object-cover cursor-zoom-in"
                        onClick={() => setLightboxUrl(row.imageUrl || null)}
                      />
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
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </section>

      {lightboxUrl && (
        <div className="fixed inset-0 z-30 bg-black/90 grid place-items-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="preview" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { useStore } from "@/store/useStore";
import { sendTimelinePost, subscribeTimelinePosts } from "@/lib/firestore/community";
import { fetchUserMiniProfileByDisplayName } from "@/lib/firestore/profile";
import OfficialMark from "@/components/ui/OfficialMark";
import type { CommunityStreamMessage } from "@/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MENTION_REGEX = /@([A-Za-z0-9_\u3040-\u30ff\u3400-\u9fffー-]{2,32})/g;

function collectMentionsFromText(body: string): string[] {
  const ids = new Set<string>();
  const mentionRegex = new RegExp(MENTION_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(body)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

function renderBodyWithMentions(body: string, onMentionClick?: (token: string) => void) {
  const lines = body.split("\n");
  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    const mentionRegex = new RegExp(MENTION_REGEX.source, "g");
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const token = match[1];
      parts.push(
        <button
          type="button"
          key={`${lineIndex}_${match.index}_${token}`}
          className="font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
          onClick={() => onMentionClick?.(token)}
        >
          @{token}
        </button>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <React.Fragment key={`line_${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

function QuoteCard({ quote }: { quote: NonNullable<CommunityStreamMessage["quote"]> }) {
  const router = useRouter();
  const [mentionUidByToken, setMentionUidByToken] = useState<Record<string, string>>({});

  const resolveMentionUid = useCallback(
    async (token: string): Promise<string | null> => {
      if (!token) return null;
      if (/^\d{6,}$/.test(token)) return token;
      if (mentionUidByToken[token]) return mentionUidByToken[token];
      const profile = await fetchUserMiniProfileByDisplayName(token);
      if (!profile?.uid) return null;
      setMentionUidByToken((prev) => ({ ...prev, [token]: profile.uid }));
      return profile.uid;
    },
    [mentionUidByToken]
  );

  const handleMentionNavigate = useCallback(
    async (token: string) => {
      const uid = await resolveMentionUid(token);
      if (!uid) {
        alert("ユーザーが見つかりませんでした");
        return;
      }
      router.push(`/profile/${uid}`);
    },
    [resolveMentionUid, router]
  );

  const isAvatarImage = quote.avatar.startsWith("http") || quote.avatar.startsWith("data:");
  return (
    <Link
      href={`/timeline/${quote.postId}`}
      className="mt-2 block rounded-xl border px-3 py-2"
      style={{ borderColor: "var(--glass-border)", background: "var(--card-bg)" }}
    >
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
          {isAvatarImage ? <img src={quote.avatar} alt={quote.name} className="w-full h-full object-cover" /> : quote.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>{quote.name}</span>
            <OfficialMark uid={quote.uid} isOfficial={quote.isOfficial} size={11} />
          </div>
          <p className="text-sm whitespace-pre-wrap mt-1" style={{ color: "var(--foreground)" }}>
            {quote.isDeleted ? "この投稿は削除されました" : renderBodyWithMentions(quote.body, (token) => void handleMentionNavigate(token))}
          </p>
          {quote.imageUrl && !quote.isDeleted ? <img src={quote.imageUrl} alt="quoted" className="mt-2 rounded-lg max-h-64 object-cover" /> : null}
        </div>
      </div>
    </Link>
  );
}

export default function TimelineDetailPage() {
  const router = useRouter();
  const params = useParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId || "";
  const { userProfile } = useStore();

  const [rows, setRows] = useState<CommunityStreamMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [mentionUidByToken, setMentionUidByToken] = useState<Record<string, string>>({});

  useEffect(() => {
    return subscribeTimelinePosts((next) => setRows(next.filter((row) => row.kind === "user")));
  }, []);

  const post = useMemo(() => rows.find((row) => row.id === postId) || null, [rows, postId]);
  const replies = useMemo(
    () => rows.filter((row) => row.replyToId === postId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [rows, postId]
  );

  const resolveMentionUid = useCallback(
    async (token: string): Promise<string | null> => {
      if (!token) return null;
      if (/^\d{6,}$/.test(token)) return token;
      if (mentionUidByToken[token]) return mentionUidByToken[token];
      const profile = await fetchUserMiniProfileByDisplayName(token);
      if (!profile?.uid) return null;
      setMentionUidByToken((prev) => ({ ...prev, [token]: profile.uid }));
      return profile.uid;
    },
    [mentionUidByToken]
  );

  const handleMentionNavigate = useCallback(
    async (token: string) => {
      const uid = await resolveMentionUid(token);
      if (!uid) {
        alert("ユーザーが見つかりませんでした");
        return;
      }
      router.push(`/profile/${uid}`);
    },
    [resolveMentionUid, router]
  );

  useEffect(() => {
    const mentionTokens = rows.flatMap((row) => {
      const current = collectMentionsFromText(row.body || "");
      const quoted = row.quote?.body ? collectMentionsFromText(row.quote.body) : [];
      return [...current, ...quoted];
    });
    const unresolved = Array.from(new Set(mentionTokens))
      .filter((token) => !/^\d{6,}$/.test(token) && !mentionUidByToken[token])
      .slice(0, 80);
    if (unresolved.length === 0) return;

    let active = true;
    void (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        unresolved.map(async (token) => {
          const profile = await fetchUserMiniProfileByDisplayName(token);
          if (profile?.uid) updates[token] = profile.uid;
        })
      );
      if (!active || Object.keys(updates).length === 0) return;
      setMentionUidByToken((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      active = false;
    };
  }, [mentionUidByToken, rows]);

  const submitReply = async () => {
    if (!postId || !userProfile.uid || !replyBody.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await sendTimelinePost({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: replyBody,
        replyToId: postId,
      });
      setReplyBody("");
    } finally {
      setSendingReply(false);
    }
  };

  if (!post) {
    return (
      <div className="max-w-[680px] mx-auto space-y-4">
        <button
          onClick={() => router.push("/timeline")}
          className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        >
          <ArrowLeft size={14} /> タイムラインへ戻る
        </button>
        <p className="text-sm" style={{ color: "var(--muted)" }}>投稿が見つかりませんでした。</p>
      </div>
    );
  }

  const isAvatarImage = post.avatar.startsWith("http") || post.avatar.startsWith("data:");

  return (
    <div className="max-w-[680px] mx-auto space-y-4">
      <button
        onClick={() => router.push("/timeline")}
        className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1"
        style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
      >
        <ArrowLeft size={14} /> タイムラインへ戻る
      </button>

      <section className="glass-card p-4">
        <div className="flex items-start gap-3">
          <Link
            href={`/profile/${post.uid}`}
            className="w-10 h-10 rounded-full overflow-hidden inline-flex items-center justify-center"
            style={{ background: "var(--accent-light)" }}
          >
            {isAvatarImage ? <img src={post.avatar} alt={post.name} className="w-full h-full object-cover" /> : post.avatar}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <Link href={`/profile/${post.uid}`} className="font-semibold hover:underline" style={{ color: "var(--foreground)" }}>
                {post.name}
              </Link>
              <OfficialMark uid={post.uid} isOfficial={post.isOfficial} size={13} />
              <span>{formatTime(post.createdAt)}</span>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
              {post.isDeleted ? "この投稿は削除されました" : renderBodyWithMentions(post.body, (token) => void handleMentionNavigate(token))}
            </p>
            {post.quote ? <QuoteCard quote={post.quote} /> : null}
            {post.messageType === "image" && post.imageUrl && !post.isDeleted && (
              <img src={post.imageUrl} alt="timeline" className="mt-2 rounded-lg max-h-80 object-cover" />
            )}
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              <MessageCircle size={12} className="inline mr-1" /> 返信 {Math.max(0, Number(post.replyCount || 0))}
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>返信</h2>
        {replies.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>まだ返信がありません。</p>
        ) : (
          replies.map((row) => {
            const isReplyAvatarImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
            return (
              <article key={row.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                <div className="flex items-start gap-2">
                  <Link
                    href={`/profile/${row.uid}`}
                    className="w-8 h-8 rounded-full overflow-hidden inline-flex items-center justify-center"
                    style={{ background: "var(--accent-light)" }}
                  >
                    {isReplyAvatarImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                      <Link href={`/profile/${row.uid}`} className="hover:underline" style={{ color: "var(--foreground)" }}>
                        {row.name}
                      </Link>
                      <OfficialMark uid={row.uid} isOfficial={row.isOfficial} size={11} />
                      <span>{formatTime(row.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1" style={{ color: "var(--foreground)" }}>
                      {row.isDeleted ? "この返信は削除されました" : renderBodyWithMentions(row.body, (token) => void handleMentionNavigate(token))}
                    </p>
                    {row.quote ? <QuoteCard quote={row.quote} /> : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="glass-card p-4 space-y-2">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value.slice(0, 800))}
          rows={3}
          placeholder="返信を入力"
          className="w-full px-3 py-2 rounded-xl text-sm resize-none"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <div className="flex justify-end">
          <button
            onClick={() => void submitReply()}
            disabled={!replyBody.trim() || sendingReply}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            <Send size={14} /> 返信する
          </button>
        </div>
      </section>
    </div>
  );
}

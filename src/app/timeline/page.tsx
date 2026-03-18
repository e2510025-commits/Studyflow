"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock3, Flag, Flame, ImagePlus, MessageCircle, MoreHorizontal, Pencil, Plus, Repeat2, Send, Share2, Trash2, Waves, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  deleteTimelinePost,
  editTimelinePost,
  sendTimelineImagePost,
  sendTimelinePost,
  subscribeMyLikedTimelinePostIds,
  subscribeMyRespectedTimelinePostIds,
  subscribeTimelinePosts,
  toggleTimelineLike,
  toggleTimelineRespect,
} from "@/lib/firestore/community";
import { submitViolationReport } from "@/lib/firestore/moderation";
import { isAdminUid } from "@/lib/admin";
import { fetchRecentChatPartnerUids } from "@/lib/firestore/chat";
import {
  fetchFollowLists,
  fetchUserMiniProfileByDisplayName,
  fetchUserMiniProfilesByUids,
  type UserMiniProfile,
} from "@/lib/firestore/profile";
import OfficialMark from "@/components/ui/OfficialMark";
import ImageLightbox from "@/components/ui/ImageLightbox";
import type { CommunityStreamMessage } from "@/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isVisibleTimelinePost(row: CommunityStreamMessage): boolean {
  if (row.isDeleted) return false;
  return (row.body || "").trim() !== "この投稿は削除されました";
}

const MENTION_REGEX = /@([A-Za-z0-9_\u3040-\u30ff\u3400-\u9fffー-]{2,32})/g;
const MENTION_FRAGMENT_REGEX = /^[A-Za-z0-9_\u3040-\u30ff\u3400-\u9fffー-]*$/;

function collectMentionsFromText(body: string): string[] {
  const ids = new Set<string>();
  const mentionRegex = new RegExp(MENTION_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(body)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

function renderBodyWithMentions(
  body: string,
  options?: {
    stopPropagation?: boolean;
    onMentionClick?: (token: string) => void;
  }
) {
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
          onClick={(event) => {
            if (options?.stopPropagation) event.stopPropagation();
            options?.onMentionClick?.(token);
          }}
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

function getMentionDraft(body: string, cursor: number): { start: number; query: string } | null {
  const safeCursor = Math.max(0, Math.min(cursor, body.length));
  const before = body.slice(0, safeCursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;

  const hasWhitespaceBefore = atIndex === 0 || /\s/.test(before[atIndex - 1]);
  if (!hasWhitespaceBefore) return null;

  const fragment = before.slice(atIndex + 1);
  if (!MENTION_FRAGMENT_REGEX.test(fragment)) return null;
  return { start: atIndex, query: fragment };
}

function renderQuoteNestedCard(
  quote: NonNullable<CommunityStreamMessage["quote"]>,
  options: {
    router: ReturnType<typeof useRouter>;
    onOpenImage: (url: string) => void;
    onMentionClick?: (token: string) => void;
    compact?: boolean;
  }
) {
  const isAvatarImage = quote.avatar.startsWith("http") || quote.avatar.startsWith("data:");
  return (
    <button
      type="button"
      className={`mt-2 w-full text-left rounded-xl border px-3 py-2 ${options.compact ? "text-xs" : "text-sm"}`}
      style={{ borderColor: "var(--glass-border)", background: "var(--card-bg)" }}
      onClick={(event) => {
        event.stopPropagation();
        options.router.push(`/timeline/${quote.postId}`);
      }}
      title="元の投稿を表示"
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-light)" }}
        >
          {isAvatarImage ? <img src={quote.avatar} alt={quote.name} className="w-full h-full object-cover" /> : quote.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>{quote.name}</span>
            <OfficialMark uid={quote.uid} isOfficial={quote.isOfficial} size={11} />
          </div>
          <p className="whitespace-pre-wrap mt-1" style={{ color: "var(--foreground)" }}>
            {quote.isDeleted
              ? "削除済み投稿"
              : renderBodyWithMentions(quote.body, {
                  stopPropagation: true,
                  onMentionClick: options.onMentionClick,
                })}
          </p>
          {quote.imageUrl && !quote.isDeleted ? (
            <img
              src={quote.imageUrl}
              alt="quoted"
              className="mt-2 rounded-lg max-h-48 object-cover"
              onClick={(event) => {
                event.stopPropagation();
                options.onOpenImage(quote.imageUrl || "");
              }}
            />
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function TimelinePage() {
  const router = useRouter();
  const { userProfile } = useStore();
  const [rows, setRows] = useState<CommunityStreamMessage[]>([]);
  const [respectIds, setRespectIds] = useState<Set<string>>(new Set());
  const [likeIds, setLikeIds] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [fabBootLog, setFabBootLog] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBody, setComposeBody] = useState("");
  const [composeImage, setComposeImage] = useState("");
  const [sending, setSending] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<CommunityStreamMessage | null>(null);
  const [menuPostId, setMenuPostId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [reportTarget, setReportTarget] = useState<CommunityStreamMessage | null>(null);
  const [reportReason, setReportReason] = useState("迷惑行為");
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);
  const [repostMenuPostId, setRepostMenuPostId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mentionCandidates, setMentionCandidates] = useState<UserMiniProfile[]>([]);
  const [mentionKeyword, setMentionKeyword] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionUidByToken, setMentionUidByToken] = useState<Record<string, string>>({});
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return subscribeTimelinePosts((next) =>
      setRows(next.filter((row) => row.kind === "user" && isVisibleTimelinePost(row)))
    );
  }, []);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyRespectedTimelinePostIds(userProfile.uid, setRespectIds);
  }, [userProfile.uid]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyLikedTimelinePostIds(userProfile.uid, setLikeIds);
  }, [userProfile.uid]);

  useEffect(() => {
    setIsAdmin(isAdminUid(userProfile.uid));
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          setIsAdmin(true);
        }
      } catch {
        // ignore session check failure
      }
    })();
    return () => {
      active = false;
    };
  }, [userProfile.uid]);

  useEffect(() => {
    if (!composeOpen || !userProfile.uid) return;
    let active = true;
    void (async () => {
      try {
        const [followLists, recentChatUids] = await Promise.all([
          fetchFollowLists(userProfile.uid, 180),
          fetchRecentChatPartnerUids(userProfile.uid, 40),
        ]);

        const followingUids = followLists.following.map((row) => row.uid);
        const candidateUids = Array.from(new Set([...followingUids, ...recentChatUids])).slice(0, 220);
        const profiles = await fetchUserMiniProfilesByUids(candidateUids);
        if (!active) return;

        const priority = new Map<string, number>();
        followingUids.forEach((uid, index) => priority.set(uid, index));

        const sorted = [...profiles].sort((a, b) => {
          const aPriority = priority.has(a.uid) ? priority.get(a.uid)! : 9_999;
          const bPriority = priority.has(b.uid) ? priority.get(b.uid)! : 9_999;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.name.localeCompare(b.name, "ja");
        });
        setMentionCandidates(sorted);
      } catch {
        if (!active) return;
        setMentionCandidates([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [composeOpen, userProfile.uid]);

  const feed = useMemo(() => [...rows].slice(0, 120), [rows]);

  const resolveMentionUid = useCallback(
    async (token: string): Promise<string | null> => {
      if (!token) return null;
      if (/^\d{6,}$/.test(token)) return token;

      const cached = mentionUidByToken[token];
      if (cached) return cached;

      const candidate = mentionCandidates.find((row) => row.name === token);
      if (candidate?.uid) {
        setMentionUidByToken((prev) => ({ ...prev, [token]: candidate.uid }));
        return candidate.uid;
      }

      const profile = await fetchUserMiniProfileByDisplayName(token);
      if (!profile?.uid) return null;
      setMentionUidByToken((prev) => ({ ...prev, [token]: profile.uid }));
      return profile.uid;
    },
    [mentionCandidates, mentionUidByToken]
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
    const mentionTokens = feed.flatMap((row) => {
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
          if (profile?.uid) {
            updates[token] = profile.uid;
          }
        })
      );
      if (!active || Object.keys(updates).length === 0) return;
      setMentionUidByToken((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      active = false;
    };
  }, [feed, mentionUidByToken]);

  const openComposer = () => {
    setFabBootLog(true);
    window.setTimeout(() => {
      setFabBootLog(false);
      setComposeOpen(true);
    }, 650);
  };

  const onSelectImage = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length > 700_000) {
      alert("画像サイズが大きすぎます (700KB相当以下)");
      return;
    }
    setComposeImage(dataUrl);
  };

  const submitPost = async () => {
    if (sending || !userProfile.uid) return;
    if (!composeBody.trim() && !composeImage) return;
    setSending(true);
    try {
      if (composeImage) {
        await sendTimelineImagePost({
          uid: userProfile.uid,
          name: userProfile.name,
          avatar: userProfile.avatar,
          imageUrl: composeImage,
          caption: composeBody,
        });
      } else {
        await sendTimelinePost({
          uid: userProfile.uid,
          name: userProfile.name,
          avatar: userProfile.avatar,
          body: composeBody,
          quoteTarget: quoteTarget
            ? {
                id: quoteTarget.id,
                uid: quoteTarget.uid || "",
                name: quoteTarget.name,
                avatar: quoteTarget.avatar,
                isOfficial: quoteTarget.isOfficial,
                body: quoteTarget.body,
                imageUrl: quoteTarget.imageUrl,
                isDeleted: quoteTarget.isDeleted,
                createdAt: quoteTarget.createdAt,
              }
            : undefined,
        });
      }
      setComposeBody("");
      setComposeImage("");
      setQuoteTarget(null);
      setComposeOpen(false);
      setMentionOpen(false);
      setMentionKeyword("");
    } finally {
      setSending(false);
    }
  };

  const openQuoteComposer = (row: CommunityStreamMessage) => {
    setQuoteTarget(row);
    setComposeOpen(true);
    setRepostMenuPostId("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingBody.trim()) return;
    try {
      await editTimelinePost({ postId: editingId, uid: userProfile.uid, body: editingBody });
      setEditingId("");
      setEditingBody("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "編集に失敗しました";
      if (message === "auto_study_post_locked") {
        alert("学習完了の自動投稿は編集できません");
        return;
      }
      alert(message);
    }
  };

  const removePost = async (postId: string, ownPost: boolean) => {
    try {
      if (ownPost) {
        await deleteTimelinePost({ postId, uid: userProfile.uid, mode: "soft" });
      } else {
        const response = await fetch("/api/admin/timeline/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "forbidden");
        }
      }
      setMenuPostId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除に失敗しました";
      alert(message);
    }
  };

  const sharePost = async (postId: string) => {
    const url = `${window.location.origin}/timeline/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      alert("投稿リンクをコピーしました");
    } catch {
      alert("共有に失敗しました");
    }
  };

  const handleComposerChange = (nextBody: string, cursor: number) => {
    setComposeBody(nextBody);
    const draft = getMentionDraft(nextBody, cursor);
    if (!draft) {
      setMentionOpen(false);
      setMentionKeyword("");
      return;
    }
    setMentionOpen(true);
    setMentionKeyword(draft.query.toLowerCase());
  };

  const mentionResults = useMemo(() => {
    if (!mentionOpen) return [];
    if (!mentionKeyword) return mentionCandidates.slice(0, 8);
    return mentionCandidates
      .filter((row) => row.uid.toLowerCase().includes(mentionKeyword) || row.name.toLowerCase().includes(mentionKeyword))
      .slice(0, 8);
  }, [mentionOpen, mentionKeyword, mentionCandidates]);

  const applyMention = (candidate: UserMiniProfile) => {
    const textarea = composeTextareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart || 0;
    const draft = getMentionDraft(composeBody, cursor);
    if (!draft) return;

    const head = composeBody.slice(0, draft.start);
    const tail = composeBody.slice(cursor);
    const mentionToken = /\s/.test(candidate.name) ? candidate.uid : candidate.name;
    const mentionText = `@${mentionToken} `;
    const merged = `${head}${mentionText}${tail}`;
    setComposeBody(merged);
    setMentionUidByToken((prev) => ({ ...prev, [mentionToken]: candidate.uid }));
    setMentionOpen(false);
    setMentionKeyword("");

    const nextCursor = head.length + mentionText.length;
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const sendReport = async () => {
    if (!reportTarget || reporting) return;
    setReporting(true);
    try {
      await submitViolationReport({
        targetType: "timeline",
        targetId: reportTarget.id,
        reason: reportReason,
        detail: reportDetail,
      });
      setReportTarget(null);
      setReportReason("迷惑行為");
      setReportDetail("");
      alert("通報を送信しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : "通報に失敗しました";
      alert(message);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto space-y-4 px-2 sm:px-0">
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
            const likedByMe = likeIds.has(row.id);
            const isMine = row.uid === userProfile.uid;
            const canDeleteThis = isMine || isAdmin;
            return (
              <motion.article
                key={row.id}
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: "var(--muted-bg)" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => router.push(`/timeline/${row.id}`)}
              >
                <div className="flex items-start gap-3">
                  <Link
                    href={`/profile/${row.uid}`}
                    className="w-9 h-9 rounded-full overflow-hidden inline-flex items-center justify-center"
                    style={{ background: "var(--accent-light)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAvatarImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <Link
                        href={`/profile/${row.uid}`}
                        className="font-semibold hover:underline"
                        style={{ color: "var(--foreground)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.name}
                      </Link>
                      <OfficialMark uid={row.uid} isOfficial={row.isOfficial} size={13} />
                      <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {formatTime(row.createdAt)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuPostId((prev) => (prev === row.id ? "" : row.id));
                        }}
                        className="ml-auto p-1 rounded-md"
                        style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                        title="メニュー"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    {editingId === row.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value.slice(0, 1200))}
                          rows={3}
                          className="w-full px-2 py-1.5 rounded-lg text-sm resize-none"
                          style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void saveEdit();
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-white"
                            style={{ background: "var(--accent)" }}
                          >
                            保存
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId("");
                              setEditingBody("");
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                        {renderBodyWithMentions(row.body, {
                          stopPropagation: true,
                          onMentionClick: (token) => {
                            void handleMentionNavigate(token);
                          },
                        })}
                        {row.editedAt ? <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>(編集済み)</span> : null}
                      </p>
                    )}
                    {row.quote
                      ? renderQuoteNestedCard(row.quote, {
                          router,
                          onOpenImage: (url) => setLightboxUrl(url),
                          onMentionClick: (token) => {
                            void handleMentionNavigate(token);
                          },
                          compact: true,
                        })
                      : null}
                    {menuPostId === row.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {isMine && (
                          <button
                            onClick={() => {
                              setEditingId(row.id);
                              setEditingBody(row.body || "");
                              setMenuPostId("");
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                          >
                            <Pencil size={11} /> 編集
                          </button>
                        )}
                        {canDeleteThis && (
                          <button
                            onClick={() => void removePost(row.id, isMine)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                            style={{ background: "#ef444420", color: "#ef4444" }}
                          >
                            <Trash2 size={11} /> {isMine ? "削除" : "管理削除"}
                          </button>
                        )}
                        {!isMine && (
                          <button
                            onClick={() => {
                              setReportTarget(row);
                              setMenuPostId("");
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                            style={{ background: "#f59e0b20", color: "#f59e0b" }}
                          >
                            <Flag size={11} /> 通報
                          </button>
                        )}
                      </div>
                    )}
                    {row.messageType === "image" && row.imageUrl && (
                      <img
                        src={row.imageUrl}
                        alt="timeline"
                        className="mt-2 rounded-lg max-h-72 object-cover cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxUrl(row.imageUrl || null);
                        }}
                      />
                    )}
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/timeline/${row.id}`);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg"
                        style={{ color: "var(--muted)" }}
                      >
                        <MessageCircle size={14} /> 返信 {Math.max(0, Number(row.replyCount || 0))}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRepostMenuPostId((prev) => (prev === row.id ? "" : row.id));
                        }}
                        className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg"
                        style={{ color: respectedByMe ? "#0284c7" : "var(--muted)" }}
                      >
                        <Repeat2 size={14} /> リポスト {Math.max(0, Number(row.respectCount || 0))}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleTimelineLike({ postId: row.id, uid: userProfile.uid });
                        }}
                        className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg"
                        style={{ color: likedByMe ? "#f97316" : "var(--muted)" }}
                      >
                        <Flame size={14} /> いいね {Math.max(0, Number(row.likeCount || 0))}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void sharePost(row.id);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg"
                        style={{ color: "var(--muted)" }}
                      >
                        <Share2 size={14} /> 共有
                      </button>
                    </div>
                    {repostMenuPostId === row.id && (
                      <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            void toggleTimelineRespect({ postId: row.id, uid: userProfile.uid });
                            setRepostMenuPostId("");
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                          style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                        >
                          <Repeat2 size={11} /> 通常リポスト
                        </button>
                        <button
                          onClick={() => openQuoteComposer(row)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                        >
                          <Send size={11} /> 引用リポスト
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </section>

      <ImageLightbox src={lightboxUrl} open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} zIndexClass="z-30" />

      <input
        id="timeline-image-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          void onSelectImage(file);
          e.currentTarget.value = "";
        }}
      />

      {fabBootLog && (
        <div className="fixed right-5 bottom-24 z-40 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: "rgba(15,23,42,0.92)", color: "#22d3ee" }}>
          INITIALIZING POST INTERFACE...
        </div>
      )}

      <button
        onClick={openComposer}
        className="fixed right-5 bottom-5 z-40 w-14 h-14 rounded-full text-white grid place-items-center shadow-xl"
        style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
      >
        <Plus size={24} />
      </button>

      {composeOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4"
          onClick={() => {
            setComposeOpen(false);
            setQuoteTarget(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl p-4 space-y-3" style={{ background: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>新しいポスト</h3>
              <button
                onClick={() => {
                  setComposeOpen(false);
                  setQuoteTarget(null);
                }}
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            {mentionOpen && mentionResults.length > 0 && (
              <div className="rounded-xl border p-2 max-h-44 overflow-y-auto" style={{ background: "var(--card-bg)", borderColor: "var(--glass-border)" }}>
                {mentionResults.map((candidate) => {
                  const isAvatarImage = candidate.avatar.startsWith("http") || candidate.avatar.startsWith("data:");
                  return (
                    <button
                      key={candidate.uid}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyMention(candidate)}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2"
                      style={{ color: "var(--foreground)" }}
                    >
                      <span className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                        {isAvatarImage ? <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" /> : candidate.avatar}
                      </span>
                      <span className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold">
                          {candidate.name}
                          <OfficialMark uid={candidate.uid} isOfficial={candidate.isOfficial} size={11} />
                        </span>
                        <span className="block text-[11px]" style={{ color: "var(--muted)" }}>@{candidate.uid}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <textarea
              ref={composeTextareaRef}
              value={composeBody}
              onChange={(e) => {
                const next = e.target.value.slice(0, 1200);
                handleComposerChange(next, e.target.selectionStart || 0);
              }}
              rows={5}
              placeholder="いまどうしてる？（@UID でメンション）"
              className="w-full px-3 py-2 rounded-xl text-sm resize-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            {quoteTarget && (
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>引用リポスト元</p>
                {renderQuoteNestedCard(
                  {
                    postId: quoteTarget.id,
                    uid: quoteTarget.uid || "",
                    name: quoteTarget.name,
                    avatar: quoteTarget.avatar,
                    isOfficial: quoteTarget.isOfficial,
                    body: quoteTarget.body,
                    imageUrl: quoteTarget.imageUrl,
                    isDeleted: quoteTarget.isDeleted,
                    createdAt: quoteTarget.createdAt,
                  },
                  { router, onOpenImage: (url) => setLightboxUrl(url), compact: true }
                )}
              </div>
            )}
            {composeImage && (
              <img src={composeImage} alt="compose" className="rounded-xl max-h-64 object-cover" />
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const el = document.getElementById("timeline-image-input") as HTMLInputElement | null;
                  el?.click();
                }}
                className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                <ImagePlus size={15} /> 画像
              </button>
              <button
                onClick={() => void submitPost()}
                disabled={sending || (!composeBody.trim() && !composeImage)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                <Send size={14} /> 投稿
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4" onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-md rounded-2xl p-4 space-y-3" style={{ background: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>投稿を通報</h3>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            >
              <option value="迷惑行為">迷惑行為</option>
              <option value="ハラスメント">ハラスメント</option>
              <option value="スパム">スパム</option>
              <option value="不適切な画像/文章">不適切な画像/文章</option>
              <option value="その他">その他</option>
            </select>
            <textarea
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value.slice(0, 1200))}
              rows={4}
              placeholder="詳細（任意）"
              className="w-full px-3 py-2 rounded-xl text-sm resize-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReportTarget(null)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                キャンセル
              </button>
              <button
                onClick={() => void sendReport()}
                disabled={reporting}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#f59e0b" }}
              >
                {reporting ? "送信中..." : "通報する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

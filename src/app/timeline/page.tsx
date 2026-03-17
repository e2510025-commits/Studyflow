"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock3, Flag, Flame, ImagePlus, MessageCircle, MoreHorizontal, Pencil, Plus, Repeat2, Send, Trash2, Waves, X } from "lucide-react";
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
import OfficialMark from "@/components/ui/OfficialMark";
import ImageLightbox from "@/components/ui/ImageLightbox";
import type { CommunityStreamMessage } from "@/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

  useEffect(() => {
    return subscribeTimelinePosts((next) => setRows(next.filter((row) => row.kind === "user")));
  }, []);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyRespectedTimelinePostIds(userProfile.uid, setRespectIds);
  }, [userProfile.uid]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyLikedTimelinePostIds(userProfile.uid, setLikeIds);
  }, [userProfile.uid]);

  const feed = useMemo(() => [...rows].slice(0, 120), [rows]);

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
        });
      }
      setComposeBody("");
      setComposeImage("");
      setQuoteTarget(null);
      setComposeOpen(false);
    } finally {
      setSending(false);
    }
  };

  const openQuoteComposer = (row: CommunityStreamMessage) => {
    setQuoteTarget(row);
    setComposeBody((prev) => {
      if (prev.trim()) return prev;
      return `QT @${row.name}: ${row.body.slice(0, 160)}`;
    });
    setComposeOpen(true);
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

  const removePost = async (postId: string) => {
    try {
      await deleteTimelinePost({ postId, uid: userProfile.uid, mode: "soft" });
      setMenuPostId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除に失敗しました";
      alert(message);
    }
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
                      {!row.isDeleted && (
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
                      )}
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
                        {row.isDeleted ? "この投稿は削除されました" : row.body}
                        {row.editedAt && !row.isDeleted ? <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>(編集済み)</span> : null}
                      </p>
                    )}
                    {menuPostId === row.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {isMine && !row.isDeleted && (
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
                        {isMine && (
                          <button
                            onClick={() => void removePost(row.id)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                            style={{ background: "#ef444420", color: "#ef4444" }}
                          >
                            <Trash2 size={11} /> 削除
                          </button>
                        )}
                        {!isMine && !row.isDeleted && (
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
                    {row.messageType === "image" && row.imageUrl && !row.isDeleted && (
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
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/timeline/${row.id}`);
                        }}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: "var(--muted)" }}
                      >
                        <MessageCircle size={14} /> 返信 {Math.max(0, Number(row.replyCount || 0))}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleTimelineRespect({ postId: row.id, uid: userProfile.uid });
                        }}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: respectedByMe ? "#0284c7" : "var(--muted)" }}
                      >
                        <Repeat2 size={14} /> 拡散 {Math.max(0, Number(row.respectCount || 0))}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuoteComposer(row);
                        }}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: "var(--muted)" }}
                      >
                        <Send size={14} /> 引用
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleTimelineLike({ postId: row.id, uid: userProfile.uid });
                        }}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: likedByMe ? "#f97316" : "var(--muted)" }}
                      >
                        <Flame size={14} /> {Math.max(0, Number(row.likeCount || 0))}
                      </button>
                    </div>
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
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value.slice(0, 1200))}
              rows={5}
              placeholder="いまどうしてる？"
              className="w-full px-3 py-2 rounded-xl text-sm resize-none"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            {quoteTarget && (
              <div className="rounded-lg p-2 text-xs" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                引用中: @{quoteTarget.name} - {quoteTarget.body.slice(0, 120)}
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

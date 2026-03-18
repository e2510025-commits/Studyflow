"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { BookPlus, Flag, ImagePlus, Loader2, Plus, RadioTower, Send, Sparkles } from "lucide-react";
import {
  createBulletinPost,
  deleteGlobalStreamMessage,
  editGlobalStreamMessage,
  sendGlobalStreamImageMessage,
  sendGlobalStreamMessage,
  subscribeMyRespectedGlobalPostIds,
  subscribeGlobalStreamMessages,
  syncAchievementSystemEvents,
  toggleGlobalStreamRespect,
} from "@/lib/firestore/community";
import { submitViolationReport } from "@/lib/firestore/moderation";
import OfficialMark from "@/components/ui/OfficialMark";
import ImageLightbox from "@/components/ui/ImageLightbox";
import type { BulletinCategory, CommunityStreamMessage } from "@/types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  if (hour > 0) return `${hour}h ${minute}m`;
  return `${minute}m`;
}

function isMentioned(body: string, uid: string, name: string): boolean {
  const normalized = body.toLowerCase();
  const n1 = `@${uid}`.toLowerCase();
  const n2 = `@${name}`.toLowerCase();
  return normalized.includes(n1) || (name ? normalized.includes(n2) : false);
}

function defaultForwardTitle(message: CommunityStreamMessage): string {
  const text = (message.body || "").trim();
  if (!text) return "チャットから転送";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

export default function GlobalChatPage() {
  const { userProfile, studyLogs, timer } = useStore();
  const [rows, setRows] = useState<CommunityStreamMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [menuMessageId, setMenuMessageId] = useState("");
  const [myRespectIds, setMyRespectIds] = useState<Set<string>>(new Set());
  const [forwardSource, setForwardSource] = useState<CommunityStreamMessage | null>(null);
  const [forwardTitle, setForwardTitle] = useState("");
  const [forwardCategory, setForwardCategory] = useState<BulletinCategory>("tips");
  const [forwarding, setForwarding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<CommunityStreamMessage | null>(null);
  const [reportReason, setReportReason] = useState("迷惑行為");
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    return subscribeGlobalStreamMessages(setRows);
  }, []);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyRespectedGlobalPostIds(userProfile.uid, setMyRespectIds);
  }, [userProfile.uid]);

  useEffect(() => {
    void syncAchievementSystemEvents().catch(() => {});
    const timer = window.setInterval(() => {
      void syncAchievementSystemEvents().catch(() => {});
    }, 120_000);
    return () => window.clearInterval(timer);
  }, []);

  const grouped = useMemo(() => [...rows].slice(0, 120).reverse(), [rows]);

  const myStudySeconds = useMemo(
    () => studyLogs.reduce((sum, row) => sum + (Number(row.duration) || 0), 0),
    [studyLogs]
  );

  const timerSummary = useMemo(() => {
    if (timer.mode === "stopwatch") {
      return `stopwatch ${formatDuration(timer.elapsed)} 経過`;
    }
    if (timer.mode === "countdown" || timer.mode === "pomodoro") {
      const remain = Math.max(0, timer.countdownTotal - timer.elapsed);
      return `${timer.mode} 残り ${formatDuration(remain)} (${timer.status})`;
    }
    return `${timer.mode} (${timer.status})`;
  }, [timer]);

  const runInlineCommand = async (raw: string): Promise<boolean> => {
    const cmd = raw.trim();
    if (!cmd.startsWith("/")) return false;

    if (cmd === "/stats") {
      await sendGlobalStreamMessage({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: `📊 学習状況: 累計 ${formatDuration(myStudySeconds)} / ポイント ${userProfile.totalPoints}pt`,
      });
      return true;
    }

    if (cmd === "/timer") {
      await sendGlobalStreamMessage({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: `⏱ タイマー: ${timerSummary}`,
      });
      return true;
    }

    await sendGlobalStreamMessage({
      uid: userProfile.uid,
      name: userProfile.name,
      avatar: userProfile.avatar,
      body: "利用可能コマンド: /stats /timer",
    });
    return true;
  };

  const onSend = async () => {
    if (sending || !text.trim() || !userProfile.uid) return;
    setErrorText("");
    setSending(true);
    try {
      const handled = await runInlineCommand(text);
      if (!handled) {
        await sendGlobalStreamMessage({
          uid: userProfile.uid,
          name: userProfile.name,
          avatar: userProfile.avatar,
          body: text,
        });
      }
      setText("");
      setQuickOpen(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const onShareProgress = async () => {
    if (!userProfile.uid || sending) return;
    setSending(true);
    setErrorText("");
    try {
      await sendGlobalStreamMessage({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: `📈 学習進捗を共有: 累計 ${formatDuration(myStudySeconds)} / 今日の目標 ${formatDuration(userProfile.dailyGoal)}`,
      });
      setQuickOpen(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "進捗共有に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const onSelectImage = async (file?: File | null) => {
    if (!file || !userProfile.uid || sending) return;
    if (!file.type.startsWith("image/")) {
      setErrorText("画像ファイルを選択してください");
      return;
    }
    setSending(true);
    setErrorText("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("画像読み込みに失敗しました"));
        reader.readAsDataURL(file);
      });

      if (dataUrl.length > 700_000) {
        throw new Error("画像サイズが大きすぎます (700KB相当以下)");
      }

      await sendGlobalStreamImageMessage({
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        imageUrl: dataUrl,
        caption: file.name,
      });
      setQuickOpen(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "画像送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const openForwardModal = (message: CommunityStreamMessage) => {
    setForwardSource(message);
    setForwardTitle(defaultForwardTitle(message));
    setForwardCategory("tips");
    setMenuMessageId("");
  };

  const startEdit = (message: CommunityStreamMessage) => {
    setEditingId(message.id);
    setEditingBody(message.body || "");
    setMenuMessageId("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingBody.trim()) return;
    setErrorText("");
    try {
      await editGlobalStreamMessage({ postId: editingId, uid: userProfile.uid, body: editingBody });
      setEditingId("");
      setEditingBody("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "編集に失敗しました");
    }
  };

  const removePost = async (postId: string) => {
    setErrorText("");
    try {
      await deleteGlobalStreamMessage({ postId, uid: userProfile.uid, mode: "soft" });
      setMenuMessageId("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "削除に失敗しました");
    }
  };

  const sendReport = async () => {
    if (!reportTarget || reporting) return;
    setReporting(true);
    setErrorText("");
    try {
      await submitViolationReport({
        targetType: "global_chat",
        targetId: reportTarget.id,
        reason: reportReason,
        detail: reportDetail,
      });
      setReportTarget(null);
      setReportReason("迷惑行為");
      setReportDetail("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "通報に失敗しました");
    } finally {
      setReporting(false);
    }
  };

  const forwardToBulletin = async () => {
    if (!forwardSource || !forwardTitle.trim() || forwarding) return;
    setForwarding(true);
    setErrorText("");
    try {
      const imageLine = forwardSource.messageType === "image" ? "\n[画像あり]" : "";
      await createBulletinPost({
        title: forwardTitle.trim(),
        category: forwardCategory,
        content: `> from #global-chat by ${forwardSource.name}\n> ${forwardSource.body}${imageLine}`,
      });
      setForwardSource(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "掲示板転送に失敗しました");
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full h-[calc(100dvh-7.5rem)] sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-6.5rem)] flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      <div className="flex items-center gap-3">
        <RadioTower size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>全体チャット</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            学習ログと会話をリアルタイムで共有
          </p>
        </div>
      </div>

      <section className="glass-card p-3 sm:p-4 flex-1 min-h-0 overflow-y-auto space-y-2">
        {grouped.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>まだ投稿がありません。</p>
        ) : (
          grouped.map((row, idx) => {
            const isSystem = row.kind === "system";
            const isImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
            const prev = idx > 0 ? grouped[idx - 1] : null;
            const isContinuation =
              !!prev &&
              prev.kind === row.kind &&
              prev.uid === row.uid &&
              Math.abs(new Date(row.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60_000;
            const mentionMe = !isSystem && isMentioned(row.body, userProfile.uid, userProfile.name);
            const respectedByMe = myRespectIds.has(row.id);
            const isMine = row.uid === userProfile.uid;
            return (
              <motion.div
                key={`${row.kind}_${row.id}`}
                className="rounded-xl px-2.5 py-1.5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onContextMenu={(e) => {
                  if (isSystem) return;
                  e.preventDefault();
                  setMenuMessageId((v) => (v === row.id ? "" : row.id));
                }}
                style={{
                  background: isSystem
                    ? "rgba(15,23,42,0.08)"
                    : mentionMe
                      ? "rgba(147,51,234,0.10)"
                      : "var(--muted-bg)",
                  borderLeft: mentionMe ? "3px solid #a855f7" : "3px solid transparent",
                }}
              >
                <div className="flex items-start gap-2">
                  {!isContinuation ? (
                    isSystem || !row.uid ? (
                      <span className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center mt-0.5 shrink-0" style={{ background: "var(--accent-light)" }}>
                        {isImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                      </span>
                    ) : (
                      <Link
                        href={`/profile/${row.uid}`}
                        className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center mt-0.5 shrink-0"
                        style={{ background: "var(--accent-light)" }}
                      >
                        {isImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                      </Link>
                    )
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    {!isContinuation && (
                      <p
                        className="text-[11px] font-semibold"
                        style={{
                          color: isSystem ? "#475569" : "var(--foreground)",
                          fontFamily: isSystem ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
                        }}
                      >
                        {isSystem ? "SYSTEM" : (
                          <Link href={`/profile/${row.uid}`} className="hover:underline">
                            {row.name}
                          </Link>
                        )}
                        {!isSystem && <OfficialMark uid={row.uid} isOfficial={row.isOfficial} size={12} className="ml-1 inline" />}
                        <span className="ml-2 text-[10px]" style={{ color: "var(--muted)" }}>{formatTime(row.createdAt)}</span>
                      </p>
                    )}
                    {editingId === row.id ? (
                      <div className="mt-1 space-y-2">
                        <textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value.slice(0, 800))}
                          rows={2}
                          className="w-full px-2 py-1.5 rounded-lg text-sm"
                          style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                        />
                        <div className="flex items-center gap-1">
                          <button onClick={() => void saveEdit()} className="px-2 py-1 rounded-md text-[11px] font-semibold" style={{ background: "var(--accent)", color: "white" }}>
                            保存
                          </button>
                          <button onClick={() => { setEditingId(""); setEditingBody(""); }} className="px-2 py-1 rounded-md text-[11px] font-semibold" style={{ background: "var(--card-bg)", color: "var(--muted)" }}>
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-sm whitespace-pre-wrap break-words leading-5"
                        style={{
                          color: "var(--foreground)",
                          fontFamily: isSystem ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
                          opacity: isSystem ? 0.92 : 1,
                        }}
                      >
                        {row.isDeleted ? "この投稿は削除されました" : row.body}
                        {row.editedAt && !row.isDeleted ? <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>(編集済み)</span> : null}
                      </p>
                    )}
                    {row.messageType === "image" && row.imageUrl && !row.isDeleted && (
                      <img
                        src={row.imageUrl}
                        alt="shared"
                        className="mt-1.5 rounded-lg max-h-56 object-cover border cursor-zoom-in"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => setLightboxUrl(row.imageUrl || null)}
                      />
                    )}
                    {!isSystem && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          onClick={() => void toggleGlobalStreamRespect({ postId: row.id, uid: userProfile.uid })}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                          style={{
                            background: respectedByMe ? "rgba(14,165,233,0.18)" : "var(--card-bg)",
                            color: respectedByMe ? "#0284c7" : "var(--muted)",
                          }}
                        >
                          <Sparkles size={11} /> Respect {Math.max(0, Number(row.respectCount || 0))}
                        </button>
                      </div>
                    )}
                    {!isSystem && menuMessageId === row.id && (
                      <div className="mt-1 flex items-center gap-1">
                        {isMine && !row.isDeleted && (
                          <button
                            onClick={() => startEdit(row)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                          >
                            編集
                          </button>
                        )}
                        {isMine && (
                          <button
                            onClick={() => void removePost(row.id)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: "rgba(239,68,68,0.14)", color: "#ef4444" }}
                          >
                            削除
                          </button>
                        )}
                        {!isMine && !row.isDeleted && (
                          <button
                            onClick={() => {
                              setReportTarget(row);
                              setMenuMessageId("");
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                            style={{ background: "#f59e0b20", color: "#f59e0b" }}
                          >
                            <Flag size={11} /> 通報
                          </button>
                        )}
                        <button
                          onClick={() => openForwardModal(row)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                        >
                          掲示板へ転送
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </section>

      <section className="glass-card p-3 flex items-end gap-2 relative shrink-0">
        <input
          type="file"
          id="global-chat-image-input"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            void onSelectImage(file);
            e.currentTarget.value = "";
          }}
        />
        <button
          onClick={() => setQuickOpen((v) => !v)}
          className="px-2.5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        >
          <Plus size={16} />
        </button>
        {quickOpen && (
          <div className="absolute left-3 bottom-14 rounded-xl p-2 shadow-lg z-10 min-w-[190px]" style={{ background: "var(--card-bg)" }}>
            <button
              onClick={() => {
                const el = document.getElementById("global-chat-image-input") as HTMLInputElement | null;
                el?.click();
              }}
              className="w-full px-2 py-1.5 rounded-lg text-sm flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <ImagePlus size={14} />
              画像送信
            </button>
            <button
              onClick={() => void onShareProgress()}
              className="w-full px-2 py-1.5 rounded-lg text-sm flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <BookPlus size={14} />
              学習進捗を共有
            </button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 800))}
          placeholder="メッセージ入力... (/stats /timer)"
          rows={2}
          className="flex-1 px-3 py-2 rounded-xl text-sm resize-none"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <button
          onClick={() => void onSend()}
          disabled={!text.trim() || sending}
          className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
          style={{ background: "var(--accent)" }}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 投稿
        </button>
      </section>
      {errorText && <p className="text-xs" style={{ color: "#ef4444" }}>{errorText}</p>}

      {forwardSource && (
        <div className="fixed inset-0 z-20 bg-black/40 grid place-items-center p-4" onClick={() => setForwardSource(null)}>
          <div className="w-full max-w-lg rounded-2xl p-4 space-y-3" style={{ background: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>掲示板へ転送</h3>
            <input
              value={forwardTitle}
              onChange={(e) => setForwardTitle(e.target.value.slice(0, 120))}
              placeholder="転送タイトル"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            <select
              value={forwardCategory}
              onChange={(e) => setForwardCategory(e.target.value as BulletinCategory)}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            >
              <option value="qa">❓質問</option>
              <option value="tips">💡Tips</option>
              <option value="chat">☕雑談</option>
            </select>
            <div className="rounded-xl p-3 text-sm" style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>転送内容プレビュー</p>
              <p className="whitespace-pre-wrap break-words">{forwardSource.body}</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setForwardSource(null)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void forwardToBulletin()}
                disabled={forwarding || !forwardTitle.trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {forwarding ? "転送中..." : "転送"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-[65] bg-black/45 grid place-items-center p-4" onClick={() => setReportTarget(null)}>
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

      <ImageLightbox src={lightboxUrl} open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} zIndexClass="z-30" />
    </div>
  );
}

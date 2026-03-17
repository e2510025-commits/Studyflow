"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { isAdminUid } from "@/lib/admin";
import {
  BookText,
  CheckCircle2,
  Flame,
  Loader2,
  MessageCircleQuestion,
  PencilLine,
  Sparkles,
} from "lucide-react";
import {
  createBulletinPost,
  deleteBulletinPost,
  deleteBulletinThreadMessage,
  editBulletinPost,
  editBulletinThreadMessage,
  sendBulletinThreadMessage,
  subscribeBulletinPosts,
  subscribeBulletinThreadMessages,
  subscribeMyHelpfulPostIds,
  toggleBulletinHelpful,
  updateBulletinResolved,
} from "@/lib/firestore/community";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import type { BulletinCategory, BulletinPost, BulletinThreadMessage } from "@/types";

const CATEGORY_LABEL: Record<BulletinCategory, string> = {
  qa: "❓質問",
  tips: "💡Tips",
  chat: "☕雑談",
  ops: "📢運営",
};

const CATEGORY_ORDER: BulletinCategory[] = ["ops", "qa", "tips", "chat"];

function formatRelativeOrDate(iso: string) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "日時不明";
  const diff = Date.now() - time;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分前`;
  if (diff < day) return `${Math.floor(diff / hour)}時間前`;
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\$\$[^$]+\$\$|\$[^$]+\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`${match.index}_b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={`${match.index}_c`} className="px-1 py-0.5 rounded" style={{ background: "var(--muted-bg)" }}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const expr = token.replace(/^\$\$?/, "").replace(/\$\$?$/, "");
      parts.push(
        <span key={`${match.index}_m`} className="px-1 py-0.5 rounded font-mono" style={{ background: "rgba(6,182,212,0.16)", color: "#06b6d4" }}>
          {expr}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split(/\r?\n/);
  return lines.map((line, idx) => {
    if (line.startsWith("## ")) {
      return (
        <h4 key={idx} className="text-sm font-bold mt-2" style={{ color: "var(--foreground)" }}>
          {renderInline(line.slice(3))}
        </h4>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h3 key={idx} className="text-base font-black mt-2" style={{ color: "var(--foreground)" }}>
          {renderInline(line.slice(2))}
        </h3>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <p key={idx} className="text-sm ml-3" style={{ color: "var(--foreground)" }}>
          ・{renderInline(line.slice(2))}
        </p>
      );
    }
    return (
      <p key={idx} className="text-sm" style={{ color: "var(--foreground)" }}>
        {renderInline(line)}
      </p>
    );
  });
}

export default function BulletinPage() {
  const { userProfile } = useStore();
  const isAdmin = isAdminUid(userProfile.uid);
  const [tab, setTab] = useState<BulletinCategory | "all">("all");
  const [rows, setRows] = useState<BulletinPost[]>([]);
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<BulletinCategory>("tips");
  const [preview, setPreview] = useState(false);
  const [posting, setPosting] = useState(false);
  const [togglingResolvedId, setTogglingResolvedId] = useState("");
  const [errorText, setErrorText] = useState("");
  const [editingPostId, setEditingPostId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [threadPost, setThreadPost] = useState<BulletinPost | null>(null);
  const [threadRows, setThreadRows] = useState<BulletinThreadMessage[]>([]);
  const [threadBody, setThreadBody] = useState("");
  const [editingThreadId, setEditingThreadId] = useState("");
  const [editingThreadBody, setEditingThreadBody] = useState("");

  useEffect(() => {
    return subscribeBulletinPosts(setRows, tab);
  }, [tab]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyHelpfulPostIds(userProfile.uid, setHelpfulIds);
  }, [userProfile.uid]);

  const totalLabel = useMemo(() => `${rows.length}件`, [rows.length]);
  const trendingRows = useMemo(() => {
    return [...rows]
      .sort((a, b) => {
        const scoreA = a.helpfulCount * 4 + a.replyCount * 2 + (a.category === "qa" && !a.resolved ? 2 : 0);
        const scoreB = b.helpfulCount * 4 + b.replyCount * 2 + (b.category === "qa" && !b.resolved ? 2 : 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 4);
  }, [rows]);

  const selectableCategories = useMemo(
    () => (isAdmin ? CATEGORY_ORDER : CATEGORY_ORDER.filter((key) => key !== "ops")),
    [isAdmin]
  );

  useEffect(() => {
    if (!isAdmin && category === "ops") {
      setCategory("tips");
    }
  }, [isAdmin, category]);

  useEffect(() => {
    if (!threadPost) {
      setThreadRows([]);
      return;
    }
    return subscribeBulletinThreadMessages(threadPost.id, setThreadRows);
  }, [threadPost]);

  const startEditPost = (row: BulletinPost) => {
    setEditingPostId(row.id);
    setEditingTitle(row.title);
    setEditingContent(row.content);
  };

  const savePostEdit = async () => {
    if (!editingPostId || !editingTitle.trim() || !editingContent.trim()) return;
    setErrorText("");
    try {
      await editBulletinPost({ postId: editingPostId, title: editingTitle, content: editingContent });
      setEditingPostId("");
      setEditingTitle("");
      setEditingContent("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "投稿編集に失敗しました");
    }
  };

  const removePost = async (postId: string) => {
    setErrorText("");
    try {
      await deleteBulletinPost({ postId });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "投稿削除に失敗しました");
    }
  };

  const sendThread = async () => {
    if (!threadPost || !threadBody.trim() || !userProfile.uid) return;
    setErrorText("");
    try {
      await sendBulletinThreadMessage({
        postId: threadPost.id,
        uid: userProfile.uid,
        name: userProfile.name,
        avatar: userProfile.avatar,
        body: threadBody,
      });
      setThreadBody("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "スレッド送信に失敗しました");
    }
  };

  const saveThreadEdit = async () => {
    if (!editingThreadId || !editingThreadBody.trim() || !userProfile.uid) return;
    setErrorText("");
    try {
      await editBulletinThreadMessage({ messageId: editingThreadId, uid: userProfile.uid, body: editingThreadBody });
      setEditingThreadId("");
      setEditingThreadBody("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "返信編集に失敗しました");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BookText size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>掲示板</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            ストック情報を残して学習知見を共有
          </p>
        </div>
      </div>

      <section className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Flame size={16} style={{ color: "#f59e0b" }} />
          <h2 className="text-sm font-black" style={{ color: "var(--foreground)" }}>注目のトピック</h2>
        </div>
        {trendingRows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>まだトピックがありません。</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {trendingRows.map((row) => (
              <div key={`trend_${row.id}`} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                  {CATEGORY_LABEL[row.category]} ・ {formatRelativeOrDate(row.createdAt)}
                </p>
                <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>{row.title}</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                  役立った {row.helpfulCount} ・ 返信 {row.replyCount}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="bulletin-compose" className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-black" style={{ color: "var(--foreground)" }}>新規投稿</h2>
        <div className="grid md:grid-cols-[180px_1fr] gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BulletinCategory)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          >
            {selectableCategories.map((key) => (
              <option key={key} value={key}>{CATEGORY_LABEL[key]}</option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="タイトル"
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 6000))}
          rows={6}
          placeholder="Markdown対応: **太字** `code` - 箇条書き / TeX風: $x^2$ や $$\\int_0^1 x dx$$"
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setPreview(false)}
            className="px-2.5 py-1 rounded-lg font-semibold"
            style={{ background: !preview ? "var(--accent-light)" : "var(--muted-bg)", color: !preview ? "var(--accent)" : "var(--muted)" }}
          >
            エディタ
          </button>
          <button
            onClick={() => setPreview(true)}
            className="px-2.5 py-1 rounded-lg font-semibold"
            style={{ background: preview ? "var(--accent-light)" : "var(--muted-bg)", color: preview ? "var(--accent)" : "var(--muted)" }}
          >
            プレビュー
          </button>
          {!isAdmin && (
            <span style={{ color: "var(--muted)" }}>※運営カテゴリは管理者のみ投稿できます</span>
          )}
        </div>
        {preview && (
          <div className="rounded-xl px-3 py-2 min-h-[110px]" style={{ background: "var(--muted-bg)" }}>
            {content.trim() ? (
              <div className="space-y-1">{renderMarkdown(content)}</div>
            ) : (
              <p className="text-sm" style={{ color: "var(--muted)" }}>ここにプレビューが表示されます。</p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Markdown/TeX風表記に対応。役立った数は投稿者プロフィール統計に反映されます。
          </p>
          <button
            onClick={async () => {
              if (!userProfile.uid || posting || !title.trim() || !content.trim()) return;
              setErrorText("");
              setPosting(true);
              try {
                await createBulletinPost({
                  title,
                  content,
                  category,
                });
                setTitle("");
                setContent("");
              } catch (error) {
                setErrorText(error instanceof Error ? error.message : "投稿に失敗しました");
              } finally {
                setPosting(false);
              }
            }}
            disabled={posting || !title.trim() || !content.trim()}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
            style={{ background: "var(--accent)" }}
          >
            {posting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} 投稿
          </button>
        </div>
        {errorText && (
          <p className="text-xs" style={{ color: "#ef4444" }}>{errorText}</p>
        )}
      </section>

      <section className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab("all")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: tab === "all" ? "var(--accent-light)" : "var(--muted-bg)", color: tab === "all" ? "var(--accent)" : "var(--muted)" }}
            >
              すべて
            </button>
            {CATEGORY_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: tab === key ? "var(--accent-light)" : "var(--muted-bg)", color: tab === key ? "var(--accent)" : "var(--muted)" }}
              >
                {CATEGORY_LABEL[key]}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{totalLabel}</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>投稿はまだありません。</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
              const helped = helpfulIds.has(row.id);
              return (
                <motion.article
                  key={row.id}
                  className="rounded-xl p-3"
                  style={{ background: "var(--muted-bg)" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                      {isImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                        {CATEGORY_LABEL[row.category]} ・
                        <Link href={`/profile/${row.uid}`} className="hover:underline ml-1 inline-flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                          {row.name}
                          <VerifiedBadge show={row.isOfficial} size={12} />
                        </Link>
                        <span className="ml-2">{formatRelativeOrDate(row.createdAt)}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>
                          {editingPostId === row.id ? "投稿を編集中" : row.title}
                        </h3>
                        {row.category === "qa" && row.resolved && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(34,197,94,0.16)", color: "#16a34a" }}>
                            解決済み
                          </span>
                        )}
                      </div>
                      {editingPostId === row.id ? (
                        <div className="mt-2 space-y-2">
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value.slice(0, 120))}
                            className="w-full px-3 py-2 rounded-xl text-sm"
                            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                          />
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value.slice(0, 6000))}
                            rows={5}
                            className="w-full px-3 py-2 rounded-xl text-sm"
                            style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void savePostEdit()}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                              style={{ background: "var(--accent)" }}
                            >
                              保存
                            </button>
                            <button
                              onClick={() => {
                                setEditingPostId("");
                                setEditingTitle("");
                                setEditingContent("");
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1">{renderMarkdown(row.content)}</div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => void toggleBulletinHelpful({ postId: row.id, postAuthorUid: row.uid, uid: userProfile.uid })}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            background: helped ? "rgba(34,197,94,0.18)" : "var(--card-bg)",
                            color: helped ? "#16a34a" : "var(--muted)",
                          }}
                        >
                          役立った {row.helpfulCount}
                        </button>
                        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--card-bg)", color: "var(--muted)" }}>
                          返信 {row.replyCount}
                        </span>
                        <button
                          onClick={() => setThreadPost(row)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                        >
                          スレッドを開く
                        </button>
                        {row.category === "qa" && (row.uid === userProfile.uid || isAdmin) && (
                          <button
                            onClick={async () => {
                              setErrorText("");
                              setTogglingResolvedId(row.id);
                              try {
                                await updateBulletinResolved({ postId: row.id, resolved: !row.resolved });
                              } catch (error) {
                                setErrorText(error instanceof Error ? error.message : "解決状態の更新に失敗しました");
                              } finally {
                                setTogglingResolvedId("");
                              }
                            }}
                            disabled={togglingResolvedId === row.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                          >
                            {togglingResolvedId === row.id ? "更新中..." : row.resolved ? "未解決に戻す" : "解決済みにする"}
                          </button>
                        )}
                        {(row.uid === userProfile.uid || isAdmin) && (
                          <button
                            onClick={() => startEditPost(row)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                          >
                            投稿を編集
                          </button>
                        )}
                        {(row.uid === userProfile.uid || isAdmin) && (
                          <button
                            onClick={() => void removePost(row.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                          >
                            投稿を削除
                          </button>
                        )}
                        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                          <MessageCircleQuestion size={12} className="inline mr-1" />
                          Markdown + TeX風
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {threadPost && (
        <div className="fixed inset-0 z-40 bg-black/45 grid place-items-center p-4" onClick={() => setThreadPost(null)}>
          <div className="w-full max-w-2xl rounded-2xl p-4 space-y-3 max-h-[86vh] overflow-hidden" style={{ background: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black" style={{ color: "var(--foreground)" }}>{threadPost.title}</h3>
                <p className="text-xs" style={{ color: "var(--muted)" }}>投稿スレッドチャット</p>
              </div>
              <button onClick={() => setThreadPost(null)} className="text-sm" style={{ color: "var(--muted)" }}>
                閉じる
              </button>
            </div>

            <div className="rounded-xl p-3 overflow-y-auto space-y-2 h-[48vh]" style={{ background: "var(--muted-bg)" }}>
              {threadRows.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>まだ返信がありません。</p>
              ) : (
                threadRows.map((msg) => {
                  const isMine = msg.uid === userProfile.uid;
                  const avatarIsImage = msg.avatar.startsWith("http") || msg.avatar.startsWith("data:");
                  return (
                    <div key={msg.id} className="rounded-lg p-2" style={{ background: "var(--card-bg)" }}>
                      <div className="flex items-start gap-2">
                        <span className="w-7 h-7 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                          {avatarIsImage ? <img src={msg.avatar} alt={msg.name} className="w-full h-full object-cover" /> : msg.avatar}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                            <span style={{ color: "var(--foreground)" }}>{msg.name}</span>
                            <VerifiedBadge show={msg.isOfficial} size={11} />
                            <span>{formatRelativeOrDate(msg.createdAt)}</span>
                          </p>
                          {editingThreadId === msg.id ? (
                            <div className="mt-1 space-y-1">
                              <textarea
                                value={editingThreadBody}
                                onChange={(e) => setEditingThreadBody(e.target.value.slice(0, 1000))}
                                rows={2}
                                className="w-full px-2 py-1 rounded-lg text-sm"
                                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                              />
                              <div className="flex items-center gap-1">
                                <button onClick={() => void saveThreadEdit()} className="px-2 py-1 rounded text-[11px] font-semibold text-white" style={{ background: "var(--accent)" }}>
                                  保存
                                </button>
                                <button onClick={() => { setEditingThreadId(""); setEditingThreadBody(""); }} className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                              {msg.isDeleted ? "この返信は削除されました" : msg.body}
                              {msg.editedAt && !msg.isDeleted ? <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>(編集済み)</span> : null}
                            </p>
                          )}
                          {isMine && !msg.isDeleted && editingThreadId !== msg.id && (
                            <div className="mt-1 flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingThreadId(msg.id);
                                  setEditingThreadBody(msg.body);
                                }}
                                className="px-2 py-1 rounded text-[11px] font-semibold"
                                style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
                              >
                                編集
                              </button>
                              <button
                                onClick={() => void deleteBulletinThreadMessage({ messageId: msg.id, uid: userProfile.uid })}
                                className="px-2 py-1 rounded text-[11px] font-semibold"
                                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={threadBody}
                onChange={(e) => setThreadBody(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="返信を入力..."
                className="flex-1 px-3 py-2 rounded-xl text-sm resize-none"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              />
              <button
                onClick={() => void sendThread()}
                disabled={!threadBody.trim()}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}

      <a
        href="#bulletin-compose"
        className="fixed right-5 bottom-5 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg inline-flex items-center gap-2"
        style={{ background: "linear-gradient(90deg, var(--accent), #0ea5e9)" }}
      >
        <PencilLine size={16} />
        投稿する
        <Sparkles size={14} />
      </a>
    </div>
  );
}

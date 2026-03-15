"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  X,
  Paperclip,
  Trash2,
  Download,
  Play,
  Loader2,
  ListTodo,
} from "lucide-react";
import {
  subscribeChatMessages,
  sendTextMessage,
  sendMediaMessage,
  sendTaskMessage,
  deleteChatMessageFromFirestore,
  markChatMessagesAsRead,
} from "@/lib/firestore/chat";
import { getUserProfileByUid } from "@/lib/firestore/friends";
import type { ChatMessage } from "@/types";

/* ── Max file sizes ──────────────────────────────────── */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_ATTACHMENTS = 5;

interface PendingMedia {
  id: string;
  type: "image" | "video";
  previewUrl: string;
  file: File;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const friendUid = params.uid as string;

  const { friends, userProfile } = useStore();
  const [friendFallback, setFriendFallback] = useState<{
    uid: string;
    name: string;
    avatar: string;
  } | null>(null);
  const friend = friends.find((f) => f.uid === friendUid) || friendFallback;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [mediaQueue, setMediaQueue] = useState<PendingMedia[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [sending, setSending] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Subscribe to Firestore messages ────────────────── */
  useEffect(() => {
    if (!userProfile.uid || !friendUid) return;
    const unsubscribe = subscribeChatMessages(
      userProfile.uid,
      friendUid,
      (msgs) => setMessages(msgs)
    );

    const timer = setInterval(() => {
      void markChatMessagesAsRead(userProfile.uid, friendUid).catch(() => {});
    }, 1500);

    void markChatMessagesAsRead(userProfile.uid, friendUid).catch(() => {});
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [userProfile.uid, friendUid]);

  useEffect(() => {
    if (!friendUid || friends.some((f) => f.uid === friendUid)) {
      setFriendFallback(null);
      return;
    }

    void getUserProfileByUid(friendUid)
      .then((profile) => {
        setFriendFallback(profile);
      })
      .catch(() => {
        setFriendFallback(null);
      });
  }, [friendUid, friends]);

  /* ── Auto-scroll to bottom ────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── Send handler ──────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      for (const media of mediaQueue) {
        await sendMediaMessage(userProfile.uid, friendUid, media.type, media.file);
      }
      if (text.trim()) {
        await sendTextMessage(userProfile.uid, friendUid, text.trim());
        setText("");
      }
      mediaQueue.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      setMediaQueue([]);
    } catch (err) {
      console.error("送信エラー:", err);
      alert("送信に失敗しました。時間を空けて再度お試しください。");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [text, mediaQueue, friendUid, userProfile.uid, sending]);

  const handleShareTask = useCallback(async () => {
    if (!taskTitle.trim() || sending) return;
    setSending(true);
    try {
      await sendTaskMessage(userProfile.uid, friendUid, {
        title: taskTitle,
        details: taskDetails,
        dueDate: taskDueDate,
      });
      setTaskTitle("");
      setTaskDetails("");
      setTaskDueDate("");
      setTaskDialogOpen(false);
    } catch (err) {
      console.error("課題共有エラー:", err);
      alert("課題の共有に失敗しました");
    } finally {
      setSending(false);
    }
  }, [taskTitle, taskDetails, taskDueDate, sending, userProfile.uid, friendUid]);

  /* ── Delete message ────────────────────────────────── */
  const handleDelete = useCallback(async (msgId: string) => {
    try {
      await deleteChatMessageFromFirestore(msgId);
    } catch (err) {
      console.error("削除エラー:", err);
    }
  }, []);

  /* ── File picker ───────────────────────────────────── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    const valid: PendingMedia[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) continue;
      if (isImage && file.size > MAX_IMAGE_SIZE) continue;
      if (isVideo && file.size > MAX_VIDEO_SIZE) continue;

      valid.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: isImage ? "image" : "video",
        previewUrl: URL.createObjectURL(file),
        file,
      });
    }

    if (valid.length === 0) {
      alert("有効な画像/動画がありません（画像10MB・動画50MBまで）");
      return;
    }

    setMediaQueue((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
  };

  /* ── Key handling ──────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Time format ───────────────────────────────────── */
  const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
      .getDate()
      .toString()
      .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const parseTaskPayload = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as { title?: string; details?: string; dueDate?: string };
      return {
        title: parsed.title || "課題",
        details: parsed.details || "",
        dueDate: parsed.dueDate || "",
      };
    } catch {
      return { title: "課題", details: raw, dueDate: "" };
    }
  };

  const formatMsgDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  };

  /* ── Group messages by date ────────────────────────── */
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
      const date = formatMsgDate(msg.createdAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, [messages]);

  /* ── Download media (Firebase Storage URL) ─────────── */
  const downloadMedia = async (url: string, fileName?: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "media";
    a.target = "_blank";
    a.click();
  };

  if (!friend) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
        <p className="text-lg font-bold mb-4" style={{ color: "var(--muted)" }}>
          フレンドが見つかりません
        </p>
        <button
          onClick={() => router.push("/friends")}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          フレンド一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* ─── Chat Header ──────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{
          borderColor: "var(--card-border)",
          background: "var(--card-bg)",
        }}
      >
        <motion.button
          onClick={() => router.push("/friends")}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft size={18} />
        </motion.button>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: "var(--accent-light)" }}
        >
          {friend.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-bold block truncate"
            style={{ color: "var(--foreground)" }}
          >
            <Link href={`/profile/${friend.uid}`}>{friend.name}</Link>
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            UID: {friend.uid}
          </span>
        </div>
      </div>

      {/* ─── Messages area ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              まだメッセージがありません
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              メッセージを送って会話を始めましょう
            </p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <React.Fragment key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
              <span
                className="text-[10px] font-medium px-2"
                style={{ color: "var(--muted)" }}
              >
                {group.date}
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
            </div>

            {group.msgs.map((msg) => {
              const isMine = msg.fromUid === userProfile.uid;
              return (
                <motion.div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2 group`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className={`relative max-w-[75%] sm:max-w-[65%] ${
                      isMine ? "order-1" : "order-1"
                    }`}
                  >
                    {/* Bubble */}
                    <div
                      className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words"
                      style={{
                        background: isMine
                          ? "var(--accent)"
                          : "var(--muted-bg)",
                        color: isMine ? "#fff" : "var(--foreground)",
                        borderBottomRightRadius: isMine ? 4 : 16,
                        borderBottomLeftRadius: isMine ? 16 : 4,
                      }}
                    >
                      {/* Text message */}
                      {msg.type === "text" && (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}

                      {/* Image message */}
                      {msg.type === "image" && (
                        <div className="space-y-1">
                          <img
                            src={msg.content}
                            alt={msg.fileName || "画像"}
                            className="rounded-lg max-h-64 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setLightbox(msg.content);
                              setLightboxType("image");
                            }}
                          />
                          {msg.fileName && (
                            <p className="text-[10px] opacity-70 truncate">
                              {msg.fileName}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Task message */}
                      {msg.type === "task" && (() => {
                        const task = parseTaskPayload(msg.content);
                        return (
                          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.12)" }}>
                            <p className="text-xs font-bold flex items-center gap-1 mb-1">
                              <ListTodo size={12} /> 課題共有
                            </p>
                            <p className="text-sm font-semibold">{task.title}</p>
                            {task.details && <p className="text-xs mt-1 opacity-90 whitespace-pre-wrap">{task.details}</p>}
                            {task.dueDate && <p className="text-[10px] mt-1 opacity-80">期限: {task.dueDate}</p>}
                          </div>
                        );
                      })()}

                      {/* Video message */}
                      {msg.type === "video" && (
                        <div className="space-y-1">
                          <div
                            className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setLightbox(msg.content);
                              setLightboxType("video");
                            }}
                          >
                            <video
                              src={msg.content}
                              className="max-h-48 w-auto rounded-lg"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                                <Play size={20} className="text-white ml-0.5" />
                              </div>
                            </div>
                          </div>
                          {msg.fileName && (
                            <p className="text-[10px] opacity-70 truncate">
                              {msg.fileName}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Time + actions */}
                    <div
                      className={`flex items-center gap-1.5 mt-0.5 ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {formatMsgTime(msg.createdAt)}
                      </span>
                      {isMine && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {msg.readBy?.includes(friendUid) ? "既読" : "未読"}
                        </span>
                      )}
                      {/* Actions on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {(msg.type === "image" || msg.type === "video") && (
                          <button
                            onClick={() =>
                              downloadMedia(msg.content, msg.fileName)
                            }
                            className="p-0.5 rounded"
                            style={{ color: "var(--muted)" }}
                            title="ダウンロード"
                          >
                            <Download size={11} />
                          </button>
                        )}
                        {isMine && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-0.5 rounded hover:text-red-500"
                            style={{ color: "var(--muted)" }}
                            title="削除"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Media preview ────────────────────────────── */}
      <AnimatePresence>
        {mediaQueue.length > 0 && (
          <motion.div
            className="px-4 py-2 border-t flex items-center gap-3"
            style={{
              borderColor: "var(--card-border)",
              background: "var(--card-bg)",
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full">
              {mediaQueue.map((item) => (
                <div key={item.id} className="relative w-full aspect-square rounded-lg overflow-hidden">
                  {item.type === "image" ? (
                    <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.previewUrl} className="w-full h-full object-cover" muted />
                  )}
                  <button
                    onClick={() => {
                      setMediaQueue((prev) => {
                        const found = prev.find((m) => m.id === item.id);
                        if (found) URL.revokeObjectURL(found.previewUrl);
                        return prev.filter((m) => m.id !== item.id);
                      });
                    }}
                    className="absolute top-0 right-0 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Input area ───────────────────────────────── */}
      <div
        className="flex items-end gap-2 px-4 py-3 border-t flex-shrink-0"
        style={{
          borderColor: "var(--card-border)",
          background: "var(--card-bg)",
        }}
      >
        {/* File upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="画像・動画をアップロード"
        >
          <Paperclip size={18} />
        </motion.button>

        <motion.button
          onClick={() => setTaskDialogOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="課題を共有"
        >
          <ListTodo size={18} />
        </motion.button>

        {/* Text input */}
        <div
          className="flex-1 rounded-2xl overflow-hidden"
          style={{ background: "var(--muted-bg)" }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            rows={1}
            className="w-full px-4 py-2.5 text-sm outline-none resize-none"
            style={{
              background: "transparent",
              color: "var(--foreground)",
              maxHeight: 120,
            }}
          />
        </div>

        {/* Send button */}
        <motion.button
          onClick={handleSend}
          disabled={sending || (!text.trim() && mediaQueue.length === 0)}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white disabled:opacity-40"
          style={{
            background:
              text.trim() || mediaQueue.length > 0 ? "var(--accent)" : "var(--muted-bg)",
            color: text.trim() || mediaQueue.length > 0 ? "#fff" : "var(--muted)",
          }}
          whileHover={text.trim() || mediaQueue.length > 0 ? { scale: 1.1 } : {}}
          whileTap={text.trim() || mediaQueue.length > 0 ? { scale: 0.9 } : {}}
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </motion.button>
      </div>

      {/* ─── Lightbox ─────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              className="relative max-w-[90vw] max-h-[85vh]"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black"
              >
                <X size={16} />
              </button>
              {lightboxType === "image" ? (
                <img
                  src={lightbox}
                  alt=""
                  className="max-w-full max-h-[85vh] rounded-lg object-contain"
                />
              ) : (
                <video
                  src={lightbox}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh] rounded-lg"
                />
              )}
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={() => downloadMedia(lightbox)}
                  className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-black/80"
                >
                  <Download size={12} />
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {taskDialogOpen && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTaskDialogOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-4"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-3" style={{ color: "var(--foreground)" }}>課題を共有</h3>
              <div className="space-y-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="課題タイトル"
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                />
                <textarea
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="課題詳細（任意）"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setTaskDialogOpen(false)}
                  className="px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleShareTask}
                  disabled={!taskTitle.trim() || sending}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  共有する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

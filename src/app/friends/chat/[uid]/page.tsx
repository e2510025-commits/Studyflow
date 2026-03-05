"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  subscribeChatMessages,
  sendTextMessage,
  sendMediaMessage,
  deleteChatMessageFromFirestore,
} from "@/lib/firestore/chat";
import type { ChatMessage } from "@/types";

/* ── Max file sizes ──────────────────────────────────── */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const friendUid = params.uid as string;

  const { friends, userProfile } = useStore();
  const friend = friends.find((f) => f.uid === friendUid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{
    type: "image" | "video";
    previewUrl: string;
    file: File;
  } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [sending, setSending] = useState(false);

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
    return () => unsubscribe();
  }, [userProfile.uid, friendUid]);

  /* ── Auto-scroll to bottom ────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── Send handler ──────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      if (mediaPreview) {
        await sendMediaMessage(userProfile.uid, friendUid, mediaPreview.type, mediaPreview.file);
        URL.revokeObjectURL(mediaPreview.previewUrl);
        setMediaPreview(null);
      }
      if (text.trim()) {
        await sendTextMessage(userProfile.uid, friendUid, text.trim());
        setText("");
      }
    } catch (err) {
      console.error("送信エラー:", err);
      alert("送信に失敗しました");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [text, mediaPreview, friendUid, userProfile.uid, sending]);

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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      alert("画像または動画ファイルを選択してください");
      return;
    }
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      alert("画像は10MB以下にしてください");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      alert("動画は50MB以下にしてください");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setMediaPreview({
      type: isImage ? "image" : "video",
      previewUrl,
      file,
    });
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
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
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
            {friend.name}
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
        {mediaPreview && (
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
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              {mediaPreview.type === "image" ? (
                <img
                  src={mediaPreview.previewUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={mediaPreview.previewUrl}
                  className="w-full h-full object-cover"
                  muted
                />
              )}
              <button
                onClick={() => setMediaPreview(null)}
                className="absolute top-0 right-0 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium truncate"
                style={{ color: "var(--foreground)" }}
              >
                {mediaPreview.file.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                {mediaPreview.type === "image" ? "画像" : "動画"}を送信
              </p>
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
          disabled={sending || (!text.trim() && !mediaPreview)}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white disabled:opacity-40"
          style={{
            background:
              text.trim() || mediaPreview ? "var(--accent)" : "var(--muted-bg)",
            color: text.trim() || mediaPreview ? "#fff" : "var(--muted)",
          }}
          whileHover={text.trim() || mediaPreview ? { scale: 1.1 } : {}}
          whileTap={text.trim() || mediaPreview ? { scale: 0.9 } : {}}
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
    </div>
  );
}

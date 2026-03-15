"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import {
  User,
  Copy,
  Check,
  Save,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import { fetchPublicProfile, saveDisplayProfile } from "@/lib/firestore/profile";
import type { ProfileVisibility } from "@/types";

const AVATAR_EMOJI_OPTIONS = [
  "🎓", "📚", "✏️", "🧠", "🔬", "🎯", "💡", "🚀",
  "🌟", "🎨", "🎵", "🌸", "🐱", "🐶", "🦊", "🐼",
  "👤", "👩‍🎓", "👨‍💻", "🧑‍🔬", "🦉", "🌙", "⚡", "🔥",
];

export default function SettingsPage() {
  const {
    userProfile,
    updateUserProfile,
  } = useStore();

  const [name, setName] = useState(() => userProfile.name);
  const [avatar, setAvatar] = useState(() => userProfile.avatar || "🎓");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile.uid) return;
    void fetchPublicProfile(userProfile.uid)
      .then((profile) => {
        if (!profile) return;
        setBio(profile.bio || "");
        setVisibility(profile.visibility || "public");
      })
      .catch(() => {});
  }, [userProfile.uid]);

  const handleSave = async () => {
    if (!userProfile.uid) return;
    await saveDisplayProfile({
      uid: userProfile.uid,
      name,
      avatar,
      bio,
      visibility,
      dailyGoal: userProfile.dailyGoal,
      totalPoints: userProfile.totalPoints,
    });
    updateUserProfile({ name, avatar });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(userProfile.uid);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = userProfile.uid;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert("画像サイズは2MB以下にしてください");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 128x128 for storage efficiency
        const canvas = document.createElement("canvas");
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        // Crop to square from center
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/webp", 0.8);
        setAvatar(dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const isImageAvatar = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          アカウント設定
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          プロフィールやアカウント情報を管理します
        </p>
      </motion.div>

      {/* UID Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <User size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            ユーザーID
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-2.5 rounded-xl font-mono text-lg tracking-widest font-bold text-center"
            style={{ background: "var(--muted-bg)", color: "var(--accent)" }}>
            {userProfile.uid}
          </div>
          <button
            onClick={handleCopyUid}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: copied ? "#22c55e" : "var(--accent)",
              color: "#fff",
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          このIDは他のユーザーからあなたを識別するために使われます
        </p>
      </motion.div>

      {/* Avatar Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <ImageIcon size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            アイコン
          </h2>
        </div>

        {/* Current avatar preview + upload */}
        <div className="flex items-center gap-5 mb-5">
          <div className="relative group">
            {isImageAvatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: "3px solid var(--accent)" }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ background: "var(--accent-light)", border: "3px solid var(--accent)" }}
              >
                {avatar}
              </div>
            )}
            {isImageAvatar && (
              <button
                onClick={() => setAvatar("🎓")}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white"
                style={{ background: "#ef4444", fontSize: 12 }}
                title="画像を削除"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              画像をアップロード
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <Upload size={14} />
              画像を選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
              JPG・PNG・WebP（2MB以下）
            </p>
          </div>
        </div>

        {/* Emoji alternatives */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>
            または絵文字から選択
          </p>
          <div className="grid grid-cols-8 gap-2">
            {AVATAR_EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
                style={{
                  background: avatar === emoji ? "var(--accent-light)" : "var(--muted-bg)",
                  border: avatar === emoji ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Name Card */}
      <motion.div
        className="glass-card p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <User size={18} />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            表示名
          </h2>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ユーザー名を入力"
          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
          style={{
            background: "var(--muted-bg)",
            color: "var(--foreground)",
            border: "2px solid transparent",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "transparent")}
        />
      </motion.div>

      <motion.div
        className="glass-card p-5 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4 }}
      >
        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          自己紹介
        </h2>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 280))}
          rows={4}
          placeholder="勉強中のこと、目標などを書けます（280文字まで）"
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          {bio.length}/280
        </p>
      </motion.div>

      <motion.div
        className="glass-card p-5 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.19, duration: 0.4 }}
      >
        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          公開範囲
        </h2>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
          className="w-full px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        >
          <option value="public">公開（誰でも表示）</option>
          <option value="friends">フレンドのみ</option>
          <option value="private">非公開（自分のみ）</option>
        </select>
      </motion.div>

      {/* Save button */}
      <motion.div
        className="pb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: saved ? "#22c55e" : "var(--accent)" }}
        >
          {saved ? <Check size={20} /> : <Save size={20} />}
          {saved ? "保存しました！" : "アカウント情報を保存"}
        </button>
      </motion.div>
    </div>
  );
}

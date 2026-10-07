"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { User, Copy, Check, Save, Upload, X, ImageIcon, Trash2, KeyRound, RefreshCw } from "lucide-react";
import { fetchPublicProfile, saveDisplayProfile } from "@/lib/firestore/profile";
import type { DisplayProfileUpdate } from "@/lib/profilePayload";
import type { ProfileVisibility } from "@/types";

type PairingCodeResponse = {
  ok?: boolean;
  code?: string | null;
  expiresAtMs?: number | null;
  error?: string;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "期限切れ";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const userProfile = useStore((state) => state.userProfile);
  const updateUserProfile = useStore((state) => state.updateUserProfile);
  const [draft, setDraft] = useState<{ uid: string; fields: Partial<DisplayProfileUpdate> } | null>(null);
  const [loaded, setLoaded] = useState<{ uid: string; fields: Partial<DisplayProfileUpdate> } | null>(null);
  const fields = { ...(loaded?.uid === userProfile.uid ? loaded.fields : {}), ...(draft?.uid === userProfile.uid ? draft.fields : {}) };
  const change = (patch: Partial<DisplayProfileUpdate>) => {
    setDraft((previous) => ({ uid: userProfile.uid, fields: { ...(previous?.uid === userProfile.uid ? previous.fields : {}), ...patch } }));
    setSaved(false);
  };
  const name = fields.name ?? userProfile.name;
  const avatar = fields.avatar ?? userProfile.avatar ?? "👤";
  const setName = (value: string) => change({ name: value });
  const setAvatar = (value: string) => change({ avatar: value });
  const bio = fields.bio ?? "";
  const visibility = fields.visibility ?? "public";
  const showFollowCount = fields.showFollowCount ?? true;
  const showFollowerCount = fields.showFollowerCount ?? true;
  const showFriendCount = fields.showFriendCount ?? true;
  const setBio = (value: string) => change({ bio: value });
  const setVisibility = (value: ProfileVisibility) => change({ visibility: value });
  const setShowFollowCount = (value: boolean) => change({ showFollowCount: value });
  const setShowFollowerCount = (value: boolean) => change({ showFollowerCount: value });
  const setShowFriendCount = (value: boolean) => change({ showFriendCount: value });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAtMs, setPairingExpiresAtMs] = useState<number | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [pairingCopied, setPairingCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile.uid) return;
    let disposed = false;
    const uid = userProfile.uid;
    void fetchPublicProfile(uid).then((profile) => {
      if (disposed) return;
      setLoadError("");
      if (!profile) return;
      setLoaded({ uid, fields: { bio: profile.bio, visibility: profile.visibility,
        showFollowCount: profile.showFollowCount ?? true,
        showFollowerCount: profile.showFollowerCount ?? true,
        showFriendCount: profile.showFriendCount ?? true } });
    }).catch(() => { if (!disposed) setLoadError("プロフィールを読み込めませんでした。未編集の項目は保存時に維持されます。"); });
    return () => { disposed = true; };
  }, [userProfile.uid, profileRetry]);

  useEffect(() => {
    if (!userProfile.uid) return;
    void (async () => {
      try {
        const response = await fetch("/api/account/pairing-code", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as PairingCodeResponse;
        setPairingCode(typeof data.code === "string" ? data.code : "");
        setPairingExpiresAtMs(typeof data.expiresAtMs === "number" ? data.expiresAtMs : null);
      } catch {
        // ignore initial load failure and keep page usable
      }
    })();
  }, [userProfile.uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSave = async () => {
    if (!userProfile.uid || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("表示名は必須です");
      return;
    }
    setNameError("");

    const uid = userProfile.uid;
    setSaving(true); setSaved(false); setSaveError("");
    try {
      await saveDisplayProfile({ ...fields, uid, name: trimmedName, avatar, profileSetupDone: true });
      if (useStore.getState().userProfile.uid !== uid) return;
      updateUserProfile({ name: trimmedName, avatar });
      setSaved(true);
    } catch {
      setSaveError("保存できませんでした。入力内容は保持されています。再試行してください。");
    } finally { setSaving(false); }
  };

  const handleCopyUid = async () => {
    setCopied(false); setCopyError("");
    try {
      await navigator.clipboard.writeText(userProfile.uid);
      setCopied(true);
    } catch {
      setCopyError("コピーできませんでした。表示されているUIDを選択してコピーしてください。");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("画像サイズは2MB以下にしてください。");
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

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    if (deleteConfirmText !== "DELETE") {
      setDeleteError("確認文字に DELETE を入力してください");
      return;
    }
    setDeleteError("");
    setDeletingAccount(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "account_delete_failed");
      }

      try {
        localStorage.removeItem("study-timer-storage");
      } catch {
        // ignore local cleanup failure
      }

      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "アカウント削除に失敗しました");
      setDeletingAccount(false);
    }
  };

  const handleGeneratePairingCode = async () => {
    if (pairingBusy) return;
    setPairingBusy(true);
    setPairingError("");
    try {
      const response = await fetch("/api/account/pairing-code", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as PairingCodeResponse;
      if (!response.ok || !data?.ok || typeof data.code !== "string") {
        throw new Error(data.error || "ペアリングコードの発行に失敗しました");
      }
      setPairingCode(data.code);
      setPairingExpiresAtMs(typeof data.expiresAtMs === "number" ? data.expiresAtMs : null);
    } catch (error) {
      setPairingError(error instanceof Error ? error.message : "ペアリングコードの発行に失敗しました");
    } finally {
      setPairingBusy(false);
    }
  };

  const handleCopyPairingCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = pairingCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setPairingCopied(true);
    setTimeout(() => setPairingCopied(false), 2000);
  };

  const pairingRemainingMs = pairingExpiresAtMs ? pairingExpiresAtMs - nowMs : 0;
  const hasActivePairing = Boolean(pairingCode) && pairingRemainingMs > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 settings-page">
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

      {loadError && <div role="alert" className="glass-card p-4 text-sm"><p>{loadError}</p><button className="secondary-button mt-3" onClick={() => setProfileRetry((value) => value + 1)}>プロフィールを再読み込み</button></div>}

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
          <div className="flex-1 px-4 py-2.5 rounded-xl font-mono text-lg tracking-widest font-bold text-center min-w-0 break-all select-all"
            style={{ background: "var(--muted-bg)", color: "var(--accent)" }}>
            {userProfile.uid || "確認中…"}
          </div>
          <button
            disabled={!userProfile.uid}
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
        {copyError && <p role="alert" className="text-sm text-danger mt-3">{copyError}</p>}
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
                onClick={() => setAvatar("👤")}
                aria-label="アイコン画像を削除"
                disabled={saving}
                className="absolute -top-1 -right-1 w-11 h-11 rounded-full flex items-center justify-center text-white"
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
              disabled={saving}
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
          aria-label="表示名"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "name-error" : undefined}
          disabled={saving}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError && e.target.value.trim()) setNameError("");
          }}
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
        {nameError && (
          <p id="name-error" role="alert" className="text-xs mt-2" style={{ color: "#ef4444" }}>
            {nameError}
          </p>
        )}
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          2〜20文字程度がおすすめです。
        </p>
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
          aria-label="自己紹介"
          disabled={saving}
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
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          プロフィールを誰まで公開するかを選択できます。
        </p>
        <select
          aria-label="プロフィールの公開範囲"
          disabled={saving}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
          className="w-full px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        >
          <option value="public">公開（誰でも表示）</option>
          <option value="friends">フレンドのみ</option>
          <option value="private">非公開（自分のみ）</option>
        </select>
        <div className="pt-2 space-y-2">
          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            関係情報の表示設定
          </p>
          <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <input disabled={saving} type="checkbox" checked={showFollowCount} onChange={(e) => setShowFollowCount(e.target.checked)} />
            フォロー数を表示
          </label>
          <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <input disabled={saving} type="checkbox" checked={showFollowerCount} onChange={(e) => setShowFollowerCount(e.target.checked)} />
            フォロワー数を表示
          </label>
          <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <input disabled={saving} type="checkbox" checked={showFriendCount} onChange={(e) => setShowFriendCount(e.target.checked)} />
            フレンド数を表示
          </label>
        </div>
      </motion.div>

      <motion.div
        className="glass-card p-5 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.195, duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <KeyRound size={16} style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            PCアプリ連携コード
          </h2>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          StudyFlow Lockの連携画面でこのコードを入力すると、あなたのアカウントに接続できます。コードは10分で失効し、1回使うと無効になります。
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 px-4 py-2.5 rounded-xl font-mono text-lg tracking-widest font-bold text-center min-w-0 break-all select-all"
            style={{ background: "var(--muted-bg)", color: "var(--accent)" }}
          >
            {hasActivePairing ? pairingCode : "--------"}
          </div>
          <button
            onClick={() => void handleCopyPairingCode()}
            disabled={!hasActivePairing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: pairingCopied ? "#22c55e" : "var(--accent)",
              color: "#fff",
            }}
          >
            {pairingCopied ? <Check size={16} /> : <Copy size={16} />}
            {pairingCopied ? "コピー済" : "コピー"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: hasActivePairing ? "var(--muted)" : "#ef4444" }}>
            {hasActivePairing ? `有効期限: ${formatRemaining(pairingRemainingMs)}` : "コード未発行または期限切れ"}
          </p>
          <button
            onClick={() => void handleGeneratePairingCode()}
            disabled={pairingBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            <RefreshCw size={13} className={pairingBusy ? "animate-spin" : ""} />
            {pairingBusy ? "発行中..." : hasActivePairing ? "再発行" : "コードを発行"}
          </button>
        </div>
        {pairingError && (
          <p className="text-xs" style={{ color: "#ef4444" }}>
            {pairingError}
          </p>
        )}
      </motion.div>

      <motion.div
        className="glass-card p-5 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{ border: "1px solid rgba(239,68,68,0.35)" }}
      >
        <div className="flex items-center gap-2">
          <Trash2 size={16} style={{ color: "#ef4444" }} />
          <h2 className="text-base font-bold" style={{ color: "#ef4444" }}>
            アカウント削除
          </h2>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          アカウントに関連するデータ（プロフィール、投稿、返信、DM、フレンド、学習記録、通知など）を削除します。この操作は取り消せません。
        </p>
        <input
          aria-label="アカウント削除の確認文字"
          value={deleteConfirmText}
          onChange={(e) => {
            setDeleteConfirmText(e.target.value);
            if (deleteError) setDeleteError("");
          }}
          placeholder="DELETE と入力"
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        {deleteError && (
          <p className="text-xs" style={{ color: "#ef4444" }}>
            {deleteError}
          </p>
        )}
        <button
          onClick={() => void handleDeleteAccount()}
          disabled={deletingAccount}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#ef4444" }}
        >
          <Trash2 size={15} /> {deletingAccount ? "削除中..." : "アカウントを削除"}
        </button>
      </motion.div>

      {/* Save button */}
      <motion.div
        className="pb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
      >
        <button
          onClick={() => void handleSave()}
          disabled={saving || !userProfile.uid}
          className="primary-button w-full"
        >
          {saved ? <Check size={20} /> : <Save size={20} />}
          {saving ? "保存中…" : "アカウント情報を保存"}
        </button>
        {saved && <p role="status" className="mt-3 text-sm">アカウント情報を保存しました。</p>}
        {saveError && <p role="alert" className="mt-3 text-sm text-danger">{saveError}</p>}
      </motion.div>
    </div>
  );
}

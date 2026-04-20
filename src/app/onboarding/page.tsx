"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { useStore } from "@/store/useStore";
import { saveDisplayProfile } from "@/lib/firestore/profile";
import type { ProfileVisibility } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useStore();

  const [name, setName] = useState(() => userProfile.name || "");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const [showFollowCount, setShowFollowCount] = useState(true);
  const [showFollowerCount, setShowFollowerCount] = useState(true);
  const [showFriendCount, setShowFriendCount] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(userProfile.uid) && name.trim().length > 0 && agreeTerms && agreePrivacy && !saving;
  }, [agreePrivacy, agreeTerms, name, saving, userProfile.uid]);

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError("");

    try {
      const trimmedName = name.trim();
      await saveDisplayProfile({
        uid: userProfile.uid,
        name: trimmedName,
        avatar: userProfile.avatar || "👤",
        bio,
        visibility,
        dailyGoal: userProfile.dailyGoal,
        totalPoints: userProfile.totalPoints,
        bonusPoints: userProfile.bonusPoints || 0,
        profileSetupDone: true,
        showFollowCount,
        showFollowerCount,
        showFriendCount,
        termsAccepted: true,
        privacyAccepted: true,
        agreementsAcceptedAt: new Date().toISOString(),
      });

      updateUserProfile({ name: trimmedName, profileSetupDone: true });
      router.replace("/");
    } catch {
      setError("登録に失敗しました。通信状態を確認してもう一度お試しください。");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:py-10" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="glass-card p-6 sm:p-7"
        >
          <p className="text-xs font-black tracking-[0.16em]" style={{ color: "var(--accent)" }}>
            FIRST SETUP
          </p>
          <h1 className="text-2xl sm:text-3xl font-black mt-2" style={{ color: "var(--foreground)" }}>
            初回プロフィール登録
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            この登録が完了するまで StudyFlow の機能は利用できません。必要事項を入力し、利用規約等に同意して登録してください。
          </p>

          <form onSubmit={handleCompleteSetup} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                表示名
              </label>
              <div className="relative">
                <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 20))}
                  placeholder="表示名を入力"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                自己紹介（任意）
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                placeholder="勉強中のことや目標を入力"
              />
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {bio.length}/280
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                公開範囲
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                <option value="public">公開（誰でも表示）</option>
                <option value="friends">フレンドのみ</option>
                <option value="private">非公開（自分のみ）</option>
              </select>

              <div className="grid gap-2 pt-2">
                <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={showFollowCount} onChange={(e) => setShowFollowCount(e.target.checked)} />
                  フォロー数を表示
                </label>
                <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={showFollowerCount} onChange={(e) => setShowFollowerCount(e.target.checked)} />
                  フォロワー数を表示
                </label>
                <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={showFriendCount} onChange={(e) => setShowFriendCount(e.target.checked)} />
                  フレンド数を表示
                </label>
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--muted-bg)" }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  利用規約・ポリシー同意
                </p>
              </div>

              <label className="text-xs inline-flex items-start gap-2" style={{ color: "var(--foreground)" }}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5"
                  required
                />
                利用規約に同意します
              </label>
              <label className="text-xs inline-flex items-start gap-2" style={{ color: "var(--foreground)" }}>
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5"
                  required
                />
                プライバシーポリシーに同意します
              </label>
            </div>

            {error && (
              <p className="text-sm font-semibold px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              <CheckCircle2 size={16} />
              {saving ? "登録中..." : "同意して登録する"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

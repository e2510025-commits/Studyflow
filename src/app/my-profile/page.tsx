"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";

export default function MyProfilePage() {
  const { userProfile } = useStore();

  if (!userProfile.uid) {
    return <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>プロフィール情報がありません。</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="glass-card p-5">
        <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>マイプロフィール</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>公開ページのプレビューと設定導線です。</p>
      </div>

      <div className="glass-card p-5 space-y-3">
        <p className="text-sm" style={{ color: "var(--foreground)" }}>
          プロフィールページ: <Link href={`/profile/${userProfile.uid}`} style={{ color: "var(--accent)", fontWeight: 700 }}>表示する</Link>
        </p>
        <p className="text-sm" style={{ color: "var(--foreground)" }}>
          公開範囲や自己紹介の編集: <Link href="/settings" style={{ color: "var(--accent)", fontWeight: 700 }}>アカウント設定へ</Link>
        </p>
      </div>
    </div>
  );
}

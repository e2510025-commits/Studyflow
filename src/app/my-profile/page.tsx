"use client";

import React, { useEffect } from "react";
import { useStore } from "@/store/useStore";

export default function MyProfilePage() {
  const { userProfile } = useStore();

  useEffect(() => {
    if (!userProfile.uid) return;
    window.location.replace(`/profile/${userProfile.uid}`);
  }, [userProfile.uid]);

  if (!userProfile.uid) {
    return <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>プロフィール情報がありません。</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>
      プロフィールへ移動中...
    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";

export default function MyProfilePage() {
  const router = useRouter();
  const { userProfile } = useStore();

  useEffect(() => {
    if (!userProfile.uid) return;
    router.replace(`/profile/${userProfile.uid}`);
  }, [router, userProfile.uid]);

  if (!userProfile.uid) {
    return <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>プロフィール情報がありません。</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-12 text-sm" style={{ color: "var(--muted)" }}>
      プロフィールへ移動中...
    </div>
  );
}

"use client";

import React from "react";

export default function GroupConversationError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4 text-center">
      <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
        グループ会話の読み込みに失敗しました
      </h2>
      <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
        {error.message || "一時的なエラーが発生しました。"}
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background: "var(--accent)" }}
      >
        再読み込み
      </button>
    </div>
  );
}

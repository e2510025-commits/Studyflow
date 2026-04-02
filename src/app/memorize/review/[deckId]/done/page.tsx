"use client";

import { Repeat, ScrollText } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function ReviewDonePage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();

  return (
    <div className="h-[calc(100vh-70px)] bg-[#f4f4f5] rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      <div className="h-full flex flex-col">
        <header className="h-10 px-3 flex items-center justify-between border-b text-xs" style={{ borderColor: "#e4e4e7" }}>
          <button type="button" onClick={() => router.push(`/memorize/deck/${params.deckId}`)} style={{ color: "#111827" }}>
            設定
          </button>
          <div className="font-semibold" style={{ color: "#374151" }}>
            暗記完了
          </div>
          <button type="button" onClick={() => router.push(`/memorize/deck/${params.deckId}`)} style={{ color: "#111827" }}>
            終了
          </button>
        </header>

        <main className="flex-1 grid place-items-center px-4">
          <div className="w-full max-w-sm space-y-3">
            <button
              type="button"
              onClick={() => router.push(`/memorize/review/${params.deckId}`)}
              className="w-full py-3 rounded-full border inline-flex items-center justify-center gap-2 text-sm"
              style={{ borderColor: "#a5b4fc", color: "#6366f1" }}
            >
              <Repeat size={16} />
              もう一度暗記する
            </button>
            <button
              type="button"
              onClick={() => router.push(`/memorize/deck/${params.deckId}`)}
              className="w-full py-3 rounded-full border inline-flex items-center justify-center gap-2 text-sm"
              style={{ borderColor: "#a5b4fc", color: "#6366f1" }}
            >
              <ScrollText size={16} />
              テストする
            </button>
          </div>
        </main>

        <footer className="px-2 pb-2">
          <div className="h-6 rounded-md bg-[#7879d9] text-white text-sm grid place-items-center">よく頑張りました</div>
        </footer>
      </div>
    </div>
  );
}

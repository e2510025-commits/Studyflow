"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { BookText, CheckCircle2, Loader2, MessageCircleQuestion } from "lucide-react";
import {
  createBulletinPost,
  subscribeBulletinPosts,
  subscribeMyHelpfulPostIds,
  toggleBulletinHelpful,
} from "@/lib/firestore/community";
import type { BulletinCategory, BulletinPost } from "@/types";

const CATEGORY_LABEL: Record<BulletinCategory, string> = {
  qa: "質問・回答",
  tips: "学習Tips",
  ops: "運営からのお知らせ",
};

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\$\$[^$]+\$\$|\$[^$]+\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`${match.index}_b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={`${match.index}_c`} className="px-1 py-0.5 rounded" style={{ background: "var(--muted-bg)" }}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const expr = token.replace(/^\$\$?/, "").replace(/\$\$?$/, "");
      parts.push(
        <span key={`${match.index}_m`} className="px-1 py-0.5 rounded font-mono" style={{ background: "rgba(6,182,212,0.16)", color: "#06b6d4" }}>
          {expr}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split(/\r?\n/);
  return lines.map((line, idx) => {
    if (line.startsWith("## ")) {
      return (
        <h4 key={idx} className="text-sm font-bold mt-2" style={{ color: "var(--foreground)" }}>
          {renderInline(line.slice(3))}
        </h4>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h3 key={idx} className="text-base font-black mt-2" style={{ color: "var(--foreground)" }}>
          {renderInline(line.slice(2))}
        </h3>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <p key={idx} className="text-sm ml-3" style={{ color: "var(--foreground)" }}>
          ・{renderInline(line.slice(2))}
        </p>
      );
    }
    return (
      <p key={idx} className="text-sm" style={{ color: "var(--foreground)" }}>
        {renderInline(line)}
      </p>
    );
  });
}

export default function BulletinPage() {
  const { userProfile } = useStore();
  const [tab, setTab] = useState<BulletinCategory | "all">("all");
  const [rows, setRows] = useState<BulletinPost[]>([]);
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<BulletinCategory>("tips");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    return subscribeBulletinPosts(setRows, tab);
  }, [tab]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyHelpfulPostIds(userProfile.uid, setHelpfulIds);
  }, [userProfile.uid]);

  const totalLabel = useMemo(() => `${rows.length}件`, [rows.length]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BookText size={24} style={{ color: "var(--accent)" }} />
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>掲示板</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            ストック情報を残して学習知見を共有
          </p>
        </div>
      </div>

      <section className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-black" style={{ color: "var(--foreground)" }}>新規投稿</h2>
        <div className="grid md:grid-cols-[180px_1fr] gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BulletinCategory)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          >
            <option value="qa">質問・回答</option>
            <option value="tips">学習Tips</option>
            <option value="ops">運営からのお知らせ</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="タイトル"
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 6000))}
          rows={6}
          placeholder="Markdown対応: **太字** `code` - 箇条書き / TeX風: $x^2$ や $$\\int_0^1 x dx$$"
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Markdown/TeX風表記に対応。役立った数は投稿者プロフィール統計に反映されます。
          </p>
          <button
            onClick={async () => {
              if (!userProfile.uid || posting || !title.trim() || !content.trim()) return;
              setPosting(true);
              try {
                await createBulletinPost({
                  uid: userProfile.uid,
                  name: userProfile.name,
                  avatar: userProfile.avatar,
                  title,
                  content,
                  category,
                });
                setTitle("");
                setContent("");
              } finally {
                setPosting(false);
              }
            }}
            disabled={posting || !title.trim() || !content.trim()}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
            style={{ background: "var(--accent)" }}
          >
            {posting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} 投稿
          </button>
        </div>
      </section>

      <section className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab("all")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: tab === "all" ? "var(--accent-light)" : "var(--muted-bg)", color: tab === "all" ? "var(--accent)" : "var(--muted)" }}
            >
              すべて
            </button>
            {(Object.keys(CATEGORY_LABEL) as BulletinCategory[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: tab === key ? "var(--accent-light)" : "var(--muted-bg)", color: tab === key ? "var(--accent)" : "var(--muted)" }}
              >
                {CATEGORY_LABEL[key]}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{totalLabel}</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>投稿はまだありません。</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isImage = row.avatar.startsWith("http") || row.avatar.startsWith("data:");
              const helped = helpfulIds.has(row.id);
              return (
                <motion.article
                  key={row.id}
                  className="rounded-xl p-3"
                  style={{ background: "var(--muted-bg)" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full overflow-hidden inline-flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
                      {isImage ? <img src={row.avatar} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                        {CATEGORY_LABEL[row.category]} ・
                        <Link href={`/profile/${row.uid}`} className="hover:underline ml-1" style={{ color: "var(--foreground)" }}>
                          {row.name}
                        </Link>
                      </p>
                      <h3 className="text-base font-black mt-0.5" style={{ color: "var(--foreground)" }}>{row.title}</h3>
                      <div className="mt-2 space-y-1">{renderMarkdown(row.content)}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => void toggleBulletinHelpful({ postId: row.id, postAuthorUid: row.uid, uid: userProfile.uid })}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            background: helped ? "rgba(34,197,94,0.18)" : "var(--card-bg)",
                            color: helped ? "#16a34a" : "var(--muted)",
                          }}
                        >
                          役立った {row.helpfulCount}
                        </button>
                        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                          <MessageCircleQuestion size={12} className="inline mr-1" />
                          Markdown + TeX風
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"sequential" | "all-at-once">("sequential");
  const [saving, setSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertBrackets = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText) {
      // Wrap selected text with brackets
      const newContent = content.substring(0, start) + `（${selectedText}）` + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + selectedText.length + 2, start + selectedText.length + 2);
      }, 0);
    } else {
      // Insert empty brackets and move cursor inside
      const newContent = content.substring(0, start) + "（）" + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  const extractAnswers = (text: string): string[] => {
    // Support both full-width （） and half-width ()
    const regex = /[（(]([^）)]+)[）)]/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };

  const renderPreview = () => {
    // Support both full-width （） and half-width ()
    const parts = content.split(/([（(][^）)]+[）)])/g);
    return parts.map((part, idx) => {
      if (part.match(/[（(][^）)]+[）)]/)) {
        const answer = part.replace(/[（()）]/g, "").trim();
        const answerLength = answer.length || 3;
        return (
          <span key={idx} className="inline-block relative mx-1">
            <input
              type="text"
              disabled
              className="px-3 py-2 rounded-lg outline-none text-center font-semibold border-2"
              style={{
                width: `${Math.max(answerLength * 1.5, 4)}em`,
                background: "var(--background)",
                color: "var(--muted)",
                borderColor: "var(--primary)",
              }}
              placeholder="___"
            />
            <span className="absolute -bottom-6 left-0 text-xs font-medium whitespace-nowrap" style={{ color: "#22c55e" }}>
              正解: {answer}
            </span>
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert("タイトルと問題文を入力してください");
      return;
    }

    const answers = extractAnswers(content);
    if (answers.length === 0) {
      alert("（答え）の形式で少なくとも1つの穴埋めを作成してください\n全角（）でも半角()でもOKです");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/memorize/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, answers, mode }),
      });

      if (res.ok) {
        router.push("/memorize");
      } else {
        alert("保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save question:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const answers = extractAnswers(content);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium" style={{ color: "var(--primary)" }}>
          <ArrowLeft size={20} />
          戻る
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
          穴埋め問題を作成
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          テキストを選択して「（ ）」ボタンを押すと、自動で穴埋めになります
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="p-6 rounded-2xl space-y-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 日本史 江戸時代"
                className="w-full px-4 py-3 rounded-xl outline-none border"
                style={{ background: "var(--background)", color: "var(--foreground)", borderColor: "var(--card-border)" }}
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>問題文</label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                placeholder="問題文を入力し、答えにしたい部分を選択して「（ ）」ボタンを押してください"
                rows={10}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none border"
                style={{ background: "var(--background)", color: "var(--foreground)", borderColor: "var(--card-border)" }}
              />
              
              {isFocused && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={insertBrackets}
                  className="absolute right-4 top-12 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg"
                  style={{ background: "var(--primary)", color: "#fff" }}
                  title="選択したテキストを穴埋めにする"
                >
                  （ ）
                </motion.button>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>解答モード</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setMode("sequential")}
                  className="flex-1 py-2 rounded-xl font-semibold"
                  style={{ background: mode === "sequential" ? "var(--primary)" : "var(--accent)", color: mode === "sequential" ? "#fff" : "var(--foreground)" }}
                >
                  順次解答
                </button>
                <button
                  onClick={() => setMode("all-at-once")}
                  className="flex-1 py-2 rounded-xl font-semibold"
                  style={{ background: mode === "all-at-once" ? "var(--primary)" : "var(--accent)", color: mode === "all-at-once" ? "#fff" : "var(--foreground)" }}
                >
                  一括解答
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                順次解答: Enterで次の穴埋めへ移動 | 一括解答: すべて入力してから判定
              </p>
            </div>

            {answers.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
                <div className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>自動抽出された答え ({answers.length}個)</div>
                <div className="flex flex-wrap gap-2">
                  {answers.map((ans, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-lg text-sm font-medium" style={{ background: "#22c55e22", color: "#22c55e" }}>
                      {idx + 1}. {ans}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Save size={20} />
            {saving ? "保存中..." : "問題を保存"}
          </button>
        </div>

        <div className="p-6 rounded-2xl sticky top-5 h-fit border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Eye size={20} style={{ color: "var(--primary)" }} />
            <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>テストモードプレビュー</h3>
          </div>
          <div className="p-5 rounded-xl min-h-[300px] border" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
            {title && <h4 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>{title}</h4>}
            <div className="text-lg leading-relaxed pb-8" style={{ color: "var(--foreground)" }}>
              {content ? renderPreview() : <span style={{ color: "var(--muted)" }}>問題文を入力するとプレビューが表示されます</span>}
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl text-xs border" style={{ background: "var(--accent)", color: "var(--foreground)", borderColor: "var(--card-border)" }}>
            💡 ヒント: テキストを選択して「（ ）」ボタンを押すと、自動で穴埋めになります。全角（）でも半角()でもOK！
          </div>
        </div>
      </div>
    </div>
  );
}

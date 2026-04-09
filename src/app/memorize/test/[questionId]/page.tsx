"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Lightbulb } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  title: string;
  content: string;
  answers: string[];
  mode: string;
}

export default function TestPage() {
  const params = useParams();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [hints, setHints] = useState<boolean[]>([]);
  const [startTime] = useState(Date.now());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    void fetchQuestion();
  }, [params.questionId]);

  useEffect(() => {
    if (question && !showResults && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [question, showResults]);

  const fetchQuestion = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const questionId = String(params.questionId || "").trim();
      if (!questionId) {
        setQuestion(null);
        setErrorText("問題IDが不正です");
        return;
      }

      const res = await fetch(`/api/memorize/questions/${questionId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.question) {
        setQuestion(null);
        setErrorText(data?.error || "問題を読み込めませんでした");
        return;
      }
      setQuestion(data.question);
      setUserAnswers(new Array(data.question.answers.length).fill(""));
      setHints(new Array(data.question.answers.length).fill(false));
    } catch (error) {
      console.error("Failed to fetch question:", error);
      setQuestion(null);
      setErrorText("問題の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const normalizeAnswer = (answer: string): string => {
    return answer
      .trim()
      .toLowerCase()
      // Remove all types of brackets and spaces
      .replace(/[（）\(\)\s　]/g, "")
      // Convert full-width alphanumeric to half-width
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      // Convert katakana to hiragana for comparison
      .replace(/[ァ-ン]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
  };

  const checkAnswer = (userAnswer: string, correctAnswer: string): boolean => {
    return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
  };

  const handleSubmit = async () => {
    if (!question) return;

    const newResults = userAnswers.map((ans, idx) => checkAnswer(ans, question.answers[idx]));
    setResults(newResults);
    setShowResults(true);

    const duration = Math.floor((Date.now() - startTime) / 1000);
    const isCorrect = newResults.every((r) => r);

    try {
      await fetch("/api/memorize/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          userAnswers,
          isCorrect,
          duration,
        }),
      });
    } catch (error) {
      console.error("Failed to save attempt:", error);
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = value;
    setUserAnswers(newAnswers);
  };

  const handleKeyPress = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (question?.mode === "sequential") {
        if (index < question.answers.length - 1) {
          inputRefs.current[index + 1]?.focus();
          setCurrentBlankIndex(index + 1);
        } else {
          handleSubmit();
        }
      } else {
        // In all-at-once mode, Enter also submits if all fields are filled
        const allFilled = userAnswers.every((ans) => ans.trim().length > 0);
        if (allFilled) {
          handleSubmit();
        } else {
          // Move to next empty field
          const nextEmptyIndex = userAnswers.findIndex((ans, idx) => idx > index && !ans.trim());
          if (nextEmptyIndex !== -1) {
            inputRefs.current[nextEmptyIndex]?.focus();
            setCurrentBlankIndex(nextEmptyIndex);
          }
        }
      }
    }
  };

  const showHint = (index: number) => {
    const newHints = [...hints];
    newHints[index] = true;
    setHints(newHints);
  };

  if (loading) {
    return <div className="text-center py-12" style={{ color: "var(--muted)" }}>読み込み中...</div>;
  }

  if (!question) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-3">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{errorText || "問題が見つかりません"}</p>
        <Link href="/memorize" className="px-4 py-2 rounded-xl font-semibold inline-block" style={{ background: "var(--primary)", color: "#fff" }}>
          暗記に戻る
        </Link>
      </div>
    );
  }

  // Support both full-width （） and half-width ()
  const parts = question.content.split(/([（(][^）)]+[）)])/g);
  let blankIndex = -1;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium" style={{ color: "var(--primary)" }}>
          <ArrowLeft size={20} />
          戻る
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
          {question.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {question.mode === "sequential" ? "順次解答モード（Enterで次へ）" : "一括解答モード"}
        </p>
      </motion.div>

      <div className="p-8 rounded-2xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="text-xl leading-relaxed" style={{ color: "var(--foreground)" }}>
          {parts.map((part, idx) => {
            if (part.match(/[（(][^）)]+[）)]/)) {
              blankIndex++;
              const currentIdx = blankIndex;
              const answerLength = question.answers[currentIdx]?.length || 5;
              const isCorrect = showResults && results[currentIdx];
              const isWrong = showResults && !results[currentIdx];

              return (
                <span key={idx} className="inline-block relative mx-1">
                  <input
                    ref={(el) => {
                      inputRefs.current[currentIdx] = el;
                    }}
                    type="text"
                    value={userAnswers[currentIdx] || ""}
                    onChange={(e) => handleAnswerChange(currentIdx, e.target.value)}
                    onKeyDown={(e) => handleKeyPress(currentIdx, e)}
                    onFocus={() => setCurrentBlankIndex(currentIdx)}
                    disabled={showResults}
                    className="px-3 py-2 rounded-lg outline-none text-center font-semibold transition-all border-2"
                    style={{
                      width: `${Math.max(answerLength * 1.2, 3)}em`,
                      background: isCorrect ? "#22c55e22" : isWrong ? "#ef444422" : "var(--background)",
                      color: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : "var(--foreground)",
                      borderColor: currentBlankIndex === currentIdx && !showResults ? "var(--primary)" : isCorrect ? "#22c55e" : isWrong ? "#ef4444" : "var(--card-border)",
                    }}
                    placeholder="___"
                  />
                  {!showResults && (
                    <button
                      onClick={() => showHint(currentIdx)}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2 p-1 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: "var(--accent)" }}
                      title="ヒントを表示（長押し）"
                    >
                      <Lightbulb size={14} style={{ color: "var(--primary)" }} />
                    </button>
                  )}
                  {hints[currentIdx] && !showResults && (
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap" style={{ background: "#f59e0b", color: "#fff" }}>
                      {question.answers[currentIdx]?.[0]}...
                    </div>
                  )}
                  {showResults && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      {isWrong && (
                        <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                          正解: {question.answers[currentIdx]}
                        </div>
                      )}
                    </div>
                  )}
                </span>
              );
            }
            return <span key={idx}>{part}</span>;
          })}
        </div>
      </div>

      {!showResults ? (
        <button
          onClick={handleSubmit}
          className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <Check size={20} />
          解答を確認
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl text-center" style={{ background: results.every((r) => r) ? "#22c55e22" : "#ef444422" }}>
            <div className="text-4xl mb-2">
              {results.every((r) => r) ? "🎉" : "💪"}
            </div>
            <div className="text-2xl font-bold mb-2" style={{ color: results.every((r) => r) ? "#22c55e" : "#ef4444" }}>
              {results.every((r) => r) ? "全問正解！" : `${results.filter((r) => r).length} / ${results.length} 正解`}
            </div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              所要時間: {Math.floor((Date.now() - startTime) / 1000)}秒
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setUserAnswers(new Array(question.answers.length).fill(""));
                setShowResults(false);
                setResults([]);
                setHints(new Array(question.answers.length).fill(false));
                setCurrentBlankIndex(0);
                inputRefs.current[0]?.focus();
              }}
              className="flex-1 py-3 rounded-xl font-bold"
              style={{ background: "var(--accent)", color: "var(--foreground)" }}
            >
              もう一度
            </button>
            <Link href="/memorize" className="flex-1 py-3 rounded-xl font-bold text-center" style={{ background: "var(--primary)", color: "#fff" }}>
              暗記に戻る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  title: string;
  content: string;
  answers: string[];
  mode: string;
  createdAt: string;
  attempts: { isCorrect: boolean }[];
}

export default function QuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch("/api/memorize/questions");
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/memorize" className="inline-flex items-center gap-2 mb-3 font-medium" style={{ color: "var(--primary)" }}>
          <ArrowLeft size={20} />
          戻る
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
          穴埋め問題
        </h1>
      </motion.div>

      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>読み込み中...</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>
          問題がありません。新しい問題を作成しましょう。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const router = useRouter();
  const correctCount = question.attempts.filter((a) => a.isCorrect).length;
  const totalAttempts = question.attempts.length;
  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

  return (
    <motion.div whileHover={{ scale: 1.02 }} className="p-5 rounded-2xl" style={{ background: "var(--card)" }}>
      <h3 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>{question.title}</h3>
      <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--muted)" }}>
        {question.content.replace(/\{\{[^}]+\}\}/g, "___")}
      </p>
      <div className="flex items-center gap-3 mb-3 text-sm">
        <span style={{ color: "var(--muted)" }}>{question.answers.length}個の穴埋め</span>
        {totalAttempts > 0 && (
          <span style={{ color: accuracy >= 80 ? "#22c55e" : accuracy >= 50 ? "#f59e0b" : "#ef4444" }}>
            正答率 {accuracy}%
          </span>
        )}
      </div>
      <button
        onClick={() => router.push(`/memorize/test/${question.id}`)}
        className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-2"
        style={{ background: "var(--primary)", color: "#fff" }}
      >
        <Play size={18} />
        テスト開始
      </button>
    </motion.div>
  );
}

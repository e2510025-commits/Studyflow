"use client";

import React from "react";
import StudyTimer from "@/components/timer/StudyTimer";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";

export default function TimerPage() {
  const { timer } = useStore();
  const isIdle = timer.status === "idle";

  return (
    <div className="space-y-6 md:flex md:flex-col md:items-center md:justify-center md:min-h-[calc(100vh-160px)]">
      {/* Page heading — only shown when idle */}
      {isIdle && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1
            className="text-2xl sm:text-4xl font-black"
            style={{ color: "var(--foreground)" }}
          >
            学習タイマー
          </h1>
          <p
            className="text-base mt-1 font-medium"
            style={{ color: "var(--muted)" }}
          >
            教科を選んで、集中モードで学習を始めましょう
          </p>
        </motion.div>
      )}

      <div className="w-full md:max-w-4xl">
        <StudyTimer />
      </div>
    </div>
  );
}

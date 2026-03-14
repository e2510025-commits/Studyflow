"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { subscribeActiveSubjectCount } from "@/lib/firestore/focusRoom";

interface FocusRoomProps {
  subjectName: string;
  subjectColor: string;
}

// Virtual avatars for the room
const AVATARS = [
  "👩‍🎓", "👨‍🎓", "🧑‍💻", "👩‍💻", "👨‍💻",
  "📖", "✏️", "🎯", "🧠", "💡",
  "📚", "🎓", "👩‍🏫", "👨‍🏫", "🧑‍🎓",
];

export default function FocusRoom({ subjectName, subjectColor }: FocusRoomProps) {
  const [count, setCount] = useState(0);
  const [visibleAvatars, setVisibleAvatars] = useState<string[]>([]);

  useEffect(() => {
    return subscribeActiveSubjectCount(subjectName, (nextCount) => {
      setCount(nextCount);
    });
  }, [subjectName]);

  // Pick random avatars to show (max 8)
  useEffect(() => {
    const shown = Math.min(count, 8);
    const picked: string[] = [];
    for (let i = 0; i < shown; i++) {
      const idx = (subjectName.length + i * 7) % AVATARS.length;
      picked.push(AVATARS[idx]);
    }
    setVisibleAvatars(picked);
  }, [count, subjectName]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex flex-col items-center gap-2 py-3"
    >
      {/* Avatar row */}
      <div className="flex items-center -space-x-2">
        <AnimatePresence mode="popLayout">
          {visibleAvatars.map((avatar, i) => (
            <motion.div
              key={`${avatar}-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-[var(--card-bg)]"
              style={{ backgroundColor: subjectColor + "30" }}
            >
              {avatar}
            </motion.div>
          ))}
        </AnimatePresence>
        {count > 8 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[var(--card-bg)]"
            style={{
              backgroundColor: subjectColor + "40",
              color: "var(--text-primary)",
            }}
          >
            +{count - 8}
          </motion.div>
        )}
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Users size={13} className="opacity-60" />
        <span>
          現在、<strong style={{ color: subjectColor }}>{subjectName}</strong>を
          <strong className="text-[var(--text-primary)]">{count}人</strong>が勉強中
        </span>
      </div>

      {/* Subtle pulse dot */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: subjectColor }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: subjectColor }}
          />
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          集中ルーム
        </span>
      </div>
    </motion.div>
  );
}

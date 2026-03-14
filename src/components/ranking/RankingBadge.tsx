"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp } from "lucide-react";
import RankingTrendModal from "./RankingTrendModal";

interface RankingApiResponse {
  myRank: number;
  totalUsers: number;
}

export default function RankingBadge() {
  const { userProfile } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [rank, setRank] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadRank = useCallback(async () => {
    if (!userProfile.uid) {
      setRank(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/ranking?userId=${encodeURIComponent(userProfile.uid)}&period=all&limit=1&offset=0`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("failed to load rank");
      const data = (await res.json()) as RankingApiResponse;
      setRank(Math.max(data.myRank || 0, 1));
    } catch {
      setRank(0);
    } finally {
      setLoading(false);
    }
  }, [userProfile.uid]);

  useEffect(() => {
    void loadRank();
    const intervalId = setInterval(() => {
      void loadRank();
    }, 60000);
    return () => clearInterval(intervalId);
  }, [loadRank]);

  const formattedRank = loading ? "--" : rank > 0 ? rank.toLocaleString() : "-";

  return (
    <>
      <motion.button
        onClick={() => setShowModal(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed top-4 right-16 z-40 h-10 flex items-center gap-2 px-3 rounded-xl glass-card cursor-pointer"
        style={{ padding: "0 12px" }}
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 18 }}
        whileHover={{
          scale: 1.06,
        }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Trophy icon with live pulse */}
        <div className="relative">
          <Trophy size={16} style={{ color: "#FFD700" }} />
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#22c55e" }}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Rank info */}
        <div className="flex flex-col items-start leading-none">
          <span
            className="text-[8px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Rank
          </span>
          <span
            className="text-xs font-black font-mono"
            style={{ color: "var(--foreground)" }}
          >
            #{formattedRank}
          </span>
        </div>

        <TrendingUp
          size={12}
          style={{ color: "var(--muted)", marginLeft: 2 }}
        />

        {/* Tooltip on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg whitespace-nowrap text-[11px] font-medium pointer-events-none"
              style={{
                background: "var(--card-bg)",
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
                backdropFilter: "blur(8px)",
                boxShadow: "var(--shadow)",
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              クリックして詳細を表示
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <RankingTrendModal
        open={showModal}
        onClose={() => setShowModal(false)}
        currentRank={rank}
        rankHistory={[]}
      />
    </>
  );
}

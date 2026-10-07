"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import { Trophy, TrendingUp } from "lucide-react";
import RankingTrendModal from "./RankingTrendModal";
import { fetchRankingData, fetchUserRankHistory, type RankHistoryPoint } from "@/lib/firestore/ranking";

export default function RankingBadge() {
  const { userProfile } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [rank, setRank] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rankHistory, setRankHistory] = useState<RankHistoryPoint[]>([]);

  const loadRank = useCallback(async () => {
    if (!userProfile.uid) {
      setRank(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchRankingData("all");
      const myIndex = rows.findIndex((r) => r.userId === userProfile.uid);
      setRank(myIndex >= 0 ? myIndex + 1 : 0);
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

  useEffect(() => {
    if (!showModal || !userProfile.uid) return;
    void fetchUserRankHistory(userProfile.uid, 21)
      .then((rows) => setRankHistory(rows))
      .catch(() => setRankHistory([]));
  }, [showModal, userProfile.uid]);

  const formattedRank = loading ? "--" : rank > 0 ? rank.toLocaleString() : "-";

  return (
    <>
      <motion.button
        onClick={() => setShowModal(true)}
        className="secondary-button"
        aria-label="ランキング推移を開く"
        aria-haspopup="dialog"
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
        </div>

        {/* Rank info */}
        <div className="flex flex-col items-start leading-none">
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--muted)" }}
          >
            ランキング
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

      </motion.button>

      <RankingTrendModal
        open={showModal}
        onClose={() => setShowModal(false)}
        currentRank={rank}
        rankHistory={rankHistory}
      />
    </>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { UserPlus, Users } from "lucide-react";
import { motion } from "framer-motion";
import { subscribeIncomingFriendRequests } from "@/lib/firestore/friends";

export default function FriendBell() {
  const { userProfile } = useStore();
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeIncomingFriendRequests(userProfile.uid, (rows) => {
      setRequestCount(rows.length);
    });
  }, [userProfile.uid]);

  const visibleRequestCount = userProfile.uid ? requestCount : 0;

  return (
    <motion.div
      className="fixed top-4 right-40 z-50"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href="/friends"
        className="w-10 h-10 rounded-xl flex items-center justify-center glass-card relative"
        title="フレンド"
        aria-label="フレンド"
      >
        {visibleRequestCount > 0 ? (
          <UserPlus size={18} style={{ color: "#ef4444" }} />
        ) : (
          <Users size={18} style={{ color: "var(--foreground)" }} />
        )}

        {visibleRequestCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {visibleRequestCount > 99 ? "99+" : visibleRequestCount}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

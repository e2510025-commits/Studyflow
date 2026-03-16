"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { Mail, MailOpen } from "lucide-react";
import { motion } from "framer-motion";
import { subscribeUnreadDirectMessageCounts } from "@/lib/firestore/chat";

export default function DmBell() {
  const { userProfile } = useStore();
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUnreadDirectMessageCounts(userProfile.uid, (counts) => {
      setUnreadTotal(counts.total);
    });
  }, [userProfile.uid]);

  const visibleUnreadTotal = userProfile.uid ? unreadTotal : 0;

  return (
    <motion.div
      className="fixed top-4 right-28 z-50"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href="/conversations"
        className="w-10 h-10 rounded-xl flex items-center justify-center glass-card relative"
        title="DM"
        aria-label="DM"
      >
        {visibleUnreadTotal > 0 ? (
          <MailOpen size={18} style={{ color: "#ef4444" }} />
        ) : (
          <Mail size={18} style={{ color: "var(--foreground)" }} />
        )}

        {visibleUnreadTotal > 0 && (
          <>
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              {visibleUnreadTotal > 99 ? "99+" : visibleUnreadTotal}
            </span>
            <span
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: "0 0 0 1px #ef444455, 0 0 12px #ef444433" }}
            />
          </>
        )}
      </Link>
    </motion.div>
  );
}

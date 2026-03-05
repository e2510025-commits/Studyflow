"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = "",
  hover = true,
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      className={`glass-card p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={hover ? { scale: 1.01, y: -2 } : undefined}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {children}
    </motion.div>
  );
}

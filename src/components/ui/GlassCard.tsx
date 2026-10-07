"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

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
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={`glass-card p-4 sm:p-6 min-w-0 ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      whileHover={hover && onClick && !reduceMotion ? { y: -2 } : undefined}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {children}
    </motion.div>
  );
}

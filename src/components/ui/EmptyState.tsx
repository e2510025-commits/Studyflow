"use client";

import React from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "var(--accent-light)" }}>
        {icon || <BookOpen size={32} style={{ color: "var(--accent)" }} />}
      </div>
      <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
        {title}
      </h3>
      <p className="max-w-sm" style={{ color: "var(--muted)" }}>
        {description}
      </p>
    </motion.div>
  );
}

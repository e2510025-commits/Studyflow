"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const { theme, setTheme } = useStore();
  const isDark = theme === "dark" || theme === "custom";

  const handleToggle = () => {
    setTheme(isDark ? "white" : "dark");
  };

  return (
    <motion.button
      onClick={handleToggle}
      className="relative w-10 h-10 rounded-xl flex items-center justify-center"
      style={{
        background: "var(--muted-bg)",
        color: "var(--foreground)",
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 0 : 180 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? <Moon size={18} /> : <Sun size={18} />}
      </motion.div>
    </motion.button>
  );
}

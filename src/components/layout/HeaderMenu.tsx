"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Settings,
  LogOut,
  Sliders,
  User,
} from "lucide-react";

function AvatarDisplay({ avatar, size = 40 }: { avatar: string; size?: number }) {
  const isImage = avatar.startsWith("data:") || avatar.startsWith("http");
  if (isImage) {
    return (
      <img
        src={avatar}
        alt="Avatar"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{ width: size, height: size, background: "var(--accent-light)", fontSize: size * 0.5 }}
    >
      {avatar || "🎓"}
    </div>
  );
}

const menuItems = [
  { href: "/my-profile", label: "マイプロフィール", icon: User },
  { href: "/settings", label: "アカウント設定", icon: Settings },
  { href: "/preferences", label: "アプリ設定", icon: Sliders },
];

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { userProfile } = useStore();

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    try {
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    } catch {
      // If next-auth not configured, just redirect
      window.location.href = "/login";
    }
  };

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-50">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-xl flex items-center justify-center glass-card transition-all hover:scale-105 active:scale-95"
        style={{ padding: 0 }}
        aria-label="メニューを開く"
      >
        <Menu size={20} style={{ color: "var(--foreground)" }} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-12 right-0 w-64 rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-bg)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Profile header */}
            <div className="px-4 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-3">
                <AvatarDisplay avatar={userProfile.avatar} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>
                    {userProfile.name || "ユーザー"}
                  </p>
                  <p className="text-[10px] font-mono tracking-wider" style={{ color: "var(--muted)" }}>
                    UID: {userProfile.uid}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all hover:pl-5"
                    style={{ color: "var(--foreground)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--accent-light)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Icon size={16} style={{ color: "var(--muted)" }} />
                    {item.label}
                  </Link>
                );
              })}

              {/* Logout */}
              <div className="my-1 h-px mx-3" style={{ background: "var(--card-border)" }} />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all hover:pl-5"
                style={{ color: "#ef4444" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <LogOut size={16} />
                ログアウト
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

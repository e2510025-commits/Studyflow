"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import { isAdminUid } from "@/lib/admin";
import { subscribeAppVersion } from "@/lib/firestore/appConfig";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Timer,
  BookMarked,
  Trophy,
  Wifi,
  Waves,
  Clipboard,
  ClipboardList,
  Medal,
  Shield,
  X,
  Menu,
} from "lucide-react";

const baseNavItems = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/timer", label: "学習タイマー", icon: Timer },
  { href: "/subjects", label: "教科管理", icon: BookMarked },
  { href: "/ranking", label: "ランキング", icon: Trophy },
  { href: "/global-chat", label: "全体チャット", icon: Wifi },
  { href: "/timeline", label: "タイムライン", icon: Waves },
  { href: "/bulletin", label: "掲示板", icon: Clipboard },
  { href: "/missions", label: "ミッション", icon: ClipboardList },
  { href: "/achievements", label: "アーカイブ", icon: Medal },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, userProfile } = useStore();
  const [appVersion, setAppVersion] = useState("1.0.0");
  const navItems = isAdminUid(userProfile.uid)
    ? [...baseNavItems, { href: "/admin", label: "管理者", icon: Shield }]
    : baseNavItems;

  useEffect(() => {
    return subscribeAppVersion((version) => {
      setAppVersion(version);
    });
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center glass-card"
        style={{ padding: 0 }}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 w-72 glass-sidebar
          flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b"
          style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                StudyFlow
              </h1>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                学習管理アプリ
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
            style={{ color: "var(--muted)" }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: isActive ? "color-mix(in srgb, var(--accent) 24%, transparent)" : "transparent",
                  color: isActive ? "var(--foreground)" : "var(--muted)",
                  border: isActive ? "1px solid color-mix(in srgb, var(--accent) 55%, transparent)" : "1px solid transparent",
                  fontWeight: isActive ? 700 : 500,
                  boxShadow: isActive ? "0 6px 16px rgba(0,0,0,0.14)" : "none",
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                    style={{ background: "var(--accent)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={20} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex flex-col items-center gap-1"
          style={{ borderColor: "var(--card-border)" }}>
          <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded"
            style={{ color: "var(--accent)", background: "var(--accent-light)" }}>
            UID: {userProfile.uid}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            StudyFlow v{appVersion}
          </span>
        </div>
      </aside>
    </>
  );
}

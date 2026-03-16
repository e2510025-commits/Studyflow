"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import Sidebar from "./Sidebar";
import ThemePicker from "./ThemePicker";
import HeaderMenu from "./HeaderMenu";
import RankingBadge from "@/components/ranking/RankingBadge";
import NotificationBell from "./NotificationBell";
import DmBell from "./DmBell";
import { subscribeStudyLogs } from "@/lib/firestore/studyLogs";
import { saveUserProfile } from "@/lib/firestore/ranking";
import { subscribeFriends } from "@/lib/firestore/friends";
import { fetchPublicProfile, saveDisplayProfile } from "@/lib/firestore/profile";
import {
  markNotificationAsRead,
  subscribeUserNotifications,
} from "@/lib/firestore/notifications";
import { sanitizeAvatar, sanitizeDisplayName, toAppUid } from "@/lib/identity";
import {
  ensureDefaultUserSubjects,
  subscribeUserSubjects,
} from "@/lib/firestore/userSubjects";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppNotification } from "@/types";

const BARE_ROUTES = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    theme,
    customBgColor,
    initializeDefaults,
    immersiveMode,
    timer,
    tickTimer,
    setStudyLogs,
    setFriends,
    setSubjects,
    setBonusPoints,
    userProfile,
  } = useStore();
  const pathname = usePathname();
  const isBareRoute = BARE_ROUTES.includes(pathname);
  const isTimerPage = pathname === "/timer";

  // Sidebar hover-reveal on timer page
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [criticalNotice, setCriticalNotice] = useState<AppNotification | null>(null);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (e.clientX <= 12) setSidebarPeek(true);
  }, []);
  useEffect(() => {
    if (!isTimerPage) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isTimerPage, handleMouseMove]);

  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Keep timer ticking globally so it continues even when leaving /timer.
  useEffect(() => {
    if (timer.status !== "running") return;
    const intervalId = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer.status, tickTimer]);

  useEffect(() => {
    let unsubscribeLogs: (() => void) | undefined;
    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeSubjects: (() => void) | undefined;
    let cancelled = false;

    async function syncAuthProfile() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;

        const session = (await response.json()) as {
          user?: { id?: string; name?: string | null; image?: string | null };
        };

        const accountUid = session.user?.id;
        if (!accountUid || cancelled) return;
        const appUid = toAppUid(accountUid);

        const moderationSnap = await getDoc(doc(db, "userModeration", appUid)).catch(() => null);
        const moderation = moderationSnap?.exists() ? moderationSnap.data() : null;
        const suspendedUntil = moderation?.suspendedUntil
          ? new Date(moderation.suspendedUntil).getTime()
          : 0;
        const now = Date.now();
        const isBanned = Boolean(moderation?.banned);
        const isSuspended = suspendedUntil > now;

        if (isBanned || isSuspended) {
          alert(isBanned ? "このアカウントは利用停止されています。" : "このアカウントは一時利用停止中です。");
          window.location.href = "/announcements";
          return;
        }

        const storedProfile =
          (await fetchPublicProfile(appUid).catch(() => null)) ||
          (await fetchPublicProfile(accountUid).catch(() => null));
        const needsProfileSetup = storedProfile ? !storedProfile.profileSetupDone : true;
        const resolvedName = sanitizeDisplayName(storedProfile?.name || session.user?.name || "匿名");
        const resolvedAvatar = sanitizeAvatar(storedProfile?.avatar || session.user?.image || "👤");
        const resolvedBonusPoints = Math.max(0, Math.floor(storedProfile?.bonusPoints || 0));

        useStore.setState((state) => {
          const switchedAccount = state.userProfile.uid !== appUid;
          return {
            subjects: switchedAccount ? [] : state.subjects,
            studyLogs: switchedAccount ? [] : state.studyLogs,
            friends: switchedAccount ? [] : state.friends,
            chatMessages: switchedAccount ? [] : state.chatMessages,
            userProfile: {
              ...state.userProfile,
              uid: appUid,
              name: resolvedName,
              avatar: resolvedAvatar,
              bonusPoints: resolvedBonusPoints,
              totalPoints:
                typeof storedProfile?.totalPoints === "number"
                  ? storedProfile.totalPoints
                  : state.userProfile.totalPoints,
            },
          };
        });
        setBonusPoints(resolvedBonusPoints);

        await ensureDefaultUserSubjects(appUid);

        unsubscribeLogs = subscribeStudyLogs(appUid, (logs) => {
          setStudyLogs(logs);
        });
        unsubscribeFriends = subscribeFriends(appUid, (friends) => {
          setFriends(friends);
        });
        unsubscribeSubjects = subscribeUserSubjects(appUid, (subjects) => {
          setSubjects(subjects);
        });

        const current = useStore.getState().userProfile;
        if (current.name) {
          void saveUserProfile(appUid, current.name, current.avatar).catch(() => {});
          void saveDisplayProfile({
            uid: appUid,
            name: current.name,
            avatar: current.avatar,
            dailyGoal: current.dailyGoal,
            totalPoints: current.totalPoints,
            bonusPoints: current.bonusPoints || 0,
            profileSetupDone: needsProfileSetup ? false : true,
          }).catch(() => {});
        }

        if (needsProfileSetup && pathname !== "/settings") {
          window.location.href = "/settings";
          return;
        }
      } catch {
        // ignore session sync failures and keep local store state
      }
    }

    void syncAuthProfile();

    return () => {
      cancelled = true;
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeFriends) unsubscribeFriends();
      if (unsubscribeSubjects) unsubscribeSubjects();
    };
  }, [pathname, setBonusPoints, setFriends, setStudyLogs, setSubjects]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUserNotifications(userProfile.uid, (rows) => {
      const critical = rows.find(
        (row) =>
          !row.read &&
          (row.type === "warning" || row.type === "ban" || row.type === "suspend")
      );
      setCriticalNotice(critical || null);
    });
  }, [userProfile.uid]);

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    // Remove all theme classes
    html.classList.remove("theme-white", "theme-gray", "theme-dark", "theme-custom", "dark");

    if (theme === "custom") {
      html.classList.add("theme-custom");
    } else {
      html.classList.add(`theme-${theme}`);
    }

    // Also add "dark" class for dark & custom (affects any Tailwind dark: utilities)
    if (theme === "dark" || theme === "custom") {
      html.classList.add("dark");
    }
  }, [theme]);

  // For custom theme, set the background color as a CSS variable on <html>
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "custom") {
      html.style.setProperty("--page-bg", customBgColor);
      html.style.setProperty("--background", customBgColor);
    } else {
      html.style.removeProperty("--page-bg");
      html.style.removeProperty("--background");
    }
  }, [theme, customBgColor]);

  if (isBareRoute) {
    return <div className="bg-gradient-main min-h-screen">{children}</div>;
  }

  return (
    <div className="bg-gradient-main">
      {/* Sidebar: on timer page, auto-hide with hover-reveal */}
      {!immersiveMode && (
        <>
          {isTimerPage ? (
            <>
              {/* Invisible hover zone on left edge */}
              <div
                className="fixed top-0 left-0 w-3 h-full z-[55]"
                onMouseEnter={() => setSidebarPeek(true)}
                onTouchStart={() => setSidebarPeek(true)}
              />
              {/* Peek overlay to close */}
              {sidebarPeek && (
                <div
                  className="fixed inset-0 z-[44]"
                  onClick={() => setSidebarPeek(false)}
                  onMouseEnter={(e) => {
                    if (e.clientX > 288) setSidebarPeek(false);
                  }}
                />
              )}
              <div
                className="transition-transform duration-300 ease-in-out z-[52]"
                style={{
                  transform: sidebarPeek ? "translateX(0)" : "translateX(-100%)",
                  position: "fixed",
                  top: 0,
                  left: 0,
                  height: "100%",
                }}
                onMouseLeave={() => setSidebarPeek(false)}
              >
                <Sidebar />
              </div>
            </>
          ) : (
            <Sidebar />
          )}
        </>
      )}
      {!immersiveMode && (
        <>
          <HeaderMenu />
          <DmBell />
          <NotificationBell />
          <RankingBadge />
        </>
      )}
      <main
        className={
          immersiveMode
            ? "min-h-screen"
            : isTimerPage
            ? "min-h-screen transition-all duration-700"
            : "lg:pl-72 min-h-screen transition-all duration-700"
        }
      >
        <div
          className={
            immersiveMode
              ? "w-full"
              : isTimerPage
              ? "px-3 sm:px-5 lg:px-8 py-4 pt-16 w-full"
              : "px-3 sm:px-5 lg:px-8 py-4 pt-16 lg:pt-6 w-full"
          }
        >
          {children}
        </div>
      </main>

      {criticalNotice && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" style={{ background: "rgba(0, 0, 0, 0.65)" }}>
          <div
            className="w-full max-w-xl rounded-3xl p-6 border-2"
            style={{
              background: "var(--card-bg)",
              borderColor:
                criticalNotice.type === "ban"
                  ? "#ef4444"
                  : criticalNotice.type === "suspend"
                  ? "#f59e0b"
                  : "#eab308",
              boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
            }}
          >
            <p
              className="text-xs font-black tracking-[0.16em]"
              style={{
                color:
                  criticalNotice.type === "ban"
                    ? "#ef4444"
                    : criticalNotice.type === "suspend"
                    ? "#f59e0b"
                    : "#ca8a04",
              }}
            >
              IMPORTANT NOTICE
            </p>
            <h2 className="text-2xl font-black mt-2" style={{ color: "var(--foreground)" }}>
              {criticalNotice.title}
            </h2>
            <p className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: "var(--foreground)" }}>
              {criticalNotice.body}
            </p>

            <div className="mt-5 grid sm:grid-cols-2 gap-2">
              <button
                className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "white" }}
                onClick={() => {
                  void markNotificationAsRead(criticalNotice.id).finally(() => {
                    window.location.href = criticalNotice.link || "/announcements";
                  });
                }}
              >
                お知らせを確認する
              </button>
              <button
                className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                onClick={() => {
                  void markNotificationAsRead(criticalNotice.id).finally(() => {
                    setCriticalNotice(null);
                  });
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      {!immersiveMode && <ThemePicker />}
    </div>
  );
}

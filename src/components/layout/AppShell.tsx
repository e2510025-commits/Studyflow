"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import Sidebar from "./Sidebar";
import ThemePicker from "./ThemePicker";
import HeaderMenu from "./HeaderMenu";
import RankingBadge from "@/components/ranking/RankingBadge";
import FriendRequestBell from "./FriendRequestBell";
import { subscribeStudyLogs } from "@/lib/firestore/studyLogs";
import { saveUserProfile } from "@/lib/firestore/ranking";
import { subscribeFriends } from "@/lib/firestore/friends";
import { fetchDisplayProfile, saveDisplayProfile } from "@/lib/firestore/profile";
import { sanitizeAvatar, sanitizeDisplayName, toAppUid } from "@/lib/identity";
import {
  ensureDefaultUserSubjects,
  subscribeUserSubjects,
} from "@/lib/firestore/userSubjects";

const BARE_ROUTES = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    theme,
    customBgColor,
    initializeDefaults,
    immersiveMode,
    setStudyLogs,
    setFriends,
    setSubjects,
  } = useStore();
  const pathname = usePathname();
  const isBareRoute = BARE_ROUTES.includes(pathname);
  const isTimerPage = pathname === "/timer";

  // Sidebar hover-reveal on timer page
  const [sidebarPeek, setSidebarPeek] = useState(false);
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

        const storedProfile =
          (await fetchDisplayProfile(appUid).catch(() => null)) ||
          (await fetchDisplayProfile(accountUid).catch(() => null));
        const resolvedName = sanitizeDisplayName(storedProfile?.name || session.user?.name || "匿名");
        const resolvedAvatar = sanitizeAvatar(storedProfile?.avatar || session.user?.image || "👤");

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
            },
          };
        });

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
          }).catch(() => {});
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
  }, [setFriends, setStudyLogs, setSubjects]);

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
          <FriendRequestBell />
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
      {!immersiveMode && <ThemePicker />}
    </div>
  );
}

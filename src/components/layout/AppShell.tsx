"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import Sidebar from "./Sidebar";
import ThemePicker from "./ThemePicker";
import HeaderMenu from "./HeaderMenu";
import RankingBadge from "@/components/ranking/RankingBadge";
import NotificationBell from "./NotificationBell";
import DmBell from "./DmBell";
import FriendBell from "./FriendBell";
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
import { updateUserPresence } from "@/lib/firestore/presence";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppNotification } from "@/types";
import { getAchievementMeta } from "@/lib/achievements";

const BARE_ROUTES = ["/login", "/register"];

function getPresenceSessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "studyflow-presence-session-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `sess_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function detectOsLabel(): string {
  if (typeof navigator === "undefined") return "Unknown OS";
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;

  if (/ipad/.test(ua) || (/macintosh/.test(ua) && hasTouch)) return "iPad OS";
  if (/iphone|ipod/.test(ua)) return "iOS";
  if (/android/.test(ua)) return "Android OS";
  if (/cros/.test(ua)) return "Chrome OS";
  if (/windows/.test(ua)) return "Windows";
  if (/mac os|macintosh/.test(ua)) return "macOS";
  if (/linux|x11/.test(ua)) return "Linux";
  return "Unknown OS";
}

function detectBrowserLabel(): string {
  if (typeof navigator === "undefined") return "Unknown Browser";
  const ua = navigator.userAgent.toLowerCase();
  if (/edg\//.test(ua)) return "Edge";
  if (/opr\//.test(ua) || /opera/.test(ua)) return "Opera";
  if (/firefox\//.test(ua)) return "Firefox";
  if (/chrome\//.test(ua) && !/edg\//.test(ua) && !/opr\//.test(ua)) return "Chrome";
  if (/safari\//.test(ua) && !/chrome\//.test(ua)) return "Safari";
  return "Unknown Browser";
}

function detectPresenceAgentLabel(): string {
  return `${detectOsLabel()} / ${detectBrowserLabel()}`;
}

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
    updateUserProfile,
    userProfile,
    studyLogs,
  } = useStore();
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isBareRoute = BARE_ROUTES.includes(normalizedPathname);
  const isTimerPage = normalizedPathname === "/timer" || normalizedPathname.startsWith("/timer/");
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const useTimerPeekSidebar = isTimerPage && !isTouchDevice;

  // Sidebar hover-reveal on timer page
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [criticalNotice, setCriticalNotice] = useState<AppNotification | null>(null);
  const [awardQueue, setAwardQueue] = useState<string[]>([]);
  const [currentAward, setCurrentAward] = useState<string | null>(null);
  const announcedAwardsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsTouchDevice((navigator.maxTouchPoints || 0) > 0);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (e.clientX <= 12) setSidebarPeek(true);
  }, []);
  useEffect(() => {
    if (!useTimerPeekSidebar) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [useTimerPeekSidebar, handleMouseMove]);

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
              badges: Array.isArray(storedProfile?.badges) ? storedProfile.badges : [],
              achievementUnlockedAt:
                typeof storedProfile?.achievementUnlockedAt === "object" && storedProfile?.achievementUnlockedAt
                  ? (storedProfile.achievementUnlockedAt as Record<string, string>)
                  : {},
              equippedBadges: Array.isArray(storedProfile?.equippedBadges)
                ? storedProfile.equippedBadges.slice(0, 3)
                : [],
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

  useEffect(() => {
    if (!userProfile.uid) return;
    let disposed = false;
    let timeoutId: NodeJS.Timeout;

    const syncBadges = async () => {
      try {
        const profile = await fetchPublicProfile(userProfile.uid).catch(() => null);
        if (!profile || disposed) return;

        const nextBadges = Array.isArray(profile.badges)
          ? profile.badges.filter((x) => typeof x === "string")
          : [];
        const nextUnlockMap =
          profile.achievementUnlockedAt && typeof profile.achievementUnlockedAt === "object"
            ? (profile.achievementUnlockedAt as Record<string, string>)
            : {};
        const nextEquipped = Array.isArray(profile.equippedBadges)
          ? profile.equippedBadges.filter((x) => typeof x === "string").slice(0, 3)
          : [];

        const currentBadges = Array.isArray(useStore.getState().userProfile.badges)
          ? (useStore.getState().userProfile.badges as string[])
          : [];
        const newlyUnlocked = nextBadges.filter(
          (id) => !currentBadges.includes(id) && !announcedAwardsRef.current.has(id)
        );

        updateUserProfile({
          badges: nextBadges,
          achievementUnlockedAt: nextUnlockMap,
          equippedBadges: nextEquipped,
        });

        if (newlyUnlocked.length > 0) {
          newlyUnlocked.forEach((id) => announcedAwardsRef.current.add(id));
          setAwardQueue((prev) => [...prev, ...newlyUnlocked.filter((id) => !prev.includes(id))]);
        }
      } catch {
        // ignore profile polling errors
      }

      if (!disposed) {
        // Poll every 30 seconds instead of 5 seconds to reduce reads
        timeoutId = setTimeout(syncBadges, 30000);
      }
    };

    void syncBadges();

    return () => {
      disposed = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [userProfile.uid, updateUserProfile]);

  useEffect(() => {
    if (currentAward || awardQueue.length === 0) return;
    const [next, ...rest] = awardQueue;
    setCurrentAward(next);
    setAwardQueue(rest);

    try {
      const audioCtx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.2);
      });
      window.setTimeout(() => void audioCtx.close(), 600);
    } catch {
      // ignore sfx failures
    }
  }, [awardQueue, currentAward]);

  useEffect(() => {
    if (!userProfile.uid) return;

    const runDispatch = () => {
      void fetch("/api/announcements/dispatch-scheduled", {
        method: "POST",
        cache: "no-store",
      }).catch(() => {});
    };

    runDispatch();
    const intervalId = window.setInterval(runDispatch, 2 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [userProfile.uid]);

  useEffect(() => {
    if (!userProfile.uid) return;

    let disposed = false;
    const sessionId = getPresenceSessionId();
    const agentLabel = detectPresenceAgentLabel();

    const upsert = (online: boolean) => {
      if (disposed) return;
      void updateUserPresence(userProfile.uid, online, { sessionId, agentLabel }).catch(() => {});
    };

    upsert(true);

    const onVisibility = () => {
      upsert(document.visibilityState === "visible");
    };
    const onFocus = () => upsert(true);
    const onBlur = () => upsert(false);
    const onBeforeUnload = () => {
      void updateUserPresence(userProfile.uid, false, { sessionId, agentLabel }).catch(() => {});
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Heartbeat so active sessions remain online even without user interactions.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        upsert(true);
      }
    }, 45_000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void updateUserPresence(userProfile.uid, false, { sessionId, agentLabel }).catch(() => {});
    };
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
          {useTimerPeekSidebar ? (
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
          <FriendBell />
          <DmBell />
          <NotificationBell />
          <RankingBadge />
        </>
      )}
      <main
        className={
          immersiveMode
            ? "min-h-screen"
            : useTimerPeekSidebar
            ? "min-h-screen transition-all duration-700"
            : "lg:pl-72 min-h-screen transition-all duration-700"
        }
      >
        <div
          className={
            immersiveMode
              ? "w-full"
              : useTimerPeekSidebar
              ? "px-3 sm:px-5 lg:px-8 py-4 pt-16 w-full max-w-screen-2xl mx-auto"
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

      {currentAward && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center p-4" style={{ background: "rgba(3,7,18,0.72)" }}>
          <div
            className="w-full max-w-lg rounded-3xl p-6 border"
            style={{
              background: "linear-gradient(145deg, rgba(8,47,73,0.95), rgba(15,23,42,0.96))",
              borderColor: "rgba(34,211,238,0.5)",
              boxShadow: "0 28px 64px rgba(8,47,73,0.45)",
            }}
          >
            <p className="text-xs font-black tracking-[0.18em]" style={{ color: "#67e8f9" }}>
              ACHIEVEMENT UNLOCKED
            </p>
            <h2 className="text-2xl mt-2 font-black" style={{ color: "#f8fafc" }}>
              勲章授与
            </h2>
            <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.78)", border: "1px solid rgba(34,211,238,0.35)" }}>
              <p className="text-lg font-extrabold" style={{ color: "#e2e8f0" }}>
                {getAchievementMeta(currentAward)?.title || currentAward}
              </p>
              <p className="text-sm mt-1" style={{ color: "#cbd5e1" }}>
                {getAchievementMeta(currentAward)?.description || "新しい実績を獲得しました"}
              </p>
              <p className="text-xs mt-2 uppercase tracking-[0.14em]" style={{ color: "#a5f3fc" }}>
                {getAchievementMeta(currentAward)?.rarity || "rare"}
              </p>
            </div>
            <button
              className="mt-5 w-full px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#22d3ee", color: "#082f49" }}
              onClick={() => setCurrentAward(null)}
            >
              受け取る
            </button>
          </div>
        </div>
      )}
      {!immersiveMode && <ThemePicker />}
    </div>
  );
}

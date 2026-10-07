"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import { MotionConfig } from "framer-motion";
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

const BARE_ROUTES = ["/login", "/register", "/onboarding"];

function isChunkLoadFailure(reason: unknown): boolean {
  const text =
    typeof reason === "string"
      ? reason
      : reason instanceof Error
        ? reason.message
        : typeof reason === "object" && reason !== null && "message" in reason
          ? String((reason as { message?: unknown }).message ?? "")
          : "";

  if (!text) return false;
  const lowered = text.toLowerCase();
  return (
    lowered.includes("chunkloaderror") ||
    lowered.includes("failed to load chunk") ||
    lowered.includes("loading chunk")
  );
}

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
    advanceTimerBy,
    setStudyLogs,
    setFriends,
    setSubjects,
    setBonusPoints,
    userProfile,
  } = useStore();
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isBareRoute = BARE_ROUTES.includes(normalizedPathname);
  const [criticalNotice, setCriticalNotice] = useState<AppNotification | null>(null);
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const announcedBrowserNotificationIdsRef = useRef<Set<string>>(new Set());
  const timerLastTickMsRef = useRef<number>(0);

  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Recover from stale client runtime after deploy by forcing a single hard reload.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reloadKey = "studyflow-chunk-reload-once";
    const canReload = !window.sessionStorage.getItem(reloadKey);

    const triggerReload = () => {
      if (!canReload) return;
      window.sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        event.preventDefault();
        triggerReload();
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message || "";
      if (isChunkLoadFailure(message)) {
        event.preventDefault();
        triggerReload();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
    };
  }, []);

  // Keep timer synced with wall clock so hidden tabs can catch up after throttling.
  useEffect(() => {
    if (timer.status !== "running") {
      timerLastTickMsRef.current = Date.now();
      return;
    }

    const flushElapsed = () => {
      const now = Date.now();
      const deltaSec = Math.floor((now - timerLastTickMsRef.current) / 1000);
      if (deltaSec > 0) {
        advanceTimerBy(deltaSec);
        timerLastTickMsRef.current += deltaSec * 1000;
      }
    };

    const intervalId = window.setInterval(flushElapsed, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        flushElapsed();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", flushElapsed);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", flushElapsed);
    };
  }, [advanceTimerBy, timer.status]);

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
              dailyGoal: typeof storedProfile?.dailyGoal === "number" && Number.isFinite(storedProfile.dailyGoal)
                ? storedProfile.dailyGoal
                : switchedAccount ? 7200 : state.userProfile.dailyGoal,
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

        if (needsProfileSetup && !normalizedPathname.startsWith("/onboarding")) {
          window.location.href = "/onboarding";
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
  }, [normalizedPathname, pathname, setBonusPoints, setFriends, setStudyLogs, setSubjects]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUserNotifications(userProfile.uid, (rows) => {
      setAllNotifications(rows);
      const critical = rows.find(
        (row) =>
          !row.read &&
          (row.type === "warning" || row.type === "ban" || row.type === "suspend")
      );
      setCriticalNotice(critical || null);
    });
  }, [userProfile.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userProfile.uid) {
      announcedBrowserNotificationIdsRef.current = new Set();
      return;
    }

    const key = `studyflow_browser_notified_${userProfile.uid}`;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [];
      announcedBrowserNotificationIdsRef.current = new Set(ids.slice(-300));
    } catch {
      announcedBrowserNotificationIdsRef.current = new Set();
    }
  }, [userProfile.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userProfile.uid || allNotifications.length === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;

    const unread = allNotifications.filter((row) => !row.read).slice(0, 10).reverse();
    if (unread.length === 0) return;

    const key = `studyflow_browser_notified_${userProfile.uid}`;

    const deliver = async () => {
      for (const row of unread) {
        if (announcedBrowserNotificationIdsRef.current.has(row.id)) continue;

        const notificationTitle = row.title || "StudyFlow 通知";
        const notificationBody = row.body || "新しいお知らせがあります";
        const targetUrl = row.link || "/announcements";

        try {
          const registration = "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration()
            : null;
          if (registration) {
            await registration.showNotification(notificationTitle, {
              body: notificationBody,
              icon: "/logo.png",
              badge: "/favicon.png",
              tag: `studyflow_${row.id}`,
              data: { url: targetUrl },
            });
          } else {
            new Notification(notificationTitle, {
              body: notificationBody,
              icon: "/logo.png",
              tag: `studyflow_${row.id}`,
            });
          }
        } catch {
          // ignore notification display errors
        }

        announcedBrowserNotificationIdsRef.current.add(row.id);
      }

      try {
        const compact = Array.from(announcedBrowserNotificationIdsRef.current).slice(-300);
        window.localStorage.setItem(key, JSON.stringify(compact));
      } catch {
        // ignore persistence failures
      }
    };

    void deliver();
  }, [allNotifications, userProfile.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // ignore service worker registration errors
      }
    };

    void register();
  }, []);

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
    <MotionConfig reducedMotion="user">
    <div className="bg-gradient-main">
      {!immersiveMode && (
        <>
          <a className="skip-link" href="#main-content">本文へ移動</a>
          <Sidebar />
          <AppHeader />
        </>
      )}
      <main id="main-content" tabIndex={-1} className={immersiveMode ? "immersive-main" : "app-main"}>
        <div className={immersiveMode ? "w-full" : "app-content"} data-screen={pathname.split("/")[1] || "home"} data-detail={pathname.split("/").filter(Boolean).length > 1 ? "true" : undefined}>{children}</div>
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

    </div>
    </MotionConfig>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BellRing, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function DesktopAppActions() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "default";
    return Notification.permission;
  });
  const [standalone, setStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandaloneDisplay();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onModeChange = () => setStandalone(isStandaloneDisplay());
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", onModeChange);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      mq.removeEventListener("change", onModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const showInstall = useMemo(() => Boolean(installPrompt) && !standalone, [installPrompt, standalone]);
  const showNotificationEnable = useMemo(
    () => typeof window !== "undefined" && "Notification" in window && notificationPermission === "default",
    [notificationPermission]
  );

  if (!showInstall && !showNotificationEnable) return null;

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  };

  const triggerInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-4 right-64 z-50 hidden lg:flex items-center gap-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        {showNotificationEnable && (
          <button
            onClick={() => void requestNotificationPermission()}
            className="h-10 px-3 rounded-xl glass-card inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--foreground)" }}
            title="ブラウザ通知を有効化"
          >
            <BellRing size={14} />
            通知ON
          </button>
        )}

        {showInstall && (
          <button
            onClick={() => void triggerInstall()}
            className="h-10 px-3 rounded-xl glass-card inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--foreground)" }}
            title="PCでアプリとしてインストール"
          >
            <Download size={14} />
            アプリ化
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Clock,
  Timer as TimerIcon,
  Coffee,
  Zap,
  Volume2,
  VolumeX,
  Settings,
  SkipForward,
  Target,
  Flame,
  Trophy,
  Maximize2,
  Minimize2,
  ClipboardList,
} from "lucide-react";
import {
  formatTime,
  formatHoursMinutes,
  getTodayLogs,
  getTotalDuration,
} from "@/lib/utils";
import SubjectSelector from "./SubjectSelector";
import MemoDialog from "./MemoDialog";
import FullscreenWave from "./FullscreenWave";
import FocusRoom from "./FocusRoom";
import { upsertStudyLogById } from "@/lib/firestore/studyLogs";
import { upsertActiveStudySession } from "@/lib/firestore/focusRoom";
import { upsertSubjectCatalog } from "@/lib/firestore/subjects";
import {
  createUserTodo,
  markTodoDone,
  subscribeUserTodos,
  type UserTodo,
} from "@/lib/firestore/todos";
import {
  deletePomodoroPreset,
  savePomodoroPreset,
  subscribePomodoroPresets,
  type PomodoroPreset,
} from "@/lib/firestore/pomodoroPresets";
import { createAutoStudyTimelinePost } from "@/lib/firestore/community";

/* ─── Sound helper ────────────────────────────────────── */
function playSound(type: "complete" | "break") {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";

    if (type === "complete") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(1319, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } else {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch {
    // AudioContext not available
  }
}

/* ─── Main component ──────────────────────────────────── */
export default function StudyTimer() {
  const {
    timer,
    subjects,
    studyLogs,
    userProfile,
    setTimerSubject,
    setTimerMode,
    setCountdownTotal,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    pomodoroConfig,
    pomodoroState,
    setPomodoroConfig,
    pomodoroNextPhase,
    pomodoroReset,
    soundEnabled,
    toggleSound,
    immersiveMode,
    setImmersiveMode,
  } = useStore();

  const [showMemo, setShowMemo] = useState(false);
  const [finishedDuration, setFinishedDuration] = useState(0);
  const [showPomSettings, setShowPomSettings] = useState(false);
  const [todos, setTodos] = useState<UserTodo[]>([]);
  const [selectedTodoId, setSelectedTodoId] = useState("");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPages, setNewTodoPages] = useState("");
  const [completeTodoOnSave, setCompleteTodoOnSave] = useState(true);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<PomodoroPreset[]>([]);
  const [autoTimelinePost, setAutoTimelinePost] = useState(true);

  /* ── Focus Bonus tracking (visibility API) ─────────── */
  const [focusLost, setFocusLost] = useState(false);
  const focusBonusActive = !focusLost && timer.status !== "idle";

  useEffect(() => {
    // Reset focus tracking when timer starts fresh
    if (timer.status === "idle") {
      setFocusLost(false);
    }
  }, [timer.status]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const handleVisChange = () => {
      if (document.visibilityState === "hidden") {
        setFocusLost(true);
      }
    };
    const handleBlur = () => {
      setFocusLost(true);
    };
    document.addEventListener("visibilitychange", handleVisChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [timer.status]);

  const selectedSubject = subjects.find(
    (s) => s.id === timer.selectedSubjectId
  );
  const liveSessionRef = useRef<{
    id: string;
    createdAt: Date;
    subjectId: string;
    subjectName: string;
  } | null>(null);
  const isWorkPhase = timer.mode !== "pomodoro" || pomodoroState.phase === "work";

  const ensureLiveSession = useCallback(() => {
    if (liveSessionRef.current) return liveSessionRef.current;
    if (!userProfile.uid || !timer.selectedSubjectId || !selectedSubject) return null;
    const now = new Date();
    const session = {
      id: `live_${userProfile.uid}_${now.getTime()}`,
      createdAt: now,
      subjectId: timer.selectedSubjectId,
      subjectName: selectedSubject.name,
    };
    liveSessionRef.current = session;
    return session;
  }, [selectedSubject, timer.selectedSubjectId, userProfile.uid]);

  const persistElapsedProgress = useCallback(
    (durationSeconds: number, options?: { memo?: string; focusRating?: number; force?: boolean; finalize?: boolean }) => {
      if (!userProfile.uid || durationSeconds <= 0) return;
      if (!timer.selectedSubjectId || !selectedSubject) return;
      if (!isWorkPhase) return;

      const effectiveDuration = Math.max(0, Math.floor(durationSeconds));
      if (!options?.force && effectiveDuration < 15) return;

      const session = ensureLiveSession();
      if (!session) return;

      const basePoints = Math.floor(effectiveDuration / 60);
      const points = focusBonusActive ? Math.floor(basePoints * 1.2) : basePoints;

      void upsertStudyLogById(
        userProfile.uid,
        session.id,
        {
          subjectId: session.subjectId,
          duration: effectiveDuration,
          memo: options?.memo ?? "",
          focusRating: options?.focusRating,
          focusBonus: focusBonusActive,
          points,
        },
        {
          createdAt: session.createdAt,
          userProfile: { name: userProfile.name, avatar: userProfile.avatar },
          recomputeAchievements: false, // 実績機能は終了。既存データは保持。
        }
      ).catch(() => {});

      void upsertSubjectCatalog(session.subjectName).catch(() => {});

      if (options?.finalize) {
        liveSessionRef.current = null;
      }
    },
    [
      ensureLiveSession,
      focusBonusActive,
      isWorkPhase,
      selectedSubject,
      timer.selectedSubjectId,
      userProfile.avatar,
      userProfile.name,
      userProfile.uid,
    ]
  );

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUserTodos(userProfile.uid, setTodos);
  }, [userProfile.uid]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribePomodoroPresets(userProfile.uid, setPresets);
  }, [userProfile.uid]);

  useEffect(() => {
    const raw = window.localStorage.getItem("studyflow:autoTimelinePost");
    if (raw === "0") setAutoTimelinePost(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("studyflow:autoTimelinePost", autoTimelinePost ? "1" : "0");
  }, [autoTimelinePost]);

  const activeTodos = useMemo(() => todos.filter((row) => !row.done), [todos]);
  const selectedTodo = useMemo(
    () => activeTodos.find((row) => row.id === selectedTodoId),
    [activeTodos, selectedTodoId]
  );

  useEffect(() => {
    const shouldBeActive = Boolean(
      userProfile.uid && selectedSubject?.name && timer.status === "running"
    );

    if (!userProfile.uid || !selectedSubject?.name) {
      return;
    }

    void upsertActiveStudySession({
      userUid: userProfile.uid,
      userName: userProfile.name,
      userAvatar: userProfile.avatar,
      subjectName: selectedSubject.name,
      isActive: shouldBeActive,
    }).catch(() => {});

    return () => {
      void upsertActiveStudySession({
        userUid: userProfile.uid,
        userName: userProfile.name,
        userAvatar: userProfile.avatar,
        subjectName: selectedSubject.name,
        isActive: false,
      }).catch(() => {});
    };
  }, [userProfile.uid, userProfile.name, userProfile.avatar, selectedSubject?.name, timer.status]);

  useEffect(() => {
    if (!userProfile.uid || !selectedSubject?.name || timer.status !== "running") {
      return;
    }

    const intervalId = setInterval(() => {
      void upsertActiveStudySession({
        userUid: userProfile.uid,
        userName: userProfile.name,
        userAvatar: userProfile.avatar,
        subjectName: selectedSubject.name,
        isActive: true,
      }).catch(() => {});
    }, 60000);

    return () => clearInterval(intervalId);
  }, [userProfile.uid, userProfile.name, userProfile.avatar, selectedSubject?.name, timer.status]);

  useEffect(() => {
    if (timer.status !== "running" || !isWorkPhase) return;

    const intervalId = window.setInterval(() => {
      persistElapsedProgress(timer.elapsed);
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isWorkPhase, persistElapsedProgress, timer.elapsed, timer.status]);

  useEffect(() => {
    if (timer.status !== "running") return;

    const flush = () => {
      persistElapsedProgress(timer.elapsed, { force: true });
    };

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [persistElapsedProgress, timer.elapsed, timer.status]);

  useEffect(() => {
    if (timer.status === "idle") {
      liveSessionRef.current = null;
    }
  }, [timer.status]);

  /* ── Today's stats ─────────────────────────────────── */
  const todayLogs = useMemo(() => getTodayLogs(studyLogs), [studyLogs]);
  const todayTotal = useMemo(() => getTotalDuration(todayLogs), [todayLogs]);
  const todaySessions = todayLogs.length;
  const dailyGoalProgress = Math.min(
    todayTotal / (userProfile.dailyGoal || 1),
    1
  );

  /* ── Current phase total ───────────────────────────── */
  const currentPhaseTotal = useMemo(() => {
    if (timer.mode === "pomodoro") {
      switch (pomodoroState.phase) {
        case "work":
          return pomodoroConfig.workDuration;
        case "shortBreak":
          return pomodoroConfig.shortBreakDuration;
        case "longBreak":
          return pomodoroConfig.longBreakDuration;
      }
    }
    return timer.countdownTotal;
  }, [timer.mode, timer.countdownTotal, pomodoroState.phase, pomodoroConfig]);

  /* ── Auto-complete ────────────────────────────────── */
  const autoCompleteRef = useRef<() => void>(() => {});
  autoCompleteRef.current = () => {
    if (timer.status !== "running") return;

    if (timer.mode === "countdown" && timer.elapsed >= timer.countdownTotal) {
      if (soundEnabled) playSound("complete");
      if (timer.elapsed > 0 && timer.selectedSubjectId) {
        persistElapsedProgress(timer.elapsed, { force: true });
        setFinishedDuration(timer.elapsed);
        setShowMemo(true);
        pauseTimer();
      }
      return;
    }

    if (timer.mode === "pomodoro" && timer.elapsed >= currentPhaseTotal) {
      if (pomodoroState.phase === "work") {
        if (soundEnabled) playSound("complete");
        if (timer.selectedSubjectId) {
          persistElapsedProgress(currentPhaseTotal, { force: true });
          setFinishedDuration(currentPhaseTotal);
          setShowMemo(true);
        }
        pauseTimer();
      } else {
        if (soundEnabled) playSound("break");
        pomodoroNextPhase();
      }
    }
  };

  useEffect(() => {
    autoCompleteRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.elapsed]);

  /* ── Display values ────────────────────────────────── */
  const displayTime = useMemo(() => {
    if (timer.mode === "stopwatch") return timer.elapsed;
    if (timer.mode === "countdown")
      return Math.max(0, timer.countdownTotal - timer.elapsed);
    return Math.max(0, currentPhaseTotal - timer.elapsed);
  }, [timer.mode, timer.elapsed, timer.countdownTotal, currentPhaseTotal]);

  const progress = useMemo(() => {
    if (timer.mode === "stopwatch") return Math.min(timer.elapsed / 3600, 1);
    if (timer.mode === "countdown" && timer.countdownTotal > 0)
      return timer.elapsed / timer.countdownTotal;
    if (timer.mode === "pomodoro" && currentPhaseTotal > 0) {
      const raw = timer.elapsed / currentPhaseTotal;
      // During breaks, liquid should decrease (drain) instead of rise
      if (pomodoroState.phase !== "work") return Math.max(0, 1 - raw);
      return raw;
    }
    return 0;
  }, [timer.mode, timer.elapsed, timer.countdownTotal, currentPhaseTotal, pomodoroState.phase]);

  /* ── Handlers ──────────────────────────────────────── */
  const handleStart = useCallback(() => {
    if (!timer.selectedSubjectId) return;
    if (timer.mode === "pomodoro") {
      setCountdownTotal(pomodoroConfig.workDuration);
    }
    startTimer();
  }, [timer.selectedSubjectId, timer.mode, pomodoroConfig.workDuration, startTimer, setCountdownTotal]);

  const handleFinish = useCallback(() => {
    if (timer.mode === "pomodoro" && pomodoroState.phase !== "work") {
      pomodoroNextPhase();
      return;
    }
    if (timer.elapsed > 0 && timer.selectedSubjectId) {
      persistElapsedProgress(timer.elapsed, { force: true });
      setFinishedDuration(timer.elapsed);
      setShowMemo(true);
      pauseTimer();
    }
  }, [timer.elapsed, timer.selectedSubjectId, timer.mode, pomodoroState.phase, pauseTimer, pomodoroNextPhase, persistElapsedProgress]);

  const handlePause = useCallback(() => {
    persistElapsedProgress(timer.elapsed, { force: true });
    pauseTimer();
  }, [pauseTimer, persistElapsedProgress, timer.elapsed]);

  const handleSaveMemo = useCallback(
    (memo: string, focusRating?: number) => {
      if (timer.selectedSubjectId && finishedDuration > 0 && selectedSubject && userProfile.uid) {
        const todoTag = selectedTodo ? `TODO: ${selectedTodo.title}` : "";
        const finalMemo = [todoTag, memo].filter(Boolean).join("\n");

        persistElapsedProgress(finishedDuration, {
          memo: finalMemo,
          focusRating,
          force: true,
          finalize: true,
        });

        void upsertSubjectCatalog(selectedSubject.name).catch(() => {});
        if (selectedTodo && completeTodoOnSave) {
          void markTodoDone(selectedTodo.id, true).catch(() => {});
          setSelectedTodoId("");
        }
        if (autoTimelinePost) {
          void createAutoStudyTimelinePost({
            uid: userProfile.uid,
            name: userProfile.name,
            avatar: userProfile.avatar,
            subjectName: selectedSubject.name,
            durationSeconds: finishedDuration,
          }).catch(() => {});
        }
      }
      setShowMemo(false);
      if (timer.mode === "pomodoro") {
        pomodoroNextPhase();
      } else {
        resetTimer();
      }
    },
    [
      timer.selectedSubjectId,
      timer.mode,
      finishedDuration,
      selectedSubject,
      userProfile.uid,
      userProfile.name,
      userProfile.avatar,
      resetTimer,
      pomodoroNextPhase,
      selectedTodo,
      completeTodoOnSave,
      autoTimelinePost,
      persistElapsedProgress,
    ]
  );

  const handleSkipMemo = useCallback(() => {
    if (timer.selectedSubjectId && finishedDuration > 0 && selectedSubject && userProfile.uid) {
      const todoTag = selectedTodo ? `TODO: ${selectedTodo.title}` : "";

      persistElapsedProgress(finishedDuration, {
        memo: todoTag,
        force: true,
        finalize: true,
      });

      void upsertSubjectCatalog(selectedSubject.name).catch(() => {});
      if (selectedTodo && completeTodoOnSave) {
        void markTodoDone(selectedTodo.id, true).catch(() => {});
        setSelectedTodoId("");
      }
      if (autoTimelinePost) {
        void createAutoStudyTimelinePost({
          uid: userProfile.uid,
          name: userProfile.name,
          avatar: userProfile.avatar,
          subjectName: selectedSubject.name,
          durationSeconds: finishedDuration,
        }).catch(() => {});
      }
    }
    setShowMemo(false);
    if (timer.mode === "pomodoro") {
      pomodoroNextPhase();
    } else {
      resetTimer();
    }
  }, [
    timer.selectedSubjectId,
    timer.mode,
    finishedDuration,
    selectedSubject,
    userProfile.uid,
    userProfile.name,
    userProfile.avatar,
    resetTimer,
    pomodoroNextPhase,
    selectedTodo,
    completeTodoOnSave,
    autoTimelinePost,
    persistElapsedProgress,
  ]);

  const handleFullReset = useCallback(() => {
    if (timer.elapsed > 0) {
      persistElapsedProgress(timer.elapsed, { force: true, finalize: true });
    }
    resetTimer();
    if (timer.mode === "pomodoro") pomodoroReset();
    setImmersiveMode(false);
  }, [persistElapsedProgress, pomodoroReset, resetTimer, setImmersiveMode, timer.elapsed, timer.mode]);

  /* ── Keyboard shortcuts ────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || showMemo || document.querySelector("dialog[open]")) return;
      if (e.target instanceof HTMLElement && e.target.closest("button, a, select, summary, [contenteditable=true]")) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.status === "idle" && timer.selectedSubjectId) handleStart();
        else if (timer.status === "running") handlePause();
        else if (timer.status === "paused" && !showMemo) resumeTimer();
      }
      if (e.code === "Escape") {
        if (immersiveMode) {
          setImmersiveMode(false);
        } else if (timer.status !== "idle") {
          handleFullReset();
        }
      }
      if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey) {
        if (timer.status !== "idle") {
          setImmersiveMode(!immersiveMode);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [timer.status, timer.selectedSubjectId, showMemo, immersiveMode, handleStart, handlePause, resumeTimer, handleFullReset, setImmersiveMode]);

  /* ── Derived ───────────────────────────────────────── */
  const countdownPresets = [
    { label: "15分", value: 900 },
    { label: "25分", value: 1500 },
    { label: "45分", value: 2700 },
    { label: "60分", value: 3600 },
    { label: "90分", value: 5400 },
  ];

  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";
  const isIdle = timer.status === "idle";
  const accentColor = selectedSubject?.color || "var(--accent)";
  const isBreak = pomodoroState.phase !== "work";

  const liquidColor =
    timer.mode === "pomodoro" && isBreak
      ? pomodoroState.phase === "longBreak"
        ? "#6366f1"
        : "#10b981"
      : selectedSubject?.color || "#6366f1";

  const pomodoroPhaseLabel: Record<string, string> = {
    work: "集中タイム",
    shortBreak: "小休憩",
    longBreak: "長休憩",
  };

  /* ══════════════════════════════════════════════════════
   * ─── IMMERSIVE FULLSCREEN MODE ──────────────────────
   * ══════════════════════════════════════════════════════ */
  if (immersiveMode && !isIdle) {
    return (
      <>
        {/* Fullscreen wave background */}
        <FullscreenWave
          progress={progress}
          color={liquidColor}
          active={true}
        />

        {/* Dark overlay for readability */}
        <div
          className="fixed inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at center 40%, transparent 0%, rgba(0,0,0,0.35) 100%)",
          }}
        />

        {/* Immersive content */}
        <motion.div
          className="fixed inset-0 z-[2] flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Top bar – minimize/sound */}
          <div className="absolute top-6 right-6 flex items-center gap-3">
            <motion.button
              onClick={toggleSound}
                  aria-label="サウンドを切り替える"
              className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: soundEnabled ? "#fff" : "rgba(255,255,255,0.4)",
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </motion.button>
            <motion.button
              onClick={() => setImmersiveMode(false)}
                  aria-label="集中モードを終了"
              className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Minimize2 size={18} />
            </motion.button>
          </div>

          {/* Pomodoro phase */}
          {timer.mode === "pomodoro" && (
            <motion.div
              className="mb-6 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                {isBreak ? (
                  <Coffee size={24} style={{ color: liquidColor }} />
                ) : (
                  <Zap size={24} style={{ color: liquidColor }} />
                )}
                <span
                  className="text-2xl font-black"
                  style={{ color: liquidColor }}
                >
                  {pomodoroPhaseLabel[pomodoroState.phase]}
                </span>
              </div>
              <div className="flex items-center justify-center gap-3">
                {Array.from(
                  { length: pomodoroConfig.sessionsBeforeLongBreak },
                  (_, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full transition-all"
                      style={{
                        background:
                          i < pomodoroState.completedSessions
                            ? liquidColor
                            : i === pomodoroState.completedSessions &&
                              pomodoroState.phase === "work"
                            ? `${liquidColor}60`
                            : "rgba(255,255,255,0.15)",
                        border:
                          i === pomodoroState.currentSession - 1
                            ? `2px solid ${liquidColor}`
                            : "2px solid transparent",
                      }}
                    />
                  )
                )}
              </div>
            </motion.div>
          )}

          {/* Timer display (immersive) */}
          <div className="flex flex-col items-center justify-center">
            {timer.mode === "pomodoro" && (
              <span
                className="text-sm font-bold uppercase tracking-widest mb-1"
                style={{ color: `${liquidColor}90` }}
              >
                {pomodoroPhaseLabel[pomodoroState.phase]}
              </span>
            )}
            <span
              className="text-7xl sm:text-8xl font-mono font-black tabular-nums leading-none"
              style={{ color: isRunning ? liquidColor : "#fff" }}
            >
              {formatTime(displayTime)}
            </span>
            {selectedSubject && (
              <span
                className="text-lg font-bold mt-3"
                style={{ color: `${accentColor}DD` }}
              >
                {selectedSubject.name}
              </span>
            )}
            {/* Focus Bonus indicator (immersive) */}
            <div
              className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: focusBonusActive
                  ? `${liquidColor}25`
                  : "rgba(255,255,255,0.08)",
                color: focusBonusActive ? liquidColor : "rgba(255,255,255,0.4)",
              }}
            >
              {focusBonusActive ? (
                <>
                  <Flame size={13} />
                  <span>集中ボーナス ×1.2</span>
                </>
              ) : (
                <span>集中ボーナス 失効</span>
              )}
            </div>
          </div>

          {/* Focus Room (immersive) */}
          {selectedSubject && (
            <div className="mt-2">
              <FocusRoom
                subjectName={selectedSubject.name}
                subjectColor={selectedSubject.color}
              />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 mt-10">
            {isRunning && (
              <>
                <motion.button
                  onClick={handlePause}
                  aria-label="一時停止"
                  className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Pause size={26} />
                </motion.button>
                <motion.button
                  onClick={handleFinish}
                  aria-label="終了して記録"
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl"
                  style={{
                    background:
                      timer.mode === "pomodoro" && isBreak
                        ? liquidColor
                        : "#ef4444",
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {timer.mode === "pomodoro" && isBreak ? (
                    <SkipForward size={28} />
                  ) : (
                    <Square size={28} />
                  )}
                </motion.button>
              </>
            )}
            {isPaused && !showMemo && (
              <>
                <motion.button
                  onClick={() => resumeTimer()}
                  aria-label="学習を再開"
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl"
                  style={{ background: liquidColor }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play size={32} className="ml-1" />
                </motion.button>
                <motion.button
                  onClick={handleFinish}
                  aria-label="終了して記録"
                  className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#ef4444" }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Square size={22} />
                </motion.button>
                <motion.button
                  onClick={handleFullReset}
                  aria-label="タイマーをリセット"
                  className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw size={18} />
                </motion.button>
              </>
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-6 text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
              <span>{formatHoursMinutes(todayTotal)} 今日</span>
              <span>•</span>
              <span>{todaySessions} セッション</span>
              <span>•</span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.08)" }}>F</kbd>{" "}
                で縮小
              </span>
            </div>
          </div>
        </motion.div>

        {/* Memo dialog stays on top */}
        <MemoDialog
          open={showMemo}
          onClose={handleSkipMemo}
          onSave={handleSaveMemo}
          duration={finishedDuration}
          subjectName={selectedSubject?.name || ""}
          subjectColor={selectedSubject?.color || "var(--accent)"}
        />
      </>
    );
  }

  /* ══════════════════════════════════════════════════════
   * ─── NORMAL MODE (idle / running / paused) ──────────
   * ══════════════════════════════════════════════════════ */
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {isIdle && <section className="w-full max-w-2xl mb-6" aria-label="学習する教科">
          <SubjectSelector
            selectedId={timer.selectedSubjectId}
            onSelect={(id) => setTimerSubject(id)}
          />
      </section>}
      {/* ─── Mode selector (idle only) ───────────────── */}
      {isIdle && (
        <motion.div
          className="timer-mode-tabs"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
        {(
          [
            { mode: "stopwatch" as const, label: "ストップウォッチ", icon: Clock },
            { mode: "countdown" as const, label: "カウントダウン", icon: TimerIcon },
            { mode: "pomodoro" as const, label: "ポモドーロ", icon: Zap },
          ] as const
        ).map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => {
              setTimerMode(mode);
              if (mode === "pomodoro") {
                setCountdownTotal(pomodoroConfig.workDuration);
                pomodoroReset();
              }
            }}
            aria-pressed={timer.mode === mode}
            className="timer-mode-tab"
            style={{
              background: timer.mode === mode ? `${accentColor}20` : "var(--muted-bg)",
              color: timer.mode === mode ? accentColor : "var(--muted)",
              border: timer.mode === mode ? `2px solid ${accentColor}40` : "2px solid transparent",
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </motion.div>
      )}

      {/* ─── Countdown presets (idle only) ───────────── */}
      {isIdle && timer.mode === "countdown" && (
        <motion.div
          className="flex flex-wrap items-center justify-center gap-2 mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {countdownPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setCountdownTotal(preset.value)}
              className="min-h-11 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: timer.countdownTotal === preset.value ? `${accentColor}20` : "var(--muted-bg)",
                color: timer.countdownTotal === preset.value ? accentColor : "var(--muted)",
                border: timer.countdownTotal === preset.value ? `2px solid ${accentColor}40` : "2px solid transparent",
              }}
            >
              {preset.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* ─── Pomodoro settings (idle only) ────────────── */}
      {isIdle && timer.mode === "pomodoro" && (
        <motion.div className="mb-8 w-full max-w-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button
            onClick={() => setShowPomSettings(!showPomSettings)}
            className="min-h-11 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
          >
            <Settings size={14} />
            ポモドーロ設定
          </button>
          <AnimatePresence>
            {showPomSettings && (
              <motion.div
                className="mt-4 p-4 rounded-xl space-y-4"
                style={{ background: "var(--muted-bg)" }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {[
                  { label: "集中時間", key: "workDuration" as const, value: pomodoroConfig.workDuration, min: 300, max: 7200, step: 300 },
                  { label: "小休憩", key: "shortBreakDuration" as const, value: pomodoroConfig.shortBreakDuration, min: 60, max: 1800, step: 60 },
                  { label: "長休憩", key: "longBreakDuration" as const, value: pomodoroConfig.longBreakDuration, min: 300, max: 3600, step: 300 },
                ].map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{item.label}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: accentColor }}>{Math.floor(item.value / 60)}分</span>
                    </div>
                    <input aria-label={item.label} type="range" min={item.min} max={item.max} step={item.step} value={item.value}
                      onChange={(e) => setPomodoroConfig({ [item.key]: Number(e.target.value) })} className="w-full h-2 rounded-full" style={{ accentColor }} />
                  </div>
                ))}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>セッション数</span>
                    <span className="text-sm font-bold font-mono" style={{ color: accentColor }}>{pomodoroConfig.sessionsBeforeLongBreak}回</span>
                  </div>
                  <input aria-label="セッション数" type="range" min={2} max={8} step={1} value={pomodoroConfig.sessionsBeforeLongBreak}
                    onChange={(e) => setPomodoroConfig({ sessionsBeforeLongBreak: Number(e.target.value) })} className="w-full h-2 rounded-full" style={{ accentColor }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>休憩自動開始</span>
                  <button aria-label="休憩の自動開始" aria-pressed={pomodoroConfig.autoStartBreaks}
                  onClick={() => setPomodoroConfig({ autoStartBreaks: !pomodoroConfig.autoStartBreaks })}
                    className="w-12 h-11 rounded-full transition-all relative"
                    style={{ background: pomodoroConfig.autoStartBreaks ? accentColor : "var(--card-border)" }}>
                    <div className="w-5 h-5 bg-white rounded-full absolute top-3 transition-all shadow"
                      style={{ left: pomodoroConfig.autoStartBreaks ? "calc(100% - 24px)" : "4px" }} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>作業自動開始</span>
                  <button aria-label="作業の自動開始" aria-pressed={pomodoroConfig.autoStartWork}
                  onClick={() => setPomodoroConfig({ autoStartWork: !pomodoroConfig.autoStartWork })}
                    className="w-12 h-11 rounded-full transition-all relative"
                    style={{ background: pomodoroConfig.autoStartWork ? accentColor : "var(--card-border)" }}>
                    <div className="w-5 h-5 bg-white rounded-full absolute top-3 transition-all shadow"
                      style={{ left: pomodoroConfig.autoStartWork ? "calc(100% - 24px)" : "4px" }} />
                  </button>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
                    ポモドーロプリセット
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                    現在の設定を保存して、ワンタップで再利用できます。
                  </p>
                  <div className="mt-2 grid sm:grid-cols-[1fr_auto] gap-2">
                    <input
                      aria-label="ポモドーロプリセット名"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="例: 受験集中25-5"
                      className="px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => {
                        if (!presetName.trim() || !userProfile.uid) return;
                        void savePomodoroPreset(userProfile.uid, presetName, pomodoroConfig).catch(() => {});
                        setPresetName("");
                      }}
                      className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
                    >
                      現在設定を保存
                    </button>
                  </div>

                  {presets.length === 0 ? (
                    <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                      まだプリセットはありません
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
                      {presets.map((preset) => (
                        <div key={preset.id} className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "var(--card-bg)" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: "var(--foreground)" }}>
                              {preset.name}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                              {Math.round(preset.config.workDuration / 60)}分 / {Math.round(preset.config.shortBreakDuration / 60)}分 / {Math.round(preset.config.longBreakDuration / 60)}分
                            </p>
                          </div>
                          <button
                            onClick={() => setPomodoroConfig(preset.config)}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                          >
                            適用
                          </button>
                          <button
                            onClick={() => void deletePomodoroPreset(preset.id)}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "#ef444420", color: "#ef4444" }}
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ─── Pomodoro phase header (running) ────────── */}
      {!isIdle && timer.mode === "pomodoro" && (
        <motion.div
          className="mb-4 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            {isBreak ? (
              <Coffee size={24} style={{ color: liquidColor }} />
            ) : (
              <Zap size={24} style={{ color: liquidColor }} />
            )}
            <span
              className="text-xl font-black"
              style={{ color: liquidColor }}
            >
              {pomodoroPhaseLabel[pomodoroState.phase]}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            {Array.from(
              { length: pomodoroConfig.sessionsBeforeLongBreak },
              (_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 rounded-full transition-all"
                  style={{
                    background:
                      i < pomodoroState.completedSessions
                        ? liquidColor
                        : i === pomodoroState.completedSessions &&
                          pomodoroState.phase === "work"
                        ? `${liquidColor}60`
                        : "var(--muted-bg)",
                    border:
                      i === pomodoroState.currentSession - 1
                        ? `2px solid ${liquidColor}`
                        : "2px solid transparent",
                  }}
                />
              )
            )}
          </div>
        </motion.div>
      )}

      {/* ─── GIANT TIMER DISPLAY ─────────────────────── */}
      <motion.div
        className="flex flex-col items-center justify-center py-6 sm:py-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <span
          className="font-mono font-black tabular-nums leading-none"
          style={{
            fontSize: "clamp(4rem, 14vw, 10rem)",
            color: !isIdle && isRunning ? liquidColor : "var(--foreground)",
            textShadow: !isIdle && isRunning
              ? `0 0 60px ${liquidColor}30`
              : "none",
            letterSpacing: "-0.02em",
          }}
        >
          {formatTime(displayTime)}
        </span>
        {selectedSubject && (
          <span
            className="text-lg font-semibold mt-3"
            style={{ color: `${accentColor}CC` }}
          >
            {selectedSubject.name}
          </span>
        )}
        {!selectedSubject && (
          <span className="text-sm mt-3" style={{ color: "var(--muted)" }}>
            {timer.mode === "stopwatch"
              ? "教科を選択して開始"
              : timer.mode === "pomodoro"
              ? "ポモドーロモード"
              : "カウントダウンモード"}
          </span>
        )}

        {/* Focus Bonus indicator */}
        {!isIdle && (
          <motion.div
            className="flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-bold"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: focusBonusActive
                ? `${liquidColor}20`
                : "var(--muted-bg)",
              color: focusBonusActive ? liquidColor : "var(--muted)",
              border: `1px solid ${focusBonusActive ? `${liquidColor}40` : "transparent"}`,
            }}
          >
            {focusBonusActive ? (
              <>
                <Flame size={13} />
                <span>集中ボーナス ×1.2 有効</span>
              </>
            ) : (
              <>
                <span className="opacity-60">集中ボーナス 失効</span>
              </>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* ─── Focus Room (running/paused) ─────────────── */}
      {!isIdle && selectedSubject && (
        <FocusRoom
          subjectName={selectedSubject.name}
          subjectColor={selectedSubject.color}
        />
      )}

      {/* ─── Controls ────────────────────────────────── */}
      {isIdle ? (
        /* Start button & sound toggle (idle) */
        <div className="flex items-center justify-center gap-4 mb-8">
          <motion.button
            onClick={toggleSound}
                  aria-label="サウンドを切り替える"
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: "var(--muted-bg)",
              color: soundEnabled ? "var(--foreground)" : "var(--muted)",
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title={soundEnabled ? "サウンド ON" : "サウンド OFF"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </motion.button>
          <motion.button
            onClick={handleStart}
                  aria-label="学習を開始"
            disabled={!timer.selectedSubjectId}
            className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: timer.selectedSubjectId ? liquidColor : "var(--muted)",
              boxShadow: timer.selectedSubjectId
                ? `0 8px 40px ${liquidColor}40`
                : "none",
            }}
            whileHover={timer.selectedSubjectId ? { scale: 1.1 } : {}}
            whileTap={timer.selectedSubjectId ? { scale: 0.95 } : {}}
          >
            <Play size={36} className="ml-1" />
          </motion.button>
          <div className="w-11" />
        </div>
      ) : (
        /* Running / Paused controls */
        <div className="flex flex-col items-center gap-5 mb-8">
          <div className="flex items-center justify-center gap-5">
            {isRunning && (
              <>
                <motion.button
                  onClick={handlePause}
                  aria-label="一時停止"
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Pause size={24} />
                </motion.button>
                <motion.button
                  onClick={handleFinish}
                  aria-label="終了して記録"
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl"
                  style={{
                    background:
                      timer.mode === "pomodoro" && isBreak
                        ? liquidColor
                        : "#ef4444",
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {timer.mode === "pomodoro" && isBreak ? (
                    <SkipForward size={28} />
                  ) : (
                    <Square size={28} />
                  )}
                </motion.button>
              </>
            )}
            {isPaused && !showMemo && (
              <>
                <motion.button
                  onClick={() => resumeTimer()}
                  aria-label="学習を再開"
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl"
                  style={{ background: liquidColor }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play size={32} className="ml-1" />
                </motion.button>
                <motion.button
                  onClick={handleFinish}
                  aria-label="終了して記録"
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--muted-bg)",
                    color: "#ef4444",
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Square size={22} />
                </motion.button>
                <motion.button
                  onClick={handleFullReset}
                  aria-label="タイマーをリセット"
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--muted-bg)",
                    color: "var(--muted)",
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw size={18} />
                </motion.button>
              </>
            )}
          </div>
          {/* Utility buttons */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={toggleSound}
                  aria-label="サウンドを切り替える"
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: "var(--muted-bg)",
                color: soundEnabled ? "var(--foreground)" : "var(--muted)",
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </motion.button>
            <motion.button
              onClick={() => setImmersiveMode(true)}
                  aria-label="集中モードを開く"
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="没入モード (F)"
            >
              <Maximize2 size={16} />
            </motion.button>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <p
        className="hidden md:block text-center text-xs mb-8"
        style={{ color: "var(--muted)" }}
      >
        <kbd
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: "var(--muted-bg)" }}
        >
          Space
        </kbd>{" "}
        {isIdle ? "で開始" : "で一時停止"} ・{" "}
        <kbd
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: "var(--muted-bg)" }}
        >
          F
        </kbd>{" "}
        で没入モード ・{" "}
        <kbd
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: "var(--muted-bg)" }}
        >
          Esc
        </kbd>{" "}
        でリセット
      </p>

      {/* ─── Subject selector (idle only) ────────────── */}
      {isIdle && (
        <div className="w-full max-w-2xl">


          <details className="rounded-xl p-4 text-left" style={{ background: "var(--muted-bg)" }}>
            <summary className="min-h-11 font-semibold">ToDo・自動投稿の設定</summary>
            <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={15} style={{ color: "var(--accent)" }} />
              <h4 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                ToDoリスト連携
              </h4>
            </div>

            <select
              aria-label="学習に紐づけるToDo"
              value={selectedTodoId}
              onChange={(e) => setSelectedTodoId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
            >
              <option value="">このセッションに紐づけるToDo（任意）</option>
              {activeTodos.map((todo) => (
                <option key={todo.id} value={todo.id}>
                  {todo.title}{todo.targetPages ? ` (${todo.targetPages}ページ)` : ""}
                </option>
              ))}
            </select>

            <label className="text-xs mt-2 inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={completeTodoOnSave}
                onChange={(e) => setCompleteTodoOnSave(e.target.checked)}
              />
              セッション終了時にToDoを完了にする
            </label>

            <label className="text-xs mt-2 inline-flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={autoTimelinePost}
                onChange={(e) => setAutoTimelinePost(e.target.checked)}
              />
              学習終了時にタイムラインへ自動投稿する
            </label>

            <div className="mt-3 grid sm:grid-cols-[1fr_120px_auto] gap-2">
              <input
                aria-label="新しいToDoの名前"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="例: 数学ワーク"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
              <input
                type="number"
                min={0}
                aria-label="ToDoのページ数"
                value={newTodoPages}
                onChange={(e) => setNewTodoPages(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="ページ数"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
              />
              <button
                onClick={() => {
                  if (!newTodoTitle.trim() || !userProfile.uid) return;
                  void createUserTodo({
                    ownerUid: userProfile.uid,
                    title: newTodoTitle,
                    subjectId: timer.selectedSubjectId || undefined,
                    targetPages: newTodoPages ? Number(newTodoPages) : undefined,
                  }).catch(() => {});
                  setNewTodoTitle("");
                  setNewTodoPages("");
                }}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
              >
                追加
              </button>
            </div>
            </div>
          </details>
        </div>
      )}

      {/* ─── Today's progress strip ──────────────────── */}
      <motion.div
        className="glass-card p-5 w-full max-w-2xl mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3
          className="text-base font-bold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          今日の進捗
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Target size={16} style={{ color: "#6366f1" }} />
            </div>
            <div
              className="text-xl sm:text-2xl font-black font-mono"
              style={{ color: "var(--foreground)" }}
            >
              {formatHoursMinutes(todayTotal)}
            </div>
            <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              学習時間
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Flame size={16} style={{ color: "#f59e0b" }} />
            </div>
            <div
              className="text-xl sm:text-2xl font-black font-mono"
              style={{ color: "var(--foreground)" }}
            >
              {todaySessions}
            </div>
            <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              セッション
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Trophy size={16} style={{ color: "#ec4899" }} />
            </div>
            <div
              className="text-xl sm:text-2xl font-black font-mono"
              style={{ color: "var(--foreground)" }}
            >
              {Math.round(dailyGoalProgress * 100)}%
            </div>
            <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              目標達成率
            </div>
          </div>
        </div>
        <div
          className="h-3 rounded-full overflow-hidden"
          style={{ background: "var(--muted-bg)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                dailyGoalProgress >= 1
                  ? "linear-gradient(90deg, #10b981, #6366f1)"
                  : "linear-gradient(90deg, #6366f1, #818cf8)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(dailyGoalProgress * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div
          className="flex justify-between mt-2 text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          <span>0h</span>
          <span>
            目標: {formatHoursMinutes(userProfile.dailyGoal)}
          </span>
        </div>
      </motion.div>

      {/* ─── Memo dialog ─────────────────────────────── */}
      <MemoDialog
        open={showMemo}
        onClose={handleSkipMemo}
        onSave={handleSaveMemo}
        duration={finishedDuration}
        subjectName={selectedSubject?.name || ""}
        subjectColor={selectedSubject?.color || "var(--accent)"}
      />
    </div>
  );
}

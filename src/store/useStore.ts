"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  Subject,
  StudyLog,
  UserProfile,
  TimerState,
  PomodoroConfig,
  PomodoroState,
  Friend,
  ChatMessage,
  ChatMessageType,
} from "@/types";
import { DEFAULT_SUBJECTS } from "@/lib/utils";

/** Generate an 8-digit numeric UID */
function generateNumericUid(): string {
  const min = 10000000;
  const max = 99999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

interface AppState {
  // Subjects
  subjects: Subject[];
  addSubject: (name: string, color: string, icon: string) => void;
  updateSubject: (id: string, name: string, color: string, icon: string) => void;
  deleteSubject: (id: string) => void;

  // Study Logs
  studyLogs: StudyLog[];
  addStudyLog: (
    subjectId: string,
    duration: number,
    memo: string,
    focusRating?: number,
    focusBonus?: boolean
  ) => void;
  deleteStudyLog: (id: string) => void;

  // User Profile
  userProfile: UserProfile;
  updateDailyGoal: (goal: number) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;

  // Friends
  friends: Friend[];
  addFriend: (friend: Omit<Friend, "addedAt">) => void;
  removeFriend: (uid: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  sendChatMessage: (toUid: string, type: ChatMessageType, content: string, fileName?: string) => void;
  deleteChatMessage: (id: string) => void;

  // Timer
  timer: TimerState;
  setTimerSubject: (subjectId: string | null) => void;
  setTimerMode: (mode: "stopwatch" | "countdown" | "pomodoro") => void;
  setCountdownTotal: (seconds: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;

  // Pomodoro
  pomodoroConfig: PomodoroConfig;
  pomodoroState: PomodoroState;
  setPomodoroConfig: (config: Partial<PomodoroConfig>) => void;
  pomodoroNextPhase: () => void;
  pomodoroReset: () => void;

  // Sound
  soundEnabled: boolean;
  toggleSound: () => void;

  // Theme
  theme: "white" | "gray" | "dark" | "custom";
  customBgColor: string;
  setTheme: (theme: "white" | "gray" | "dark" | "custom") => void;
  setCustomBgColor: (color: string) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Immersive mode
  immersiveMode: boolean;
  setImmersiveMode: (on: boolean) => void;

  // Initialize defaults
  initializeDefaults: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Subjects
      subjects: [],
      addSubject: (name, color, icon) =>
        set((state) => ({
          subjects: [...state.subjects, { id: uuidv4(), name, color, icon }],
        })),
      updateSubject: (id, name, color, icon) =>
        set((state) => ({
          subjects: state.subjects.map((s) =>
            s.id === id ? { ...s, name, color, icon } : s
          ),
        })),
      deleteSubject: (id) =>
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== id),
          studyLogs: state.studyLogs.filter((l) => l.subjectId !== id),
        })),

      // Study Logs
      studyLogs: [],
      addStudyLog: (subjectId, duration, memo, focusRating, focusBonus) =>
        set((state) => {
          const basePoints = Math.floor(duration / 60);
          const earnedPoints = focusBonus
            ? Math.floor(basePoints * 1.2)
            : basePoints;
          return {
            studyLogs: [
              ...state.studyLogs,
              {
                id: uuidv4(),
                subjectId,
                duration,
                memo,
                focusRating: focusRating || undefined,
                focusBonus: focusBonus || false,
                points: earnedPoints,
                createdAt: new Date().toISOString(),
              },
            ],
            userProfile: {
              ...state.userProfile,
              totalPoints:
                state.userProfile.totalPoints + earnedPoints,
            },
          };
        }),
      deleteStudyLog: (id) =>
        set((state) => ({
          studyLogs: state.studyLogs.filter((l) => l.id !== id),
        })),

      // User Profile
      userProfile: { uid: generateNumericUid(), name: "", avatar: "🎓", dailyGoal: 7200, totalPoints: 0 },
      updateDailyGoal: (goal) =>
        set((state) => ({
          userProfile: { ...state.userProfile, dailyGoal: goal },
        })),
      updateUserProfile: (updates) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...updates },
        })),

      // Friends
      friends: [],
      addFriend: (friend) =>
        set((state) => {
          if (state.friends.some((f) => f.uid === friend.uid)) return state;
          return {
            friends: [
              ...state.friends,
              { ...friend, addedAt: new Date().toISOString() },
            ],
          };
        }),
      removeFriend: (uid) =>
        set((state) => ({
          friends: state.friends.filter((f) => f.uid !== uid),
        })),

      // Chat
      chatMessages: [],
      sendChatMessage: (toUid, type, content, fileName) =>
        set((state) => ({
          chatMessages: [
            ...state.chatMessages,
            {
              id: uuidv4(),
              fromUid: state.userProfile.uid,
              toUid,
              type,
              content,
              fileName,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      deleteChatMessage: (id) =>
        set((state) => ({
          chatMessages: state.chatMessages.filter((m) => m.id !== id),
        })),

      // Timer
      timer: {
        mode: "stopwatch",
        status: "idle",
        elapsed: 0,
        countdownTotal: 1500,
        selectedSubjectId: null,
      },
      setTimerSubject: (subjectId) =>
        set((state) => ({
          timer: { ...state.timer, selectedSubjectId: subjectId },
        })),
      setTimerMode: (mode) =>
        set((state) => ({ timer: { ...state.timer, mode } })),
      setCountdownTotal: (seconds) =>
        set((state) => ({
          timer: { ...state.timer, countdownTotal: seconds },
        })),
      startTimer: () =>
        set((state) => ({
          timer: { ...state.timer, status: "running", elapsed: 0 },
        })),
      pauseTimer: () =>
        set((state) => ({
          timer: { ...state.timer, status: "paused" },
        })),
      resumeTimer: () =>
        set((state) => ({
          timer: { ...state.timer, status: "running" },
        })),
      resetTimer: () =>
        set((state) => ({
          timer: { ...state.timer, status: "idle", elapsed: 0 },
        })),
      tickTimer: () =>
        set((state) => ({
          timer: { ...state.timer, elapsed: state.timer.elapsed + 1 },
        })),

      // Pomodoro
      pomodoroConfig: {
        workDuration: 1500,
        shortBreakDuration: 300,
        longBreakDuration: 900,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: true,
        autoStartWork: false,
      },
      pomodoroState: {
        phase: "work",
        currentSession: 1,
        completedSessions: 0,
      },
      setPomodoroConfig: (config) =>
        set((state) => ({
          pomodoroConfig: { ...state.pomodoroConfig, ...config },
        })),
      pomodoroNextPhase: () => {
        const state = get();
        const { pomodoroState: ps, pomodoroConfig: pc, timer } = state;

        if (ps.phase === "work") {
          const newCompleted = ps.completedSessions + 1;
          const isLongBreak = newCompleted >= pc.sessionsBeforeLongBreak;
          set({
            pomodoroState: {
              phase: isLongBreak ? "longBreak" : "shortBreak",
              currentSession: ps.currentSession,
              completedSessions: newCompleted,
            },
            timer: {
              ...timer,
              countdownTotal: isLongBreak
                ? pc.longBreakDuration
                : pc.shortBreakDuration,
              elapsed: 0,
              status: pc.autoStartBreaks ? "running" : "idle",
            },
          });
        } else if (ps.phase === "shortBreak") {
          set({
            pomodoroState: {
              phase: "work",
              currentSession: ps.currentSession + 1,
              completedSessions: ps.completedSessions,
            },
            timer: {
              ...timer,
              countdownTotal: pc.workDuration,
              elapsed: 0,
              status: pc.autoStartWork ? "running" : "idle",
            },
          });
        } else {
          // Long break ended → cycle complete
          set({
            pomodoroState: {
              phase: "work",
              currentSession: 1,
              completedSessions: 0,
            },
            timer: {
              ...timer,
              countdownTotal: pc.workDuration,
              elapsed: 0,
              status: "idle",
            },
          });
        }
      },
      pomodoroReset: () =>
        set((state) => ({
          pomodoroState: {
            phase: "work",
            currentSession: 1,
            completedSessions: 0,
          },
          timer: {
            ...state.timer,
            countdownTotal: state.pomodoroConfig.workDuration,
            elapsed: 0,
            status: "idle",
          },
        })),

      // Sound
      soundEnabled: true,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      // Theme
      theme: "dark",
      customBgColor: "#6366f1",
      setTheme: (theme) => set({ theme }),
      setCustomBgColor: (color) => set({ customBgColor: color }),

      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Immersive mode
      immersiveMode: false,
      setImmersiveMode: (on) => set({ immersiveMode: on }),

      // Initialize defaults
      initializeDefaults: () => {
        const state = get();
        if (state.subjects.length === 0) {
          const defaultSubjects = DEFAULT_SUBJECTS.map((s) => ({
            ...s,
            id: uuidv4(),
          }));
          set({ subjects: defaultSubjects });
        }
      },
    }),
    {
      name: "study-timer-storage",
      partialize: (state) => ({
        subjects: state.subjects,
        studyLogs: state.studyLogs,
        userProfile: state.userProfile,
        friends: state.friends,
        chatMessages: state.chatMessages,
        theme: state.theme,
        customBgColor: state.customBgColor,
        pomodoroConfig: state.pomodoroConfig,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);

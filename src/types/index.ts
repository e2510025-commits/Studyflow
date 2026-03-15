export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface StudyLog {
  id: string;
  subjectId: string;
  duration: number; // seconds
  memo: string;
  focusRating?: number; // 1-5 stars, 0 or undefined = not rated
  focusBonus?: boolean; // true = stayed in app, got 1.2x bonus
  points?: number; // points earned for this session
  createdAt: string; // ISO string
}

export interface UserProfile {
  uid: string; // numeric-only string e.g. "38492710"
  name: string;
  avatar: string; // emoji or data:image URL
  dailyGoal: number; // seconds
  totalPoints: number;
}

export type ProfileVisibility = "public" | "friends" | "private";

export interface PublicProfile {
  uid: string;
  name: string;
  avatar: string;
  bio: string;
  visibility: ProfileVisibility;
  dailyGoal: number;
  totalPoints: number;
  isOfficial?: boolean;
}

/* ─── Friends ──────────────────────────────────────── */
export interface Friend {
  uid: string;
  name: string;
  avatar: string;
  addedAt: string; // ISO string
}

/* ─── Chat ─────────────────────────────────────────── */
export type ChatMessageType = "text" | "image" | "video" | "task";

export interface ChatMessage {
  id: string;
  fromUid: string; // sender UID
  toUid: string;   // receiver UID
  type: ChatMessageType;
  content: string; // text body, or data-url / blob-url for media
  fileName?: string; // original file name for media
  createdAt: string; // ISO string
  readBy?: string[];
  readAt?: string;
}

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  toUid: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt?: string;
}

export type AppNotificationType =
  | "friend_request"
  | "announcement"
  | "warning"
  | "ban"
  | "suspend";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  toUid: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export type TimerMode = "stopwatch" | "countdown" | "pomodoro";
export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  elapsed: number; // seconds
  countdownTotal: number; // seconds (for countdown mode)
  selectedSubjectId: string | null;
}

export interface PomodoroConfig {
  workDuration: number; // seconds (default 1500 = 25min)
  shortBreakDuration: number; // seconds (default 300 = 5min)
  longBreakDuration: number; // seconds (default 900 = 15min)
  sessionsBeforeLongBreak: number; // default 4
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export type PomodoroPhase = "work" | "shortBreak" | "longBreak";

export interface PomodoroState {
  phase: PomodoroPhase;
  currentSession: number; // 1-based
  completedSessions: number;
}

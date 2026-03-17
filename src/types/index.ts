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
  bonusPoints?: number;
  profileSetupDone?: boolean;
  badges?: string[];
  achievementUnlockedAt?: Record<string, string>;
  equippedBadges?: string[];
  statusMessage?: string;
  headerImage?: string;
  deviceLabel?: string;
  showFollowCount?: boolean;
  showFollowerCount?: boolean;
  showFriendCount?: boolean;
  helpfulReceived?: number;
  isOfficial?: boolean;
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
  bonusPoints?: number;
  profileSetupDone?: boolean;
  isOfficial?: boolean;
  badges?: string[];
  achievementUnlockedAt?: Record<string, string>;
  equippedBadges?: string[];
  statusMessage?: string;
  headerImage?: string;
  deviceLabel?: string;
  showFollowCount?: boolean;
  showFollowerCount?: boolean;
  showFriendCount?: boolean;
  helpfulReceived?: number;
}

export type BulletinCategory = "qa" | "tips" | "chat" | "ops";

export interface CommunityStreamMessage {
  id: string;
  kind: "user" | "system";
  messageType?: "text" | "image";
  uid?: string;
  name: string;
  avatar: string;
  isOfficial?: boolean;
  body: string;
  imageUrl?: string;
  replyToId?: string;
  replyCount?: number;
  repostCount?: number;
  respectCount?: number;
  likeCount?: number;
  respectedByMe?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  createdAt: string;
}

export interface BulletinPost {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  isOfficial?: boolean;
  title: string;
  content: string;
  category: BulletinCategory;
  helpfulCount: number;
  replyCount: number;
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BulletinThreadMessage {
  id: string;
  postId: string;
  uid: string;
  name: string;
  avatar: string;
  isOfficial?: boolean;
  body: string;
  createdAt: string;
  editedAt?: string;
  isDeleted?: boolean;
}

export type MissionScope = "daily" | "weekly" | "season";
export type MissionGoalType = "study_seconds" | "study_sessions";
export type MissionRotationMode = "random" | "fixed";

export interface MissionTemplate {
  id: string;
  scope: MissionScope;
  title: string;
  description: string;
  goalType: MissionGoalType;
  goalValue: number;
  rewardPoints: number;
  active: boolean;
  triggerType?: "study_time" | "study_sessions" | "login_days";
  targetType?: "daily" | "weekly" | "season_total";
  actionType?: "at_least";
  subjectLabel?: string;
  rewardBadge?: string;
  rewardMultiplier?: number;
}

export interface MissionConfig {
  seasonName: string;
  seasonStartAt: string;
  seasonEndAt: string;
  rotationMode: Record<MissionScope, MissionRotationMode>;
  fixedMissionIds: Partial<Record<MissionScope, string>>;
}

export interface MissionStatus {
  scope: MissionScope;
  periodKey: string;
  periodLabel: string;
  mission: MissionTemplate | null;
  progressValue: number;
  progressRate: number;
  completed: boolean;
  claimed: boolean;
}

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type AchievementTriggerType =
  | "total_study_hours"
  | "streak_days"
  | "subject_study_hours"
  | "study_sessions"
  | "focus_sessions"
  | "special_date";

export interface AchievementCategory {
  id: string;
  label: string;
  order: number;
}

export interface AchievementTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  rarity: AchievementRarity;
  secret?: boolean;
  isNew?: boolean;
  active?: boolean;
  iconBase?: "hex";
  iconColor?: string;
  iconSymbol?: string;
  triggerType: AchievementTriggerType;
  triggerValue: number;
  subjectLabel?: string;
}

/* ─── Friends ──────────────────────────────────────── */
export interface Friend {
  uid: string;
  name: string;
  avatar: string;
  isOfficial?: boolean;
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
  storagePath?: string;
  createdAt: string; // ISO string
  readBy?: string[];
  readAt?: string;
  editedAt?: string;
  isDeleted?: boolean;
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
  | "suspend"
  | "support_reply";

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
  scheduledAt?: string;
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

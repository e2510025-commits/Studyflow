import { startOfDay, format } from "date-fns";
import type { StudyLog } from "@/types";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

export function getTodayLogs(logs: StudyLog[]): StudyLog[] {
  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
  return logs.filter(
    (log) => format(new Date(log.createdAt), "yyyy-MM-dd") === todayStr
  );
}

export function getTotalDuration(logs: StudyLog[]): number {
  return logs.reduce((sum, log) => sum + log.duration, 0);
}

export const DEFAULT_SUBJECTS = [
  { name: "数学", color: "#3B82F6", icon: "calculator" },
  { name: "英語", color: "#EF4444", icon: "languages" },
  { name: "国語", color: "#10B981", icon: "book-open" },
  { name: "理科", color: "#F59E0B", icon: "flask-conical" },
  { name: "社会", color: "#8B5CF6", icon: "globe" },
  { name: "プログラミング", color: "#EC4899", icon: "code" },
];

export const SUBJECT_ICONS = [
  "calculator",
  "languages",
  "book-open",
  "flask-conical",
  "globe",
  "code",
  "pen-tool",
  "music",
  "palette",
  "dumbbell",
  "brain",
  "lightbulb",
  "graduation-cap",
  "library",
  "notebook-pen",
  "atom",
];

export const SUBJECT_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
  "#14B8A6",
  "#E11D48",
];

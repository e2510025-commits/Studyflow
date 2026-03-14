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

export interface SubjectSuggestionItem {
  label: string;
  aliases: string[];
}

export const SUBJECT_SUGGESTION_MASTER: SubjectSuggestionItem[] = [
  { label: "英語", aliases: ["英", "英語", "english", "英会話", "英文法", "英単語"] },
  { label: "数学", aliases: ["数", "数学", "math", "算数", "代数", "幾何", "数1", "数2", "数a", "数b"] },
  { label: "国語", aliases: ["国", "国語", "現代文", "古文", "漢文", "語彙", "読解"] },
  { label: "理科", aliases: ["理", "理科", "science"] },
  { label: "社会", aliases: ["社", "社会", "公民", "地理", "歴史", "world history", "japanese history"] },
  { label: "物理", aliases: ["物", "物理", "physics"] },
  { label: "化学", aliases: ["化", "化学", "chemistry"] },
  { label: "生物", aliases: ["生", "生物", "biology"] },
  { label: "地学", aliases: ["地学", "earth science"] },
  { label: "世界史", aliases: ["世界史", "世史"] },
  { label: "日本史", aliases: ["日本史", "日史"] },
  { label: "地理", aliases: ["地理", "geo"] },
  { label: "公民", aliases: ["公民", "政経", "倫理", "現社"] },
  { label: "情報", aliases: ["情報", "情報1", "情報i", "programming basics"] },
  { label: "プログラミング", aliases: ["プログラミング", "programming", "code", "coding"] },
  { label: "小論文", aliases: ["小論文", "論文"] },
  { label: "面接対策", aliases: ["面接", "面接対策"] },
  { label: "資格勉強", aliases: ["資格", "検定", "toeic", "英検", "漢検", "数検"] },
  { label: "読書", aliases: ["読書", "book", "books"] },
  { label: "復習", aliases: ["復習", "review"] },
  { label: "予習", aliases: ["予習", "preview"] },
  { label: "宿題", aliases: ["宿題", "homework"] },
  { label: "自由研究", aliases: ["自由研究"] },
  { label: "美術", aliases: ["美術", "art"] },
  { label: "音楽", aliases: ["音楽", "music"] },
  { label: "保健体育", aliases: ["体育", "保体", "保健", "スポーツ"] },
  { label: "家庭科", aliases: ["家庭科", "家"] },
  { label: "技術", aliases: ["技術", "技"] },
  { label: "総合学習", aliases: ["総合", "総合学習"] },
];

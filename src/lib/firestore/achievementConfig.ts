import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AchievementCategory, AchievementTemplate } from "@/types";
import { DEFAULT_ACHIEVEMENT_CATEGORIES, DEFAULT_ACHIEVEMENTS } from "@/lib/achievements";

export interface AchievementCatalog {
  categories: AchievementCategory[];
  achievements: AchievementTemplate[];
}

function normalizeCategory(input: unknown, index: number): AchievementCategory {
  const row = input as Partial<AchievementCategory>;
  const id = String(row.id || `category_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .slice(0, 40);
  return {
    id: id || `category_${index + 1}`,
    label: String(row.label || `カテゴリ${index + 1}`).slice(0, 24),
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : index,
  };
}

function normalizeAchievement(input: unknown, index: number): AchievementTemplate | null {
  const row = input as Partial<AchievementTemplate>;
  const title = String(row.title || "").trim().slice(0, 60);
  if (!title) return null;

  const id = String(row.id || title)
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .slice(0, 48);

  const rarity =
    row.rarity === "legendary" || row.rarity === "epic" || row.rarity === "rare" ? row.rarity : "common";

  const triggerType =
    row.triggerType === "streak_days" ||
    row.triggerType === "subject_study_hours" ||
    row.triggerType === "study_sessions" ||
    row.triggerType === "focus_sessions" ||
    row.triggerType === "special_date"
      ? row.triggerType
      : "total_study_hours";

  return {
    id: id || `achievement_${index + 1}`,
    title,
    description: String(row.description || "").slice(0, 180),
    category: String(row.category || "total").slice(0, 24),
    rarity,
    secret: Boolean(row.secret),
    isNew: Boolean(row.isNew),
    active: row.active !== false,
    iconBase: "hex",
    iconColor: String(row.iconColor || "#22d3ee").slice(0, 16),
    iconSymbol: String(row.iconSymbol || "trophy").slice(0, 20),
    triggerType,
    triggerValue: Math.max(1, Math.floor(Number(row.triggerValue || 1))),
    subjectLabel: String(row.subjectLabel || "").slice(0, 40),
  };
}

export async function fetchAchievementCatalog(): Promise<AchievementCatalog> {
  const snap = await getDoc(doc(db, "achievementConfig", "main")).catch(() => null);
  if (!snap || !snap.exists()) {
    return {
      categories: DEFAULT_ACHIEVEMENT_CATEGORIES,
      achievements: DEFAULT_ACHIEVEMENTS,
    };
  }

  const data = snap.data() || {};
  const categories = Array.isArray(data.categories)
    ? data.categories.map((row, idx) => normalizeCategory(row, idx)).sort((a, b) => a.order - b.order)
    : DEFAULT_ACHIEVEMENT_CATEGORIES;
  const achievements = Array.isArray(data.achievements)
    ? data.achievements
        .map((row, idx) => normalizeAchievement(row, idx))
        .filter((row): row is AchievementTemplate => Boolean(row))
    : DEFAULT_ACHIEVEMENTS;

  return { categories, achievements };
}

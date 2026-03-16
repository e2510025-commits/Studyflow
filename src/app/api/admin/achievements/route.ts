import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";
import type { AchievementCategory, AchievementTemplate } from "@/types";
import { DEFAULT_ACHIEVEMENTS, DEFAULT_ACHIEVEMENT_CATEGORIES } from "@/lib/achievements";

interface AchievementConfigDoc {
  categories: AchievementCategory[];
  achievements: AchievementTemplate[];
}

function toSafeId(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeCategories(input: unknown): AchievementCategory[] {
  if (!Array.isArray(input)) return DEFAULT_ACHIEVEMENT_CATEGORIES;
  return input
    .map((row, idx) => {
      const r = row as Partial<AchievementCategory>;
      const label = String(r.label || "").trim().slice(0, 24);
      const id = toSafeId(String(r.id || label || `category_${idx + 1}`));
      return {
        id: id || `category_${idx + 1}`,
        label: label || `カテゴリ${idx + 1}`,
        order: Number.isFinite(Number(r.order)) ? Number(r.order) : idx,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((row, idx) => ({ ...row, order: idx }));
}

function normalizeAchievement(input: unknown, index: number): AchievementTemplate | null {
  const row = input as Partial<AchievementTemplate>;
  const title = String(row.title || "").trim().slice(0, 60);
  if (!title) return null;

  const id = toSafeId(String(row.id || title || `achievement_${index + 1}`));
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
    description: String(row.description || "").trim().slice(0, 180),
    category: String(row.category || "total").trim().slice(0, 24) || "total",
    rarity,
    secret: Boolean(row.secret),
    isNew: Boolean(row.isNew),
    active: row.active !== false,
    iconBase: "hex",
    iconColor: String(row.iconColor || "#22d3ee").slice(0, 16),
    iconSymbol: String(row.iconSymbol || "trophy").slice(0, 20),
    triggerType,
    triggerValue: Math.max(1, Math.floor(Number(row.triggerValue || 1))),
    subjectLabel: String(row.subjectLabel || "").trim().slice(0, 40),
  };
}

function normalizeAchievements(input: unknown): AchievementTemplate[] {
  if (!Array.isArray(input)) {
    return DEFAULT_ACHIEVEMENTS.map((row) => ({
      ...row,
      isNew: Boolean(row.isNew),
      active: row.active !== false,
      iconBase: "hex",
      iconColor: row.iconColor || "#22d3ee",
      iconSymbol: row.iconSymbol || "trophy",
      triggerType: row.triggerType || "total_study_hours",
      triggerValue: row.triggerValue || 1,
      subjectLabel: row.subjectLabel || "",
    }));
  }

  return input
    .map((row, idx) => normalizeAchievement(row, idx))
    .filter((row): row is AchievementTemplate => Boolean(row));
}

async function getConfigDoc(): Promise<AchievementConfigDoc> {
  const snap = await getDoc(doc(db, "achievementConfig", "main"));
  if (!snap.exists()) {
    return {
      categories: DEFAULT_ACHIEVEMENT_CATEGORIES,
      achievements: DEFAULT_ACHIEVEMENTS.map((row) => ({
        ...row,
        isNew: Boolean(row.isNew),
        active: row.active !== false,
        iconBase: "hex",
        iconColor: row.iconColor || "#22d3ee",
        iconSymbol: row.iconSymbol || "trophy",
        triggerType: row.triggerType || "total_study_hours",
        triggerValue: row.triggerValue || 1,
        subjectLabel: row.subjectLabel || "",
      })),
    };
  }

  const data = snap.data() || {};
  return {
    categories: normalizeCategories(data.categories),
    achievements: normalizeAchievements(data.achievements),
  };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const config = await getConfigDoc();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as
    | { action: "saveCategories"; categories?: AchievementCategory[] }
    | { action: "upsertAchievement"; achievement?: AchievementTemplate }
    | { action: "deleteAchievement"; achievementId?: string }
    | { action: "toggleNew"; achievementId?: string; isNew?: boolean };

  const current = await getConfigDoc();

  if (body.action === "saveCategories") {
    const categories = normalizeCategories(body.categories);
    await setDoc(
      doc(db, "achievementConfig", "main"),
      {
        categories,
        achievements: current.achievements,
        updatedBy: guard.appUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "upsertAchievement") {
    const normalized = normalizeAchievement(body.achievement, 0);
    if (!normalized) {
      return NextResponse.json({ error: "invalid achievement" }, { status: 400 });
    }

    const existingIndex = current.achievements.findIndex((row) => row.id === normalized.id);
    const next = [...current.achievements];
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...normalized };
    } else {
      next.push(normalized);
    }

    await setDoc(
      doc(db, "achievementConfig", "main"),
      {
        categories: current.categories,
        achievements: next,
        updatedBy: guard.appUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true, id: normalized.id });
  }

  if (body.action === "deleteAchievement") {
    if (!body.achievementId) {
      return NextResponse.json({ error: "achievementId required" }, { status: 400 });
    }

    const next = current.achievements.filter((row) => row.id !== body.achievementId);
    await setDoc(
      doc(db, "achievementConfig", "main"),
      {
        categories: current.categories,
        achievements: next,
        updatedBy: guard.appUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggleNew") {
    if (!body.achievementId) {
      return NextResponse.json({ error: "achievementId required" }, { status: 400 });
    }
    const next = current.achievements.map((row) =>
      row.id === body.achievementId ? { ...row, isNew: Boolean(body.isNew) } : row
    );
    await setDoc(
      doc(db, "achievementConfig", "main"),
      {
        categories: current.categories,
        achievements: next,
        updatedBy: guard.appUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

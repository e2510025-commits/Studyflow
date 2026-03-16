import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  MissionConfig,
  MissionScope,
  MissionTemplate,
  MissionRotationMode,
  MissionGoalType,
} from "@/types";

const MISSION_CONFIG_DOC = doc(db, "missionConfig", "main");
const MISSION_ROTATION_DOC = doc(db, "missionRotation", "main");

const SCOPES: MissionScope[] = ["daily", "weekly", "season"];

const DEFAULT_CONFIG: MissionConfig = {
  seasonName: "Season 1",
  seasonStartAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  seasonEndAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
  rotationMode: {
    daily: "random",
    weekly: "random",
    season: "random",
  },
  fixedMissionIds: {},
};

type PeriodInfo = {
  scope: MissionScope;
  key: string;
  label: string;
  startAt: Date;
  endAt?: Date;
};

function ensureMode(value: unknown): MissionRotationMode {
  return value === "fixed" ? "fixed" : "random";
}

function ensureGoalType(value: unknown): MissionGoalType {
  return value === "study_sessions" ? "study_sessions" : "study_seconds";
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(now: Date): Date {
  const current = new Date(now);
  const day = current.getDay();
  const diff = day === 0 ? 6 : day - 1;
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - diff);
  return current;
}

function getPeriodInfo(scope: MissionScope, config: MissionConfig): PeriodInfo {
  const now = new Date();

  if (scope === "daily") {
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 1);
    endAt.setMilliseconds(endAt.getMilliseconds() - 1);
    return {
      scope,
      key: dateKey(startAt),
      label: "デイリー",
      startAt,
      endAt,
    };
  }

  if (scope === "weekly") {
    const startAt = getWeekStart(now);
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 7);
    endAt.setMilliseconds(endAt.getMilliseconds() - 1);
    return {
      scope,
      key: `week-${dateKey(startAt)}`,
      label: "ウィークリー",
      startAt,
      endAt,
    };
  }

  const parsedStart = new Date(config.seasonStartAt || "");
  const parsedEnd = new Date(config.seasonEndAt || "");
  const startAt = Number.isNaN(parsedStart.getTime())
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : parsedStart;
  const defaultEnd = new Date(startAt);
  defaultEnd.setMonth(defaultEnd.getMonth() + 1);
  defaultEnd.setDate(defaultEnd.getDate() - 1);
  defaultEnd.setHours(23, 59, 59, 999);
  const endAt = Number.isNaN(parsedEnd.getTime()) ? defaultEnd : parsedEnd;
  const seasonLabel = `${config.seasonName || "シーズン"} (${dateKey(startAt)} - ${dateKey(endAt)})`;
  return {
    scope,
    key: `season-${config.seasonName}-${dateKey(startAt)}-${dateKey(endAt)}`,
    label: seasonLabel,
    startAt,
    endAt,
  };
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] || null;
}

function fallbackMission(scope: MissionScope): MissionTemplate {
  if (scope === "daily") {
    return {
      id: "fallback-daily",
      scope,
      title: "デイリー学習 30分",
      description: "毎日30分以上学習しよう",
      goalType: "study_seconds",
      goalValue: 1800,
      rewardPoints: 30,
      active: true,
      triggerType: "study_time",
      targetType: "daily",
      actionType: "at_least",
      rewardMultiplier: 1,
    };
  }

  if (scope === "weekly") {
    return {
      id: "fallback-weekly",
      scope,
      title: "ウィークリー 3セッション",
      description: "今週3回以上学習しよう",
      goalType: "study_sessions",
      goalValue: 3,
      rewardPoints: 80,
      active: true,
      triggerType: "study_sessions",
      targetType: "weekly",
      actionType: "at_least",
      rewardMultiplier: 1,
    };
  }

  return {
    id: "fallback-season",
    scope,
    title: "シーズン 10セッション",
    description: "シーズン期間中に10回学習しよう",
    goalType: "study_sessions",
    goalValue: 10,
    rewardPoints: 200,
    active: true,
    triggerType: "study_sessions",
    targetType: "season_total",
    actionType: "at_least",
    rewardMultiplier: 1,
  };
}

export function buildClaimDocId(uid: string, scope: MissionScope, periodKey: string): string {
  return `${uid}_${scope}_${periodKey}`;
}

export async function getMissionConfig(): Promise<MissionConfig> {
  const snap = await getDoc(MISSION_CONFIG_DOC);
  if (!snap.exists()) {
    return DEFAULT_CONFIG;
  }

  const data = snap.data();
  return {
    seasonName: typeof data.seasonName === "string" && data.seasonName.trim()
      ? data.seasonName.trim().slice(0, 60)
      : DEFAULT_CONFIG.seasonName,
    seasonStartAt:
      typeof data.seasonStartAt === "string" && data.seasonStartAt
        ? data.seasonStartAt
        : DEFAULT_CONFIG.seasonStartAt,
    seasonEndAt:
      typeof data.seasonEndAt === "string" && data.seasonEndAt
        ? data.seasonEndAt
        : DEFAULT_CONFIG.seasonEndAt,
    rotationMode: {
      daily: ensureMode(data.rotationMode?.daily),
      weekly: ensureMode(data.rotationMode?.weekly),
      season: ensureMode(data.rotationMode?.season),
    },
    fixedMissionIds: {
      daily: typeof data.fixedMissionIds?.daily === "string" ? data.fixedMissionIds.daily : undefined,
      weekly: typeof data.fixedMissionIds?.weekly === "string" ? data.fixedMissionIds.weekly : undefined,
      season: typeof data.fixedMissionIds?.season === "string" ? data.fixedMissionIds.season : undefined,
    },
  };
}

export async function getMissionTemplates(): Promise<MissionTemplate[]> {
  const snap = await getDocs(collection(db, "missionTemplates"));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        scope: (data.scope === "weekly" || data.scope === "season") ? data.scope : "daily",
        title: typeof data.title === "string" ? data.title : "ミッション",
        description: typeof data.description === "string" ? data.description : "",
        goalType: ensureGoalType(data.goalType),
        goalValue: Math.max(1, Math.floor(Number(data.goalValue || 1))),
        rewardPoints: Math.max(1, Math.floor(Number(data.rewardPoints || 1))),
        active: Boolean(data.active),
        triggerType:
          data.triggerType === "study_sessions" || data.triggerType === "login_days"
            ? data.triggerType
            : "study_time",
        targetType:
          data.targetType === "weekly" || data.targetType === "season_total"
            ? data.targetType
            : "daily",
        actionType: "at_least",
        subjectLabel: typeof data.subjectLabel === "string" ? data.subjectLabel : "",
        rewardBadge: typeof data.rewardBadge === "string" ? data.rewardBadge : "",
        rewardMultiplier:
          typeof data.rewardMultiplier === "number" && Number.isFinite(data.rewardMultiplier)
            ? Math.max(1, Math.min(3, data.rewardMultiplier))
            : 1,
      } satisfies MissionTemplate;
    })
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));
}

export async function resolveActiveMissions(config: MissionConfig, templates: MissionTemplate[]) {
  const rotationSnap = await getDoc(MISSION_ROTATION_DOC);
  const currentRotation = rotationSnap.exists() ? rotationSnap.data() : {};
  const nextRotation: Record<string, unknown> = { ...currentRotation };

  const resolved: Record<MissionScope, { mission: MissionTemplate | null; period: PeriodInfo }> = {
    daily: { mission: null, period: getPeriodInfo("daily", config) },
    weekly: { mission: null, period: getPeriodInfo("weekly", config) },
    season: { mission: null, period: getPeriodInfo("season", config) },
  };

  let changed = false;

  for (const scope of SCOPES) {
    const period = getPeriodInfo(scope, config);
    const scopedTemplates = templates.filter((t) => t.scope === scope && t.active);
    const candidates = scopedTemplates.length > 0 ? scopedTemplates : [fallbackMission(scope)];
    const selectedFromRotation = currentRotation?.[scope] as
      | { missionId?: string; periodKey?: string }
      | undefined;

    let mission: MissionTemplate | null = null;

    if (config.rotationMode[scope] === "fixed") {
      const fixedId = config.fixedMissionIds[scope];
      if (fixedId) {
        mission = candidates.find((t) => t.id === fixedId) || null;
      }
      if (!mission) {
        mission = pickRandom(candidates);
      }
      const desiredMissionId = mission?.id || "";
      if (
        selectedFromRotation?.missionId !== desiredMissionId ||
        selectedFromRotation?.periodKey !== period.key
      ) {
        changed = true;
        nextRotation[scope] = { missionId: desiredMissionId, periodKey: period.key };
      }
    } else {
      if (
        selectedFromRotation?.missionId &&
        selectedFromRotation.periodKey === period.key
      ) {
        mission = candidates.find((t) => t.id === selectedFromRotation.missionId) || null;
      }
      if (!mission) {
        mission = pickRandom(candidates);
        changed = true;
        nextRotation[scope] = { missionId: mission?.id || "", periodKey: period.key };
      }
    }

    resolved[scope] = { mission, period };
  }

  if (changed) {
    await setDoc(
      MISSION_ROTATION_DOC,
      {
        ...nextRotation,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return resolved;
}

export async function readMissionProgress(params: {
  uid: string;
  mission: MissionTemplate;
  startAt: Date;
  endAt?: Date;
}): Promise<number> {
  const snap = await getDocs(query(collection(db, "studyLogs"), where("userUid", "==", params.uid)));
  const startMs = params.startAt.getTime();
  const endMs = params.endAt ? params.endAt.getTime() : Number.POSITIVE_INFINITY;

  const inRangeDocs = snap.docs.filter((d) => {
    const createdAt = d.data().createdAt;
    const createdMs =
      createdAt && typeof createdAt.toDate === "function"
        ? createdAt.toDate().getTime()
        : typeof createdAt === "string"
        ? new Date(createdAt).getTime()
        : NaN;
    if (Number.isNaN(createdMs)) return false;
    return createdMs >= startMs && createdMs <= endMs;
  });

  if (params.mission.triggerType === "login_days") {
    const daySet = new Set<string>();
    inRangeDocs.forEach((d) => {
      const createdAt = d.data().createdAt;
      const dt = createdAt && typeof createdAt.toDate === "function"
        ? createdAt.toDate()
        : typeof createdAt === "string"
        ? new Date(createdAt)
        : null;
      if (!dt) return;
      daySet.add(dt.toISOString().slice(0, 10));
    });
    return daySet.size;
  }

  if (params.mission.goalType === "study_sessions") {
    return inRangeDocs.reduce((count, d) => {
      const duration = Number(d.data().duration || 0);
      return duration > 0 ? count + 1 : count;
    }, 0);
  }

  return inRangeDocs.reduce((sum, d) => sum + Number(d.data().duration || 0), 0);
}

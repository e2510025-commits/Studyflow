import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
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
    return {
      scope,
      key: dateKey(startAt),
      label: "デイリー",
      startAt,
    };
  }

  if (scope === "weekly") {
    const startAt = getWeekStart(now);
    return {
      scope,
      key: `week-${dateKey(startAt)}`,
      label: "ウィークリー",
      startAt,
    };
  }

  const parsed = new Date(config.seasonStartAt || "");
  const startAt = Number.isNaN(parsed.getTime())
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : parsed;
  return {
    scope,
    key: `season-${config.seasonName}-${dateKey(startAt)}`,
    label: config.seasonName || "シーズン",
    startAt,
  };
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] || null;
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
    const candidates = templates.filter((t) => t.scope === scope && t.active);
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
}): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, "studyLogs"),
      where("userUid", "==", params.uid),
      where("createdAt", ">=", Timestamp.fromDate(params.startAt))
    )
  );

  if (params.mission.goalType === "study_sessions") {
    return snap.docs.reduce((count, d) => {
      const duration = Number(d.data().duration || 0);
      return duration > 0 ? count + 1 : count;
    }, 0);
  }

  return snap.docs.reduce((sum, d) => sum + Number(d.data().duration || 0), 0);
}

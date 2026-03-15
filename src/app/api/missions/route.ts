import { NextResponse } from "next/server";
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/auth/auth";
import { toAppUid } from "@/lib/identity";
import type { MissionScope, MissionStatus } from "@/types";
import {
  buildClaimDocId,
  getMissionConfig,
  getMissionTemplates,
  readMissionProgress,
  resolveActiveMissions,
} from "@/lib/server/missions";

function toError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveUid() {
  const session = await auth();
  const uid = toAppUid(session?.user?.id || "");
  return uid;
}

export async function GET() {
  const uid = await resolveUid();
  if (!uid) return toError("unauthorized", 401);

  const [config, templates] = await Promise.all([getMissionConfig(), getMissionTemplates()]);
  const resolved = await resolveActiveMissions(config, templates);

  const scopes: MissionScope[] = ["daily", "weekly", "season"];
  const missions = await Promise.all(
    scopes.map(async (scope) => {
      const entry = resolved[scope];
      const mission = entry.mission;

      if (!mission) {
        return {
          scope,
          periodKey: entry.period.key,
          periodLabel: entry.period.label,
          mission: null,
          progressValue: 0,
          progressRate: 0,
          completed: false,
          claimed: false,
        } satisfies MissionStatus;
      }

      const progressValue = await readMissionProgress({
        uid,
        mission,
        startAt: entry.period.startAt,
      });

      const completed = progressValue >= mission.goalValue;
      const claimDocId = buildClaimDocId(uid, scope, entry.period.key);
      const claimSnap = await getDoc(doc(db, "missionClaims", claimDocId));

      return {
        scope,
        periodKey: entry.period.key,
        periodLabel: entry.period.label,
        mission,
        progressValue,
        progressRate: Math.min(1, progressValue / mission.goalValue),
        completed,
        claimed: claimSnap.exists(),
      } satisfies MissionStatus;
    })
  );

  return NextResponse.json({
    seasonName: config.seasonName,
    missions,
  });
}

export async function POST(request: Request) {
  const uid = await resolveUid();
  if (!uid) return toError("unauthorized", 401);

  const body = (await request.json()) as { scope?: MissionScope; action?: string };
  const scope = body.scope;

  if (body.action !== "claim" || (scope !== "daily" && scope !== "weekly" && scope !== "season")) {
    return toError("invalid request", 400);
  }

  const [config, templates] = await Promise.all([getMissionConfig(), getMissionTemplates()]);
  const resolved = await resolveActiveMissions(config, templates);
  const target = resolved[scope];
  const mission = target.mission;

  if (!mission) {
    return toError("mission not found", 404);
  }

  const claimDocId = buildClaimDocId(uid, scope, target.period.key);
  const existingClaim = await getDoc(doc(db, "missionClaims", claimDocId));
  if (existingClaim.exists()) {
    return toError("already claimed", 409);
  }

  const progressValue = await readMissionProgress({
    uid,
    mission,
    startAt: target.period.startAt,
  });
  if (progressValue < mission.goalValue) {
    return toError("not completed", 400);
  }

  await setDoc(doc(db, "missionClaims", claimDocId), {
    uid,
    scope,
    periodKey: target.period.key,
    missionId: mission.id,
    points: mission.rewardPoints,
    claimedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "missionRewards"), {
    uid,
    scope,
    missionId: mission.id,
    points: mission.rewardPoints,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "userProfiles", uid),
    {
      totalPoints: increment(mission.rewardPoints),
      bonusPoints: increment(mission.rewardPoints),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, points: mission.rewardPoints });
}

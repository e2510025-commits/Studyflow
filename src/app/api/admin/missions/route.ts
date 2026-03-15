import { NextResponse } from "next/server";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";
import type { MissionScope } from "@/types";
import { getMissionConfig, getMissionTemplates } from "@/lib/server/missions";

function isScope(value: unknown): value is MissionScope {
  return value === "daily" || value === "weekly" || value === "season";
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [config, templates] = await Promise.all([getMissionConfig(), getMissionTemplates()]);
  return NextResponse.json({ config, templates });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as
    | {
        action: "saveConfig";
        seasonName?: string;
        seasonStartAt?: string;
        seasonEndAt?: string;
        rotationMode?: Partial<Record<MissionScope, "random" | "fixed">>;
        fixedMissionIds?: Partial<Record<MissionScope, string>>;
      }
    | {
        action: "upsertTemplate";
        templateId?: string;
        scope?: MissionScope;
        title?: string;
        description?: string;
        goalType?: "study_seconds" | "study_sessions";
        goalValue?: number;
        rewardPoints?: number;
        active?: boolean;
      }
    | {
        action: "deleteTemplate";
        templateId?: string;
      };

  if (body.action === "saveConfig") {
    const seasonName = typeof body.seasonName === "string" && body.seasonName.trim()
      ? body.seasonName.trim().slice(0, 60)
      : "Season";
    const seasonStartAt =
      typeof body.seasonStartAt === "string" && body.seasonStartAt
        ? body.seasonStartAt
        : new Date().toISOString();
    const seasonEndAt =
      typeof body.seasonEndAt === "string" && body.seasonEndAt
        ? body.seasonEndAt
        : seasonStartAt;
    const startMs = new Date(seasonStartAt).getTime();
    const endMs = new Date(seasonEndAt).getTime();
    const normalizedStart = Number.isNaN(startMs) ? new Date().toISOString() : new Date(startMs).toISOString();
    const normalizedEnd = Number.isNaN(endMs)
      ? normalizedStart
      : new Date(Math.max(endMs, startMs)).toISOString();

    await setDoc(
      doc(db, "missionConfig", "main"),
      {
        seasonName,
        seasonStartAt: normalizedStart,
        seasonEndAt: normalizedEnd,
        rotationMode: {
          daily: body.rotationMode?.daily === "fixed" ? "fixed" : "random",
          weekly: body.rotationMode?.weekly === "fixed" ? "fixed" : "random",
          season: body.rotationMode?.season === "fixed" ? "fixed" : "random",
        },
        fixedMissionIds: {
          daily: body.fixedMissionIds?.daily || "",
          weekly: body.fixedMissionIds?.weekly || "",
          season: body.fixedMissionIds?.season || "",
        },
        updatedBy: guard.appUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  }

  if (body.action === "upsertTemplate") {
    if (!isScope(body.scope) || !body.title) {
      return NextResponse.json({ error: "invalid template" }, { status: 400 });
    }

    const payload = {
      scope: body.scope,
      title: body.title.trim().slice(0, 80),
      description: (body.description || "").trim().slice(0, 280),
      goalType: body.goalType === "study_sessions" ? "study_sessions" : "study_seconds",
      goalValue: Math.max(1, Math.floor(Number(body.goalValue || 1))),
      rewardPoints: Math.max(1, Math.floor(Number(body.rewardPoints || 1))),
      active: body.active !== false,
      updatedBy: guard.appUid,
      updatedAt: serverTimestamp(),
    };

    if (body.templateId) {
      const targetRef = doc(db, "missionTemplates", body.templateId);
      const before = await getDoc(targetRef);
      await setDoc(
        targetRef,
        {
          ...payload,
          createdAt: before.exists() ? before.data().createdAt : serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true, id: body.templateId });
    }

    const created = await addDoc(collection(db, "missionTemplates"), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: created.id });
  }

  if (body.action === "deleteTemplate") {
    if (!body.templateId) {
      return NextResponse.json({ error: "templateId required" }, { status: 400 });
    }
    await deleteDoc(doc(db, "missionTemplates", body.templateId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

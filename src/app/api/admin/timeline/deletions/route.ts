import { NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

const ADMIN_TIMELINE_DELETION_LOGS = "adminTimelineDeletionLogs";

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date(0).toISOString();
}

interface RawDeletionLog {
  postId?: string;
  postUid?: string;
  postUserName?: string;
  postUserAvatar?: string;
  postBody?: string;
  postImageUrl?: string;
  postCreatedAt?: unknown;
  deletedAt?: unknown;
  deletedByUid?: string;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const logsSnap = await getDocs(
    query(collection(db, ADMIN_TIMELINE_DELETION_LOGS), limit(300))
  );

  const logs = logsSnap.docs
    .map((row) => {
      const data = row.data() as RawDeletionLog;
      return {
        id: row.id,
        postId: String(data.postId || ""),
        postUid: String(data.postUid || ""),
        postUserName: sanitizeDisplayName(data.postUserName || "匿名"),
        postUserAvatar: sanitizeAvatar(data.postUserAvatar || "👤"),
        postBody: String(data.postBody || ""),
        postImageUrl: typeof data.postImageUrl === "string" ? data.postImageUrl : "",
        postCreatedAt: toIso(data.postCreatedAt),
        deletedAt: toIso(data.deletedAt),
        deletedByUid: String(data.deletedByUid || ""),
      };
    })
    .filter((row) => row.postId)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const deleterUids = Array.from(new Set(logs.map((row) => row.deletedByUid).filter(Boolean)));
  const deleterProfiles = await Promise.all(
    deleterUids.map(async (uid) => {
      const snap = await getDoc(doc(db, "userProfiles", uid));
      if (!snap.exists()) {
        return [uid, { name: uid, avatar: "🛡️" }] as const;
      }
      const data = snap.data();
      return [
        uid,
        {
          name: sanitizeDisplayName(data.name || uid),
          avatar: sanitizeAvatar(data.avatar || "🛡️"),
        },
      ] as const;
    })
  );
  const deleterMap = new Map(deleterProfiles);

  const mergedLogs = logs.map((row) => {
    const deleter = deleterMap.get(row.deletedByUid) || { name: row.deletedByUid, avatar: "🛡️" };
    return {
      ...row,
      deletedByName: deleter.name,
      deletedByAvatar: deleter.avatar,
    };
  });

  return NextResponse.json({ logs: mergedLogs.slice(0, 200) });
}

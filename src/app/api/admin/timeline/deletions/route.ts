import { NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/server/adminGuard";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

const ADMIN_TIMELINE_DELETION_LOGS = "adminTimelineDeletionLogs";
const TIMELINE_POSTS = "timelinePosts";

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

interface RawTimelinePost {
  uid?: string;
  userId?: string;
  name?: string;
  avatar?: string;
  body?: string;
  imageUrl?: string;
  createdAt?: unknown;
  editedAt?: unknown;
  deletedAt?: unknown;
  deletedByUid?: string;
  deletedByAdminUid?: string;
  isDeleted?: boolean;
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

  // Fallback for older deletions or self deletions that were not written to admin logs collection.
  const deletedPostsSnap = await getDocs(
    query(collection(db, TIMELINE_POSTS), where("isDeleted", "==", true), limit(400))
  );
  const fallbackRows = deletedPostsSnap.docs.map((row) => {
    const data = row.data() as RawTimelinePost;
    const deletedByUid = String(data.deletedByUid || data.deletedByAdminUid || "");
    return {
      id: `post_${row.id}`,
      postId: row.id,
      postUid: String(data.uid || data.userId || ""),
      postUserName: sanitizeDisplayName(data.name || "匿名"),
      postUserAvatar: sanitizeAvatar(data.avatar || "👤"),
      postBody: String(data.body || ""),
      postImageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
      postCreatedAt: toIso(data.createdAt),
      deletedAt: toIso(data.deletedAt || data.editedAt),
      deletedByUid,
    };
  });

  const mergedByPostId = new Map<string, (typeof logs)[number]>();
  logs.forEach((row) => mergedByPostId.set(row.postId, row));
  fallbackRows.forEach((row) => {
    if (!mergedByPostId.has(row.postId)) {
      mergedByPostId.set(row.postId, row);
    }
  });

  const mergedRaw = Array.from(mergedByPostId.values()).sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );

  const deleterUids = Array.from(new Set(mergedRaw.map((row) => row.deletedByUid).filter(Boolean)));
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

  const mergedLogs = mergedRaw.map((row) => {
    const deleter = deleterMap.get(row.deletedByUid) || { name: row.deletedByUid, avatar: "🛡️" };
    return {
      ...row,
      deletedByName: deleter.name || "不明",
      deletedByAvatar: deleter.avatar || "🛡️",
    };
  });

  return NextResponse.json({ logs: mergedLogs.slice(0, 200) });
}

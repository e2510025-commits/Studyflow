import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import { getAchievementMeta } from "@/lib/achievements";
import type {
  BulletinCategory,
  BulletinPost,
  BulletinThreadMessage,
  CommunityStreamMessage,
} from "@/types";

const GLOBAL_STREAM = "globalStreamMessages";
const GLOBAL_SYSTEM_EVENTS = "globalSystemEvents";
const TIMELINE_POSTS = "timelinePosts";
const TIMELINE_POST_RESPECTS = "timelinePostRespects";
const TIMELINE_POST_LIKES = "timelinePostLikes";
const BULLETIN_POSTS = "bulletinPosts";
const BULLETIN_HELPFULS = "bulletinHelpfuls";
const BULLETIN_THREADS = "bulletinThreadMessages";
const GLOBAL_STREAM_RESPECTS = "globalStreamRespects";
const BULLETIN_ALLOWED_CATEGORIES: BulletinCategory[] = ["qa", "tips", "chat", "ops"];

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

async function fetchIsOfficial(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "userProfiles", uid));
    return snap.exists() ? Boolean(snap.data().isOfficial) : false;
  } catch {
    return false;
  }
}

export function subscribeGlobalStreamMessages(
  callback: (rows: CommunityStreamMessage[]) => void
) {
  const merged = new Map<string, CommunityStreamMessage>();

  const emit = () => {
    const sorted = Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    callback(sorted.slice(0, 120));
  };

  const unsubUser = onSnapshot(
    query(collection(db, GLOBAL_STREAM), orderBy("createdAt", "desc"), limit(120)),
    (snapshot) => {
      snapshot.docs.forEach((d) => {
        const data = d.data();
        merged.set(`u_${d.id}`, {
          id: d.id,
          kind: "user",
          messageType: data.messageType === "image" ? "image" : "text",
          uid: String(data.uid || ""),
          name: sanitizeDisplayName(data.name || "匿名"),
          avatar: sanitizeAvatar(data.avatar || "👤"),
          isOfficial: Boolean(data.isOfficial),
          body: String(data.body || ""),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
          replyToId: typeof data.replyToId === "string" ? data.replyToId : undefined,
          respectCount: Math.max(0, Number(data.respectCount || 0)),
          editedAt: typeof data.editedAt === "string" ? data.editedAt : undefined,
          isDeleted: Boolean(data.isDeleted),
          createdAt: toIso(data.createdAt),
        });
      });
      emit();
    },
    () => {
      Array.from(merged.keys())
        .filter((key) => key.startsWith("u_"))
        .forEach((key) => merged.delete(key));
      emit();
    }
  );

  const unsubSystem = onSnapshot(
    query(collection(db, GLOBAL_SYSTEM_EVENTS), orderBy("createdAt", "desc"), limit(120)),
    (snapshot) => {
      snapshot.docs.forEach((d) => {
        const data = d.data();
        merged.set(`s_${d.id}`, {
          id: d.id,
          kind: "system",
          uid: String(data.uid || ""),
          name: "SYSTEM",
          avatar: "🤖",
          body: String(data.body || ""),
          createdAt: toIso(data.createdAt),
        });
      });
      emit();
    },
    () => {
      Array.from(merged.keys())
        .filter((key) => key.startsWith("s_"))
        .forEach((key) => merged.delete(key));
      emit();
    }
  );

  return () => {
    unsubUser();
    unsubSystem();
  };
}

export async function sendGlobalStreamMessage(params: {
  uid: string;
  name: string;
  avatar: string;
  body: string;
  replyToId?: string;
}) {
  const body = params.body.trim();
  if (!params.uid || !body) return;
  const isOfficial = await fetchIsOfficial(params.uid);
  await addDoc(collection(db, GLOBAL_STREAM), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    body: body.slice(0, 800),
    isOfficial,
    messageType: "text",
    replyToId: params.replyToId || "",
    respectCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function sendGlobalStreamImageMessage(params: {
  uid: string;
  name: string;
  avatar: string;
  imageUrl: string;
  caption?: string;
}) {
  const imageUrl = params.imageUrl.trim();
  if (!params.uid || !imageUrl) return;
  const isOfficial = await fetchIsOfficial(params.uid);

  await addDoc(collection(db, GLOBAL_STREAM), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    body: (params.caption || "画像を共有しました").trim().slice(0, 140),
    isOfficial,
    messageType: "image",
    imageUrl: imageUrl.slice(0, 700_000),
    respectCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function editGlobalStreamMessage(params: {
  postId: string;
  uid: string;
  body: string;
}) {
  const trimmed = params.body.trim();
  if (!params.postId || !params.uid || !trimmed) return;
  const ref = doc(db, GLOBAL_STREAM, params.postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (String(data.uid || "") !== params.uid) {
    throw new Error("forbidden");
  }
  await updateDoc(ref, {
    body: trimmed.slice(0, 800),
    editedAt: new Date().toISOString(),
    isDeleted: false,
  });
}

export async function deleteGlobalStreamMessage(params: {
  postId: string;
  uid: string;
  mode?: "soft" | "hard";
}) {
  if (!params.postId || !params.uid) return;
  const ref = doc(db, GLOBAL_STREAM, params.postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (String(data.uid || "") !== params.uid) {
    throw new Error("forbidden");
  }

  if ((params.mode || "soft") === "hard") {
    await deleteDoc(ref);
    return;
  }
  await updateDoc(ref, {
    body: "",
    imageUrl: "",
    isDeleted: true,
    editedAt: new Date().toISOString(),
  });
}

function respectDocId(postId: string, uid: string) {
  return `${postId}_${uid}`;
}

export async function toggleGlobalStreamRespect(params: {
  postId: string;
  uid: string;
}) {
  if (!params.postId || !params.uid) return;

  const postRef = doc(db, GLOBAL_STREAM, params.postId);
  const respectRef = doc(db, GLOBAL_STREAM_RESPECTS, respectDocId(params.postId, params.uid));

  await runTransaction(db, async (tx) => {
    const [postSnap, respectSnap] = await Promise.all([tx.get(postRef), tx.get(respectRef)]);
    if (!postSnap.exists()) return;

    const currentRespect = Math.max(0, Number(postSnap.data().respectCount || 0));
    if (respectSnap.exists()) {
      tx.delete(respectRef);
      tx.set(postRef, { respectCount: Math.max(0, currentRespect - 1) }, { merge: true });
      return;
    }

    tx.set(respectRef, {
      postId: params.postId,
      uid: params.uid,
      createdAt: serverTimestamp(),
    });
    tx.set(postRef, { respectCount: currentRespect + 1 }, { merge: true });
  });
}

export function subscribeMyRespectedGlobalPostIds(uid: string, callback: (ids: Set<string>) => void) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  const q = query(collection(db, GLOBAL_STREAM_RESPECTS), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const postId = String(data.postId || "");
        if (postId) ids.add(postId);
      });
      callback(ids);
    },
    () => callback(new Set())
  );
}

export function subscribeUserTimelinePosts(uid: string, callback: (rows: CommunityStreamMessage[]) => void) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, TIMELINE_POSTS), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(120));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          kind: "user" as const,
          messageType: (data.messageType === "image" ? "image" : "text") as "image" | "text",
          uid: String(data.uid || ""),
          name: sanitizeDisplayName(data.name || "匿名"),
          avatar: sanitizeAvatar(data.avatar || "👤"),
          isOfficial: Boolean(data.isOfficial),
          body: String(data.body || ""),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
          replyToId: typeof data.replyToId === "string" ? data.replyToId : undefined,
          replyCount: Math.max(0, Number(data.replyCount || 0)),
          repostCount: Math.max(0, Number(data.repostCount || 0)),
          respectCount: Math.max(0, Number(data.respectCount || 0)),
          likeCount: Math.max(0, Number(data.likeCount || 0)),
          editedAt: typeof data.editedAt === "string" ? data.editedAt : undefined,
          isDeleted: Boolean(data.isDeleted),
          createdAt: toIso(data.createdAt),
        };
      });
      callback(rows);
    },
    () => callback([])
  );
}

export function subscribeTimelinePosts(callback: (rows: CommunityStreamMessage[]) => void) {
  const q = query(collection(db, TIMELINE_POSTS), orderBy("createdAt", "desc"), limit(140));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          kind: "user" as const,
          messageType: (data.messageType === "image" ? "image" : "text") as "image" | "text",
          uid: String(data.uid || ""),
          name: sanitizeDisplayName(data.name || "匿名"),
          avatar: sanitizeAvatar(data.avatar || "👤"),
          isOfficial: Boolean(data.isOfficial),
          body: String(data.body || ""),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
          replyToId: typeof data.replyToId === "string" ? data.replyToId : undefined,
          replyCount: Math.max(0, Number(data.replyCount || 0)),
          repostCount: Math.max(0, Number(data.repostCount || 0)),
          respectCount: Math.max(0, Number(data.respectCount || 0)),
          likeCount: Math.max(0, Number(data.likeCount || 0)),
          editedAt: typeof data.editedAt === "string" ? data.editedAt : undefined,
          isDeleted: Boolean(data.isDeleted),
          createdAt: toIso(data.createdAt),
        } satisfies CommunityStreamMessage;
      });
      callback(rows);
    },
    () => callback([])
  );
}

export async function sendTimelinePost(params: {
  uid: string;
  name: string;
  avatar: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!params.uid || !body) return;
  const isOfficial = await fetchIsOfficial(params.uid);
  await addDoc(collection(db, TIMELINE_POSTS), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    isOfficial,
    body: body.slice(0, 1200),
    messageType: "text",
    replyCount: 0,
    repostCount: 0,
    respectCount: 0,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function sendTimelineImagePost(params: {
  uid: string;
  name: string;
  avatar: string;
  imageUrl: string;
  caption?: string;
}) {
  const imageUrl = params.imageUrl.trim();
  if (!params.uid || !imageUrl) return;
  const isOfficial = await fetchIsOfficial(params.uid);
  await addDoc(collection(db, TIMELINE_POSTS), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    isOfficial,
    body: (params.caption || "").trim().slice(0, 1200),
    imageUrl: imageUrl.slice(0, 700_000),
    messageType: "image",
    replyCount: 0,
    repostCount: 0,
    respectCount: 0,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
}

function timelineReactDocId(postId: string, uid: string) {
  return `${postId}_${uid}`;
}

export function subscribeMyRespectedTimelinePostIds(uid: string, callback: (ids: Set<string>) => void) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  const q = query(collection(db, TIMELINE_POST_RESPECTS), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const postId = String(d.data().postId || "");
        if (postId) ids.add(postId);
      });
      callback(ids);
    },
    () => callback(new Set())
  );
}

export function subscribeMyLikedTimelinePostIds(uid: string, callback: (ids: Set<string>) => void) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  const q = query(collection(db, TIMELINE_POST_LIKES), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const postId = String(d.data().postId || "");
        if (postId) ids.add(postId);
      });
      callback(ids);
    },
    () => callback(new Set())
  );
}

export async function toggleTimelineRespect(params: { postId: string; uid: string }) {
  if (!params.postId || !params.uid) return;
  const postRef = doc(db, TIMELINE_POSTS, params.postId);
  const reactRef = doc(db, TIMELINE_POST_RESPECTS, timelineReactDocId(params.postId, params.uid));

  await runTransaction(db, async (tx) => {
    const [postSnap, reactSnap] = await Promise.all([tx.get(postRef), tx.get(reactRef)]);
    if (!postSnap.exists()) return;
    const current = Math.max(0, Number(postSnap.data().respectCount || 0));
    if (reactSnap.exists()) {
      tx.delete(reactRef);
      tx.set(postRef, { respectCount: Math.max(0, current - 1) }, { merge: true });
      return;
    }
    tx.set(reactRef, { postId: params.postId, uid: params.uid, createdAt: serverTimestamp() });
    tx.set(postRef, { respectCount: current + 1 }, { merge: true });
  });
}

export async function toggleTimelineLike(params: { postId: string; uid: string }) {
  if (!params.postId || !params.uid) return;
  const postRef = doc(db, TIMELINE_POSTS, params.postId);
  const reactRef = doc(db, TIMELINE_POST_LIKES, timelineReactDocId(params.postId, params.uid));

  await runTransaction(db, async (tx) => {
    const [postSnap, reactSnap] = await Promise.all([tx.get(postRef), tx.get(reactRef)]);
    if (!postSnap.exists()) return;
    const current = Math.max(0, Number(postSnap.data().likeCount || 0));
    if (reactSnap.exists()) {
      tx.delete(reactRef);
      tx.set(postRef, { likeCount: Math.max(0, current - 1) }, { merge: true });
      return;
    }
    tx.set(reactRef, { postId: params.postId, uid: params.uid, createdAt: serverTimestamp() });
    tx.set(postRef, { likeCount: current + 1 }, { merge: true });
  });
}

export async function createAutoStudyTimelinePost(params: {
  uid: string;
  name: string;
  avatar: string;
  subjectName: string;
  durationSeconds: number;
}) {
  const minutes = Math.max(1, Math.round(params.durationSeconds / 60));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const durationText = hour > 0 ? `${hour}時間${minute}分` : `${minute}分`;
  await sendTimelinePost({
    uid: params.uid,
    name: params.name,
    avatar: params.avatar,
    body: `学習完了: ${params.subjectName} を ${durationText} 勉強しました!`,
  });
}

export async function syncAchievementSystemEvents() {
  const usersSnap = await getDocs(query(collection(db, "userProfiles"), limit(250)));

  await Promise.all(
    usersSnap.docs.flatMap((row) => {
      const data = row.data();
      const uid = String(data.uid || row.id || "");
      const name = sanitizeDisplayName(data.name || "匿名");
      const unlockMap =
        typeof data.achievementUnlockedAt === "object" && data.achievementUnlockedAt
          ? (data.achievementUnlockedAt as Record<string, string>)
          : {};
      const entries = Object.entries(unlockMap)
        .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
        .slice(0, 2);

      return entries.map(async ([badgeId, at]) => {
        const meta = getAchievementMeta(badgeId);
        const title = meta?.title || badgeId;
        const createdAt = new Date(at);
        const id = `achv_${uid}_${badgeId}`;
        await setDoc(
          doc(db, GLOBAL_SYSTEM_EVENTS, id),
          {
            uid,
            body: `[SYSTEM] ${name}さんが勲章『${title}』を獲得しました。`,
            createdAt: Number.isNaN(createdAt.getTime()) ? serverTimestamp() : Timestamp.fromDate(createdAt),
          },
          { merge: true }
        );
      });
    })
  );
}

export function subscribeBulletinPosts(
  callback: (rows: BulletinPost[]) => void,
  category: BulletinCategory | "all" = "all"
) {
  const q = query(collection(db, BULLETIN_POSTS), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows: BulletinPost[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || ""),
            name: sanitizeDisplayName(data.name || "匿名"),
            avatar: sanitizeAvatar(data.avatar || "👤"),
            isOfficial: Boolean(data.isOfficial),
            title: String(data.title || "無題").slice(0, 120),
            content: String(data.content || ""),
            category: (BULLETIN_ALLOWED_CATEGORIES.includes(data.category as BulletinCategory)
              ? data.category
              : "tips") as BulletinCategory,
            helpfulCount: Math.max(0, Number(data.helpfulCount || 0)),
            replyCount: Math.max(0, Number(data.replyCount || 0)),
            resolved: Boolean(data.resolved),
            createdAt: toIso(data.createdAt),
            updatedAt:
              data.updatedAt instanceof Timestamp || typeof data.updatedAt === "string"
                ? toIso(data.updatedAt)
                : undefined,
          };
        })
        .filter((row) => (category === "all" ? true : row.category === category));
      callback(rows);
    },
    () => callback([])
  );
}

export async function createBulletinPost(params: {
  title: string;
  content: string;
  category: BulletinCategory;
}) {
  const title = params.title.trim().slice(0, 120);
  const content = params.content.trim().slice(0, 6000);
  if (!title || !content) return;

  const response = await fetch("/api/bulletin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      content,
      category: params.category,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "bulletin_create_failed");
  }
}

export async function updateBulletinResolved(params: {
  postId: string;
  resolved: boolean;
}) {
  if (!params.postId) return;
  const response = await fetch("/api/bulletin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId: params.postId,
      resolved: params.resolved,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "bulletin_update_failed");
  }
}

export async function editBulletinPost(params: {
  postId: string;
  title: string;
  content: string;
}) {
  const response = await fetch("/api/bulletin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "edit",
      postId: params.postId,
      title: params.title.trim().slice(0, 120),
      content: params.content.trim().slice(0, 6000),
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "bulletin_edit_failed");
  }
}

export async function deleteBulletinPost(params: { postId: string }) {
  const response = await fetch("/api/bulletin", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: params.postId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "bulletin_delete_failed");
  }
}

export function subscribeBulletinThreadMessages(
  postId: string,
  callback: (rows: BulletinThreadMessage[]) => void
) {
  if (!postId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, BULLETIN_THREADS),
    where("postId", "==", postId),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          postId: String(data.postId || ""),
          uid: String(data.uid || ""),
          name: sanitizeDisplayName(data.name || "匿名"),
          avatar: sanitizeAvatar(data.avatar || "👤"),
          isOfficial: Boolean(data.isOfficial),
          body: String(data.body || ""),
          createdAt: toIso(data.createdAt),
          editedAt: typeof data.editedAt === "string" ? data.editedAt : undefined,
          isDeleted: Boolean(data.isDeleted),
        } satisfies BulletinThreadMessage;
      });
      callback(rows);
    },
    () => callback([])
  );
}

export async function sendBulletinThreadMessage(params: {
  postId: string;
  uid: string;
  name: string;
  avatar: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!params.postId || !params.uid || !body) return;
  const isOfficial = await fetchIsOfficial(params.uid);
  await addDoc(collection(db, BULLETIN_THREADS), {
    postId: params.postId,
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    isOfficial,
    body: body.slice(0, 1000),
    isDeleted: false,
    createdAt: serverTimestamp(),
  });
}

export async function editBulletinThreadMessage(params: {
  messageId: string;
  uid: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!params.messageId || !params.uid || !body) return;
  const ref = doc(db, BULLETIN_THREADS, params.messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (String(snap.data().uid || "") !== params.uid) throw new Error("forbidden");
  await updateDoc(ref, {
    body: body.slice(0, 1000),
    editedAt: new Date().toISOString(),
    isDeleted: false,
  });
}

export async function deleteBulletinThreadMessage(params: {
  messageId: string;
  uid: string;
}) {
  if (!params.messageId || !params.uid) return;
  const ref = doc(db, BULLETIN_THREADS, params.messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (String(snap.data().uid || "") !== params.uid) throw new Error("forbidden");
  await updateDoc(ref, {
    body: "",
    isDeleted: true,
    editedAt: new Date().toISOString(),
  });
}

function helpfulDocId(postId: string, uid: string) {
  return `${postId}_${uid}`;
}

export function subscribeMyHelpfulPostIds(uid: string, callback: (ids: Set<string>) => void) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  const q = query(collection(db, BULLETIN_HELPFULS), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const postId = String(data.postId || "");
        if (postId) ids.add(postId);
      });
      callback(ids);
    },
    () => callback(new Set())
  );
}

export async function toggleBulletinHelpful(params: {
  postId: string;
  postAuthorUid: string;
  uid: string;
}) {
  if (!params.postId || !params.uid) return;

  const postRef = doc(db, BULLETIN_POSTS, params.postId);
  const helpfulRef = doc(db, BULLETIN_HELPFULS, helpfulDocId(params.postId, params.uid));
  const profileRef = doc(db, "userProfiles", params.postAuthorUid);

  await runTransaction(db, async (tx) => {
    const [postSnap, helpfulSnap, profileSnap] = await Promise.all([
      tx.get(postRef),
      tx.get(helpfulRef),
      tx.get(profileRef),
    ]);

    if (!postSnap.exists()) return;

    const postData = postSnap.data();
    const currentHelpful = Math.max(0, Number(postData.helpfulCount || 0));
    const profileHelpful = profileSnap.exists()
      ? Math.max(0, Number(profileSnap.data().helpfulReceived || 0))
      : 0;

    if (helpfulSnap.exists()) {
      tx.delete(helpfulRef);
      tx.set(postRef, { helpfulCount: Math.max(0, currentHelpful - 1) }, { merge: true });
      if (params.postAuthorUid) {
        tx.set(profileRef, { helpfulReceived: Math.max(0, profileHelpful - 1) }, { merge: true });
      }
      return;
    }

    tx.set(helpfulRef, {
      postId: params.postId,
      uid: params.uid,
      createdAt: serverTimestamp(),
    });
    tx.set(postRef, { helpfulCount: currentHelpful + 1 }, { merge: true });
    if (params.postAuthorUid) {
      tx.set(profileRef, { helpfulReceived: profileHelpful + 1 }, { merge: true });
    }
  });
}

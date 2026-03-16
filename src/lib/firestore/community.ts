import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import { getAchievementMeta } from "@/lib/achievements";
import type { BulletinCategory, BulletinPost, CommunityStreamMessage } from "@/types";

const GLOBAL_STREAM = "globalStreamMessages";
const GLOBAL_SYSTEM_EVENTS = "globalSystemEvents";
const BULLETIN_POSTS = "bulletinPosts";
const BULLETIN_HELPFULS = "bulletinHelpfuls";
const BULLETIN_ALLOWED_CATEGORIES: BulletinCategory[] = ["qa", "tips", "chat", "ops"];

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
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
          body: String(data.body || ""),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
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
}) {
  const body = params.body.trim();
  if (!params.uid || !body) return;
  await addDoc(collection(db, GLOBAL_STREAM), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    body: body.slice(0, 800),
    messageType: "text",
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

  await addDoc(collection(db, GLOBAL_STREAM), {
    uid: params.uid,
    name: sanitizeDisplayName(params.name || "匿名"),
    avatar: sanitizeAvatar(params.avatar || "👤"),
    body: (params.caption || "画像を共有しました").trim().slice(0, 140),
    messageType: "image",
    imageUrl: imageUrl.slice(0, 700_000),
    createdAt: serverTimestamp(),
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
            title: String(data.title || "無題").slice(0, 120),
            content: String(data.content || ""),
            category: (BULLETIN_ALLOWED_CATEGORIES.includes(data.category as BulletinCategory)
              ? data.category
              : "tips") as BulletinCategory,
            helpfulCount: Math.max(0, Number(data.helpfulCount || 0)),
            replyCount: Math.max(0, Number(data.replyCount || 0)),
            resolved: Boolean(data.resolved),
            createdAt: toIso(data.createdAt),
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

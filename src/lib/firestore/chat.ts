import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { ChatMessage, ChatMessageType } from "@/types";

/** Firestoreのチャットメッセージコレクション */
const CHAT_COLLECTION = "chatMessages";

export interface DirectMessageUnreadCounts {
  total: number;
  byUser: Record<string, number>;
}

function getConversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/#?%*:|"<>]/g, "_");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

/**
 * 2ユーザー間のメッセージをリアルタイム購読
 * @returns unsubscribe 関数
 */
export function subscribeChatMessages(
  myUid: string,
  friendUid: string,
  callback: (messages: ChatMessage[]) => void
) {
  const conversationId = getConversationId(myUid, friendUid);
  const q = query(
    collection(db, CHAT_COLLECTION),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = snapshot.docs.map((d) => {
      const data = d.data();
      const createdAtIso =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === "string"
          ? data.createdAt
          : new Date(typeof data.createdAtMs === "number" ? data.createdAtMs : Date.now()).toISOString();

      return {
        id: d.id,
        fromUid: data.fromUid,
        toUid: data.toUid,
        type: data.type as ChatMessageType,
        content: data.content,
        fileName: data.fileName,
        storagePath: data.storagePath,
        replyToId: data.replyToId,
        replyToContent: data.replyToContent,
        replyToFromUid: data.replyToFromUid,
        readBy: Array.isArray(data.readBy) ? data.readBy : [],
        readAt:
          data.readAt instanceof Timestamp
            ? data.readAt.toDate().toISOString()
            : data.readAt,
        editedAt:
          data.editedAt instanceof Timestamp
            ? data.editedAt.toDate().toISOString()
            : data.editedAt,
        isDeleted: Boolean(data.isDeleted),
        createdAt: createdAtIso,
      };
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    callback(messages);
  });
}

/**
 * テキストメッセージを送信
 */
export async function sendTextMessage(
  fromUid: string,
  toUid: string,
  text: string,
  replyTo?: {
    messageId: string;
    content: string;
    fromUid: string;
  }
): Promise<void> {
  const now = Date.now();
  const messageData: Record<string, unknown> = {
    conversationId: getConversationId(fromUid, toUid),
    fromUid,
    toUid,
    type: "text",
    content: text,
    readBy: [fromUid],
    createdAtMs: now,
    createdAt: serverTimestamp(),
  };

  if (replyTo) {
    messageData.replyToId = replyTo.messageId;
    messageData.replyToContent = replyTo.content.slice(0, 200);
    messageData.replyToFromUid = replyTo.fromUid;
  }

  await addDoc(collection(db, CHAT_COLLECTION), messageData);
}

export async function sendTaskMessage(
  fromUid: string,
  toUid: string,
  payload: {
    title: string;
    details?: string;
    dueDate?: string;
  }
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, CHAT_COLLECTION), {
    conversationId: getConversationId(fromUid, toUid),
    fromUid,
    toUid,
    type: "task",
    content: JSON.stringify({
      title: payload.title.trim(),
      details: (payload.details || "").trim(),
      dueDate: payload.dueDate || "",
    }),
    readBy: [fromUid],
    createdAtMs: now,
    createdAt: serverTimestamp(),
  });
}

/**
 * 画像・動画ファイルを Storage にアップロードしてメッセージ送信
 */
export async function sendMediaMessage(
  fromUid: string,
  toUid: string,
  type: "image" | "video",
  file: File
): Promise<void> {
  const now = Date.now();
  const conversationId = getConversationId(fromUid, toUid);
  const path = `chat/${conversationId}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const storageRef = ref(storage, path);

  const sendAsDataUrl = async (fileToSend: File) => {
    const dataUrl = await fileToDataUrl(fileToSend);
    await addDoc(collection(db, CHAT_COLLECTION), {
      conversationId,
      fromUid,
      toUid,
      type,
      content: dataUrl,
      fileName: fileToSend.name,
      readBy: [fromUid],
      createdAtMs: now,
      createdAt: serverTimestamp(),
    });
  };

  // Compress image before upload
  if (type === "image") {
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      
      if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
        await sendAsDataUrl(compressed);
        return;
      }

      const compressedPath = `chat/${conversationId}/${Date.now()}_${sanitizeFileName(compressed.name || file.name)}`;
      const compressedRef = ref(storage, compressedPath);

      await Promise.race([
        uploadBytes(compressedRef, compressed),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 30000);
        }),
      ]);
      const url = await getDownloadURL(compressedRef);

      await addDoc(collection(db, CHAT_COLLECTION), {
        conversationId,
        fromUid,
        toUid,
        type,
        content: url,
        fileName: compressed.name || file.name,
        storagePath: compressedPath,
        readBy: [fromUid],
        createdAtMs: now,
        createdAt: serverTimestamp(),
      });
      return;
    } catch (error) {
      console.error("Image compression failed:", error);
      // Fall through to original upload
    }
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    await sendAsDataUrl(file);
    return;
  }

  try {
    await Promise.race([
      uploadBytes(storageRef, file),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 30000);
      }),
    ]);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, CHAT_COLLECTION), {
      conversationId,
      fromUid,
      toUid,
      type,
      content: url,
      fileName: file.name,
      storagePath: path,
      readBy: [fromUid],
      createdAtMs: now,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (type === "image") {
      await sendAsDataUrl(file);
      return;
    }
    throw error;
  }
}

export async function markChatMessagesAsRead(
  myUid: string,
  friendUid: string
): Promise<void> {
  const q = query(collection(db, CHAT_COLLECTION), where("toUid", "==", myUid));
  const snapshot = await getDocs(q);
  const unread = snapshot.docs.filter((d) => {
    const data = d.data();
    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    return data.fromUid === friendUid && !readBy.includes(myUid);
  });

  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((d) => {
    const data = d.data();
    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    batch.update(d.ref, {
      readBy: Array.from(new Set([...readBy, myUid])),
      readAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function editChatMessageInFirestore(
  messageId: string,
  content: string
): Promise<void> {
  const trimmed = content.trim();
  if (!messageId || !trimmed) return;
  await updateDoc(doc(db, CHAT_COLLECTION, messageId), {
    content: trimmed.slice(0, 4000),
    editedAt: serverTimestamp(),
    isDeleted: false,
  });
}

export function subscribeUnreadDirectMessageCounts(
  myUid: string,
  callback: (counts: DirectMessageUnreadCounts) => void
) {
  const q = query(
    collection(db, CHAT_COLLECTION),
    where("toUid", "==", myUid),
    orderBy("createdAt", "desc"),
    limit(500)
  );

  return onSnapshot(q, (snapshot) => {
    const byUser: Record<string, number> = {};

    snapshot.docs.forEach((d) => {
      const data = d.data();
      const fromUid = typeof data.fromUid === "string" ? data.fromUid : "";
      const toUid = typeof data.toUid === "string" ? data.toUid : "";
      const readBy = Array.isArray(data.readBy) ? data.readBy : [];
      const isUnread = fromUid && fromUid !== myUid && toUid === myUid && !readBy.includes(myUid);
      if (!isUnread) return;
      byUser[fromUid] = (byUser[fromUid] || 0) + 1;
    });

    const total = Object.values(byUser).reduce((sum, count) => sum + count, 0);
    callback({ total, byUser });
  });
}

/**
 * メッセージを削除（Storage のファイルも削除）
 */
export async function deleteChatMessageFromFirestore(
  messageId: string,
  options?: {
    storagePath?: string;
    mode?: "soft" | "hard";
  }
): Promise<void> {
  const mode = options?.mode || "soft";
  if (mode === "soft") {
    await updateDoc(doc(db, CHAT_COLLECTION, messageId), {
      isDeleted: true,
      content: "",
      fileName: "",
      storagePath: "",
      editedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(doc(db, CHAT_COLLECTION, messageId));
  }

  if (options?.storagePath) {
    try {
      await deleteObject(ref(storage, options.storagePath));
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

export async function fetchRecentChatPartnerUids(myUid: string, take = 20): Promise<string[]> {
  if (!myUid) return [];
  const safeTake = Math.max(5, Math.min(80, Math.floor(take)));

  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, CHAT_COLLECTION),
        where("fromUid", "==", myUid),
        orderBy("createdAt", "desc"),
        limit(safeTake)
      )
    ),
    getDocs(
      query(
        collection(db, CHAT_COLLECTION),
        where("toUid", "==", myUid),
        orderBy("createdAt", "desc"),
        limit(safeTake)
      )
    ),
  ]);

  const latestByUid = new Map<string, number>();

  const collect = (docs: typeof sentSnap.docs, pickUid: (data: Record<string, unknown>) => string) => {
    docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const counterpartUid = pickUid(data);
      if (!counterpartUid || counterpartUid === myUid) return;

      const createdAtMs =
        typeof data.createdAtMs === "number"
          ? data.createdAtMs
          : data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().getTime()
          : Date.now();

      const previous = latestByUid.get(counterpartUid) || 0;
      if (createdAtMs > previous) {
        latestByUid.set(counterpartUid, createdAtMs);
      }
    });
  };

  collect(sentSnap.docs, (data) => String(data.toUid || ""));
  collect(receivedSnap.docs, (data) => String(data.fromUid || ""));

  return Array.from(latestByUid.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, safeTake)
    .map(([uid]) => uid);
}

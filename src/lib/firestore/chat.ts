import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
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

function getConversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
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
    where("conversationId", "==", conversationId)
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
        readBy: Array.isArray(data.readBy) ? data.readBy : [],
        readAt:
          data.readAt instanceof Timestamp
            ? data.readAt.toDate().toISOString()
            : data.readAt,
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
  text: string
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, CHAT_COLLECTION), {
    conversationId: getConversationId(fromUid, toUid),
    fromUid,
    toUid,
    type: "text",
    content: text,
    readBy: [fromUid],
    createdAtMs: now,
    createdAt: serverTimestamp(),
  });
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
  const path = `chat/${fromUid}_${toUid}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await Promise.race([
    uploadBytes(storageRef, file),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 30000);
    }),
  ]);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, CHAT_COLLECTION), {
    conversationId: getConversationId(fromUid, toUid),
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
}

export async function markChatMessagesAsRead(
  myUid: string,
  friendUid: string
): Promise<void> {
  const conversationId = getConversationId(myUid, friendUid);
  const q = query(
    collection(db, CHAT_COLLECTION),
    where("conversationId", "==", conversationId)
  );
  const snapshot = await getDocs(q);
  const unread = snapshot.docs.filter((d) => {
    const data = d.data();
    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    return data.fromUid === friendUid && data.toUid === myUid && !readBy.includes(myUid);
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

/**
 * メッセージを削除（Storage のファイルも削除）
 */
export async function deleteChatMessageFromFirestore(
  messageId: string,
  storagePath?: string
): Promise<void> {
  await deleteDoc(doc(db, CHAT_COLLECTION, messageId));
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

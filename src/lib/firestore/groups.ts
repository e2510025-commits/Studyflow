import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const GROUPS_COLLECTION = "groupChats";
const GROUP_MESSAGES_COLLECTION = "groupMessages";
const GROUP_BUNDLES_COLLECTION = "groupTaskBundles";
const GROUP_TASKS_COLLECTION = "groupTasks";
const GROUP_PROGRESS_COLLECTION = "groupTaskProgress";

export interface GroupChat {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromUid: string;
  content: string;
  createdAt: string;
}

export interface GroupTaskBundle {
  id: string;
  groupId: string;
  title: string;
  description: string;
  isPinned: boolean;
  createdBy: string;
  createdAt: string;
}

export interface GroupTask {
  id: string;
  groupId: string;
  bundleId: string;
  title: string;
  details: string;
  totalPages: number | null;
  createdBy: string;
  createdAt: string;
}

export interface GroupTaskProgress {
  id: string;
  groupId: string;
  bundleId: string;
  taskId: string;
  userUid: string;
  completed: boolean;
  completedPages: number;
  updatedAt: string;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeMyGroups(userUid: string, callback: (groups: GroupChat[]) => void) {
  const q = query(
    collection(db, GROUPS_COLLECTION),
    where("memberUids", "array-contains", userUid)
  );

  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        ownerUid: data.ownerUid,
        memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
        createdAt: toIso(data.createdAt),
      } satisfies GroupChat;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(groups);
  }, () => {
    callback([]);
  });
}

export async function createGroupChat(params: {
  ownerUid: string;
  name: string;
  memberUids: string[];
}) {
  const deduped = Array.from(new Set([params.ownerUid, ...params.memberUids]));
  await addDoc(collection(db, GROUPS_COLLECTION), {
    ownerUid: params.ownerUid,
    name: params.name.trim(),
    memberUids: deduped,
    createdAt: serverTimestamp(),
  });
}

export function subscribeGroupMessages(groupId: string, callback: (messages: GroupMessage[]) => void) {
  const q = query(
    collection(db, GROUP_MESSAGES_COLLECTION),
    where("groupId", "==", groupId)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId,
        fromUid: data.fromUid,
        content: data.content,
        createdAt: toIso(data.createdAt),
      } satisfies GroupMessage;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    callback(messages);
  }, () => {
    callback([]);
  });
}

export async function sendGroupTextMessage(groupId: string, fromUid: string, content: string) {
  await addDoc(collection(db, GROUP_MESSAGES_COLLECTION), {
    groupId,
    fromUid,
    content,
    createdAt: serverTimestamp(),
  });
}

export function subscribeGroupTaskBundles(
  groupId: string,
  callback: (bundles: GroupTaskBundle[]) => void
) {
  const q = query(
    collection(db, GROUP_BUNDLES_COLLECTION),
    where("groupId", "==", groupId)
  );

  return onSnapshot(q, (snapshot) => {
    const bundles = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId,
        title: data.title,
        description: data.description || "",
        isPinned: Boolean(data.isPinned),
        createdBy: data.createdBy,
        createdAt: toIso(data.createdAt),
      } satisfies GroupTaskBundle;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    callback(bundles);
  }, () => {
    callback([]);
  });
}

export async function createGroupTaskBundle(params: {
  groupId: string;
  title: string;
  description: string;
  isPinned: boolean;
  createdBy: string;
}) {
  await addDoc(collection(db, GROUP_BUNDLES_COLLECTION), {
    groupId: params.groupId,
    title: params.title.trim(),
    description: params.description.trim(),
    isPinned: params.isPinned,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
  });
}

export async function setGroupTaskBundlePinned(bundleId: string, isPinned: boolean) {
  await setDoc(
    doc(db, GROUP_BUNDLES_COLLECTION, bundleId),
    {
      isPinned,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteGroupTaskBundle(bundleId: string) {
  await deleteDoc(doc(db, GROUP_BUNDLES_COLLECTION, bundleId));
}

export function subscribeGroupTasks(groupId: string, callback: (tasks: GroupTask[]) => void) {
  const q = query(
    collection(db, GROUP_TASKS_COLLECTION),
    where("groupId", "==", groupId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId,
        bundleId: data.bundleId,
        title: data.title,
        details: data.details || "",
        totalPages: typeof data.totalPages === "number" ? data.totalPages : null,
        createdBy: data.createdBy,
        createdAt: toIso(data.createdAt),
      } satisfies GroupTask;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    callback(tasks);
  }, () => {
    callback([]);
  });
}

export async function createGroupTask(params: {
  groupId: string;
  bundleId: string;
  title: string;
  details: string;
  totalPages?: number | null;
  createdBy: string;
}) {
  await addDoc(collection(db, GROUP_TASKS_COLLECTION), {
    groupId: params.groupId,
    bundleId: params.bundleId,
    title: params.title.trim(),
    details: params.details.trim(),
    totalPages:
      typeof params.totalPages === "number" && params.totalPages > 0
        ? params.totalPages
        : null,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
  });
}

export function subscribeGroupTaskProgress(
  groupId: string,
  callback: (progressItems: GroupTaskProgress[]) => void
) {
  const q = query(
    collection(db, GROUP_PROGRESS_COLLECTION),
    where("groupId", "==", groupId)
  );

  return onSnapshot(q, (snapshot) => {
    const progressItems = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId,
        bundleId: data.bundleId,
        taskId: data.taskId,
        userUid: data.userUid,
        completed: Boolean(data.completed),
        completedPages: typeof data.completedPages === "number" ? data.completedPages : 0,
        updatedAt: toIso(data.updatedAt),
      } satisfies GroupTaskProgress;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    callback(progressItems);
  }, () => {
    callback([]);
  });
}

export async function upsertGroupTaskProgress(params: {
  groupId: string;
  bundleId: string;
  taskId: string;
  userUid: string;
  completed: boolean;
  completedPages: number;
}) {
  const docId = `${params.taskId}_${params.userUid}`;
  await setDoc(
    doc(db, GROUP_PROGRESS_COLLECTION, docId),
    {
      groupId: params.groupId,
      bundleId: params.bundleId,
      taskId: params.taskId,
      userUid: params.userUid,
      completed: params.completed,
      completedPages: Math.max(0, params.completedPages),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

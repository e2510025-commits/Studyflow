import { NextResponse } from "next/server";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/firebase";
import { resolveSessionUser } from "@/lib/server/sessionUser";

type DeletePlan = {
  collectionName: string;
  field: string;
  operator?: "==" | "array-contains";
  value: string;
};

async function collectRefs(plan: DeletePlan) {
  const q = query(
    collection(db, plan.collectionName),
    where(plan.field, plan.operator || "==", plan.value)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.ref);
}

async function deleteRefs(refs: Array<DocumentReference>) {
  for (const ref of refs) {
    await deleteDoc(ref);
  }
}

export async function POST() {
  const sessionUser = await resolveSessionUser();
  const session = await auth();
  if (!sessionUser?.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uid = sessionUser.uid;
  const email = sessionUser.email || "";
  const rawSessionId = String(session?.user?.id || "");

  const refsToDelete: Array<DocumentReference> = [];
  const visitedPath = new Set<string>();
  const addRefs = (refs: Array<DocumentReference>) => {
    refs.forEach((ref) => {
      if (visitedPath.has(ref.path)) return;
      visitedPath.add(ref.path);
      refsToDelete.push(ref);
    });
  };

  const commonPlans: DeletePlan[] = [
    { collectionName: "studyLogs", field: "userUid", value: uid },
    { collectionName: "userSubjects", field: "ownerUid", value: uid },
    { collectionName: "friends", field: "ownerUid", value: uid },
    { collectionName: "friends", field: "uid", value: uid },
    { collectionName: "friendRequests", field: "fromUid", value: uid },
    { collectionName: "friendRequests", field: "toUid", value: uid },
    { collectionName: "follows", field: "ownerUid", value: uid },
    { collectionName: "follows", field: "targetUid", value: uid },
    { collectionName: "profileCheers", field: "fromUid", value: uid },
    { collectionName: "profileCheers", field: "targetUid", value: uid },
    { collectionName: "notifications", field: "toUid", value: uid },
    { collectionName: "chatMessages", field: "fromUid", value: uid },
    { collectionName: "chatMessages", field: "toUid", value: uid },
    { collectionName: "groupMessages", field: "fromUid", value: uid },
    { collectionName: "groupTaskBundles", field: "createdBy", value: uid },
    { collectionName: "groupTasks", field: "createdBy", value: uid },
    { collectionName: "groupTaskProgress", field: "userUid", value: uid },
    { collectionName: "userTodos", field: "ownerUid", value: uid },
    { collectionName: "rivals", field: "ownerUid", value: uid },
    { collectionName: "rivals", field: "rivalUid", value: uid },
    { collectionName: "pomodoroPresets", field: "ownerUid", value: uid },
    { collectionName: "globalStreamMessages", field: "uid", value: uid },
    { collectionName: "globalStreamRespects", field: "uid", value: uid },
    { collectionName: "timelinePosts", field: "uid", value: uid },
    { collectionName: "timelinePosts", field: "userId", value: uid },
    { collectionName: "timelinePostRespects", field: "uid", value: uid },
    { collectionName: "timelinePostLikes", field: "uid", value: uid },
    { collectionName: "bulletinPosts", field: "uid", value: uid },
    { collectionName: "bulletinHelpfuls", field: "uid", value: uid },
    { collectionName: "bulletinThreadMessages", field: "uid", value: uid },
    { collectionName: "missionClaims", field: "uid", value: uid },
    { collectionName: "missionRewards", field: "uid", value: uid },
    { collectionName: "groupChats", field: "ownerUid", value: uid },
  ];

  for (const plan of commonPlans) {
    const refs = await collectRefs(plan).catch(() => []);
    addRefs(refs);
  }

  const ownedGroupRefs = await collectRefs({ collectionName: "groupChats", field: "ownerUid", value: uid }).catch(() => []);
  addRefs(ownedGroupRefs);

  const memberGroupRefs = await collectRefs({
    collectionName: "groupChats",
    field: "memberUids",
    operator: "array-contains",
    value: uid,
  }).catch(() => []);

  for (const ref of memberGroupRefs) {
    if (visitedPath.has(ref.path)) continue;
    await updateDoc(ref, {
      memberUids: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }

  const supportThreadRefs = await collectRefs({ collectionName: "supportThreads", field: "uid", value: uid }).catch(() => []);
  addRefs(supportThreadRefs);

  const threadRef = doc(db, "supportThreads", uid);
  if (!visitedPath.has(threadRef.path)) {
    addRefs([threadRef]);
  }

  const supportRefs = refsToDelete.filter((ref) => ref.parent.path === "supportThreads");
  for (const ref of supportRefs) {
    const messages = await getDocs(collection(ref, "messages")).catch(() => null);
    if (!messages) continue;
    addRefs(messages.docs.map((d) => d.ref));
  }

  const groupIdSet = new Set<string>();
  refsToDelete.forEach((ref) => {
    if (ref.parent.path !== "groupChats") return;
    groupIdSet.add(ref.id);
  });

  for (const groupId of groupIdSet) {
    const [messages, bundles, tasks, progress] = await Promise.all([
      getDocs(query(collection(db, "groupMessages"), where("groupId", "==", groupId))).catch(() => null),
      getDocs(query(collection(db, "groupTaskBundles"), where("groupId", "==", groupId))).catch(() => null),
      getDocs(query(collection(db, "groupTasks"), where("groupId", "==", groupId))).catch(() => null),
      getDocs(query(collection(db, "groupTaskProgress"), where("groupId", "==", groupId))).catch(() => null),
    ]);

    if (messages) addRefs(messages.docs.map((d) => d.ref));
    if (bundles) addRefs(bundles.docs.map((d) => d.ref));
    if (tasks) addRefs(tasks.docs.map((d) => d.ref));
    if (progress) addRefs(progress.docs.map((d) => d.ref));
  }

  if (email) {
    const usersByEmail = await getDocs(query(collection(db, "users"), where("email", "==", email))).catch(() => null);
    if (usersByEmail) addRefs(usersByEmail.docs.map((d) => d.ref));

    const verifyRef = doc(db, "emailVerificationCodes", email);
    addRefs([verifyRef]);
  }

  if (rawSessionId) {
    addRefs([doc(db, "users", rawSessionId)]);
  }

  addRefs([
    doc(db, "users", uid),
    doc(db, "userProfiles", uid),
    doc(db, "userPresence", uid),
    doc(db, "activeStudySessions", uid),
    doc(db, "userModeration", uid),
  ]);

  await deleteRefs(refsToDelete);

  return NextResponse.json({ ok: true, deletedCount: refsToDelete.length });
}

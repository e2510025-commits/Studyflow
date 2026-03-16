import { collection, getDoc, getDocs, query, setDoc, where, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StudyLog } from "@/types";
import { evaluateAchievements } from "@/lib/achievements";

export async function recomputeAndSaveAchievements(userUid: string): Promise<string[]> {
  if (!userUid) return [];

  const snap = await getDocs(
    query(collection(db, "studyLogs"), where("userUid", "==", userUid))
  );

  const logs: StudyLog[] = snap.docs.map((row) => {
    const data = row.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString();
    return {
      id: row.id,
      subjectId: String(data.subjectId || ""),
      duration: Number(data.duration || 0),
      memo: String(data.memo || ""),
      focusRating: typeof data.focusRating === "number" ? data.focusRating : undefined,
      focusBonus: Boolean(data.focusBonus),
      points: typeof data.points === "number" ? data.points : undefined,
      createdAt,
    };
  });

  const badges = evaluateAchievements(logs);
  const profileRef = doc(db, "userProfiles", userUid);
  const profileSnap = await getDoc(profileRef);
  const existingMap = profileSnap.exists()
    ? ((profileSnap.data().achievementUnlockedAt || {}) as Record<string, string>)
    : {};
  const equippedBadges = profileSnap.exists()
    ? ((profileSnap.data().equippedBadges || []) as string[])
    : [];

  const nextUnlockMap: Record<string, string> = { ...existingMap };
  const nowIso = new Date().toISOString();
  badges.forEach((id) => {
    if (!nextUnlockMap[id]) {
      nextUnlockMap[id] = nowIso;
    }
  });

  const safeEquipped = equippedBadges.filter((id) => badges.includes(id)).slice(0, 3);

  await setDoc(
    profileRef,
    {
      badges,
      achievementUnlockedAt: nextUnlockMap,
      equippedBadges: safeEquipped,
      achievementUpdatedAt: new Date(),
    },
    { merge: true }
  );

  return badges;
}

import { sanitizeAvatar, sanitizeDisplayName } from "./identity";
import type { ProfileVisibility } from "@/types";

export type DisplayProfileUpdate = {
  uid: string;
  name: string;
  avatar: string;
  bio?: string;
  visibility?: ProfileVisibility;
  dailyGoal?: number;
  totalPoints?: number;
  bonusPoints?: number;
  profileSetupDone?: boolean;
  equippedBadges?: string[];
  statusMessage?: string;
  headerImage?: string;
  deviceLabel?: string;
  showFollowCount?: boolean;
  showFollowerCount?: boolean;
  showFriendCount?: boolean;
  helpfulReceived?: number;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  agreementsAcceptedAt?: string;
};

/** Undefined optional fields are omitted so background sync preserves saved settings. */
export function buildDisplayProfileUpdate(params: DisplayProfileUpdate): Record<string, unknown> & { uid: string; name: string; avatar: string } {
  const safeName = sanitizeDisplayName(params.name);
  const safeAvatar = sanitizeAvatar(params.avatar);
  
  const payload: Record<string, unknown> & { uid: string; name: string; avatar: string } = {
    uid: params.uid,
    name: safeName,
    avatar: safeAvatar,
  };
  if (typeof params.bio === "string") payload.bio = params.bio.trim().slice(0, 280);
  if (typeof params.statusMessage === "string") payload.statusMessage = params.statusMessage.trim().slice(0, 120);
  if (params.visibility !== undefined) payload.visibility = params.visibility;
  for (const key of ["dailyGoal", "totalPoints", "bonusPoints"] as const) {
    if (typeof params[key] === "number") payload[key] = params[key];
  }
  if (typeof params.profileSetupDone === "boolean") {
    payload.profileSetupDone = params.profileSetupDone;
  }
  if (Array.isArray(params.equippedBadges)) {
    payload.equippedBadges = params.equippedBadges.slice(0, 3);
  }
  if (typeof params.headerImage === "string") {
    const safeHeader = params.headerImage.slice(0, 2_000_000);
    payload.headerImage = safeHeader;
    payload.headerImageUrl = safeHeader;
  }
  if (typeof params.deviceLabel === "string") {
    payload.deviceLabel = params.deviceLabel.trim().slice(0, 40);
  }
  if (typeof params.showFollowCount === "boolean") {
    payload.showFollowCount = params.showFollowCount;
  }
  if (typeof params.showFollowerCount === "boolean") {
    payload.showFollowerCount = params.showFollowerCount;
  }
  if (typeof params.showFriendCount === "boolean") {
    payload.showFriendCount = params.showFriendCount;
  }
  if (typeof params.helpfulReceived === "number") {
    payload.helpfulReceived = Math.max(0, Math.floor(params.helpfulReceived));
  }
  if (typeof params.termsAccepted === "boolean") {
    payload.termsAccepted = params.termsAccepted;
  }
  if (typeof params.privacyAccepted === "boolean") {
    payload.privacyAccepted = params.privacyAccepted;
  }
  if (typeof params.agreementsAcceptedAt === "string") {
    payload.agreementsAcceptedAt = params.agreementsAcceptedAt;
  }

  return payload;
}

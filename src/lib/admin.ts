import { toAppUid } from "@/lib/identity";

export const FIXED_ADMIN_UID = "3119982912";

export function getConfiguredAdminUids(): string[] {
  return [FIXED_ADMIN_UID];
}

export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  const appUid = toAppUid(uid);
  return appUid === FIXED_ADMIN_UID;
}

import { toAppUid } from "@/lib/identity";

function parseAdminUids(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => toAppUid(v));
}

export function getConfiguredAdminUids(): string[] {
  const privateList = parseAdminUids(process.env.ADMIN_UIDS);
  const publicList = parseAdminUids(process.env.NEXT_PUBLIC_ADMIN_UIDS);
  return Array.from(new Set([...privateList, ...publicList]));
}

export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  const appUid = toAppUid(uid);
  return getConfiguredAdminUids().includes(appUid);
}

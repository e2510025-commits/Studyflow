export function toAppUid(rawId: string): string {
  if (/^\d{10}$/.test(rawId)) return rawId;

  const MOD = 10000000000;
  let hash = 0;
  for (const ch of rawId) {
    hash = (hash * 131 + ch.charCodeAt(0)) % MOD;
  }

  const uid = hash.toString().padStart(10, "0");
  return uid === "0000000000" ? "1000000000" : uid;
}

export function sanitizeDisplayName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "匿名";

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("data:")) {
    return "匿名";
  }

  if (/^[a-z0-9_\-=]{24,}$/i.test(trimmed)) {
    return "匿名";
  }

  return trimmed;
}

export function sanitizeAvatar(avatar: string | null | undefined): string {
  const value = (avatar || "").trim();
  if (!value) return "👤";

  const lower = value.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("data:")) {
    return value;
  }

  if (value.length <= 4) return value;
  return "👤";
}

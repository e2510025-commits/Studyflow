import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const USER_PRESENCE_COLLECTION = "userPresence";
const ONLINE_ALIVE_THRESHOLD_MS = 1000 * 60 * 2;

interface PresenceSession {
  isOnline: boolean;
  agentLabel: string;
  updatedAtMs: number;
}

type PresenceSessions = Record<string, PresenceSession>;

function readSessions(data?: Record<string, unknown>): PresenceSessions {
  const raw = data?.sessions;
  if (!raw || typeof raw !== "object") return {};
  const rows = raw as Record<string, unknown>;
  const sessions: PresenceSessions = {};
  Object.entries(rows).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    sessions[key] = {
      isOnline: Boolean(row.isOnline),
      agentLabel: typeof row.agentLabel === "string" ? row.agentLabel : "Unknown",
      updatedAtMs: Math.max(0, Number(row.updatedAtMs || 0)),
    };
  });
  return sessions;
}

function sessionAlive(session: PresenceSession, now: number): boolean {
  return session.updatedAtMs > 0 && now - session.updatedAtMs <= ONLINE_ALIVE_THRESHOLD_MS;
}

function hasAnyOnlineSession(data?: Record<string, unknown>): boolean {
  const now = Date.now();
  const sessions = Object.values(readSessions(data));
  if (sessions.length > 0) {
    return sessions.some((session) => session.isOnline && sessionAlive(session, now));
  }

  const updatedAt = data?.updatedAt;
  const updatedAtMs = updatedAt instanceof Timestamp ? updatedAt.toDate().getTime() : 0;
  const alive = updatedAtMs > 0 && now - updatedAtMs <= ONLINE_ALIVE_THRESHOLD_MS;
  return Boolean(data?.isOnline) && alive;
}

export interface PresenceAgentInfo {
  sessionId: string;
  label: string;
  isOnline: boolean;
  updatedAtMs: number;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

export async function updateUserPresence(
  userUid: string,
  isOnline: boolean,
  options?: { sessionId?: string; agentLabel?: string }
) {
  if (!userUid) return;
  const ref = doc(db, USER_PRESENCE_COLLECTION, userUid);
  const sessionId = options?.sessionId || "default";
  const nowMs = Date.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prevData = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
    const sessions = readSessions(prevData);

    sessions[sessionId] = {
      isOnline,
      agentLabel: options?.agentLabel || sessions[sessionId]?.agentLabel || "Unknown",
      updatedAtMs: nowMs,
    };

    const anyOnline = Object.values(sessions).some(
      (session) => session.isOnline && sessionAlive(session, nowMs)
    );

    tx.set(
      ref,
      {
        userUid,
        isOnline: anyOnline,
        updatedAt: serverTimestamp(),
        sessions,
      },
      { merge: true }
    );
  });
}

export function subscribeUserPresenceStatus(
  userUid: string,
  callback: (state: { isOnline: boolean; updatedAtMs: number }) => void
) {
  if (!userUid) {
    callback({ isOnline: false, updatedAtMs: 0 });
    return () => {};
  }

  const ref = doc(db, USER_PRESENCE_COLLECTION, userUid);
  const emitFromData = (data?: Record<string, unknown>) => {
    const updatedAt = data?.updatedAt;
    const updatedAtMs =
      updatedAt instanceof Timestamp ? updatedAt.toDate().getTime() : 0;
    callback({
      isOnline: hasAnyOnlineSession(data),
      updatedAtMs,
    });
  };

  void getDoc(ref)
    .then((snap) => emitFromData((snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)))
    .catch(() => callback({ isOnline: false, updatedAtMs: 0 }));

  return onSnapshot(
    ref,
    (snapshot) => {
      emitFromData(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined);
    },
    () => callback({ isOnline: false, updatedAtMs: 0 })
  );
}

export function subscribeUserPresenceAgents(
  userUid: string,
  callback: (agents: PresenceAgentInfo[]) => void
) {
  if (!userUid) {
    callback([]);
    return () => {};
  }

  const ref = doc(db, USER_PRESENCE_COLLECTION, userUid);
  const emit = (data?: Record<string, unknown>) => {
    const now = Date.now();
    const sessions = readSessions(data);
    const agents = Object.entries(sessions)
      .filter(([, row]) => row.updatedAtMs > 0 && now - row.updatedAtMs <= 1000 * 60 * 60 * 24)
      .map(([sessionId, row]) => ({
        sessionId,
        label: row.agentLabel,
        isOnline: row.isOnline && sessionAlive(row, now),
        updatedAtMs: row.updatedAtMs,
      }))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    callback(agents);
  };

  void getDoc(ref)
    .then((snap) => emit(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined))
    .catch(() => callback([]));

  return onSnapshot(
    ref,
    (snapshot) => {
      emit(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined);
    },
    () => callback([])
  );
}

export function subscribeUsersOnlineStatus(
  userUids: string[],
  callback: (onlineUidSet: Set<string>) => void
) {
  const unique = Array.from(new Set(userUids.filter(Boolean)));
  if (unique.length === 0) {
    callback(new Set());
    return () => {};
  }

  const unsubscribers: Array<() => void> = [];
  const stateMap = new Map<string, Set<string>>();

  const emit = () => {
    const merged = new Set<string>();
    for (const set of stateMap.values()) {
      set.forEach((uid) => merged.add(uid));
    }
    callback(merged);
  };

  chunk(unique, 10).forEach((uids, index) => {
    const chunkKey = `chunk_${index}`;
    stateMap.set(chunkKey, new Set());
    const q = query(
      collection(db, USER_PRESENCE_COLLECTION),
      where("userUid", "in", uids)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const online = new Set<string>();
        snapshot.docs.forEach((row) => {
          const data = row.data();
          if (hasAnyOnlineSession(data) && data.userUid) {
            online.add(String(data.userUid));
          }
        });
        stateMap.set(chunkKey, online);
        emit();
      },
      () => {
        stateMap.set(chunkKey, new Set());
        emit();
      }
    );

    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

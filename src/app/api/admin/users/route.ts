import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase-server";
import { requireAdmin } from "@/lib/server/adminGuard";
import { sanitizeAvatar, sanitizeDisplayName, toAppUid } from "@/lib/identity";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const profilesSnap = await getDocs(query(collection(db, "userProfiles"), limit(500)));

  const rows = await Promise.all(
    profilesSnap.docs.map(async (d) => {
      const profile = d.data();
      const moderationSnap = await getDoc(doc(db, "userModeration", d.id));
      const mod = moderationSnap.exists() ? moderationSnap.data() : {};
      return {
        uid: d.id,
        name: sanitizeDisplayName(profile.name),
        avatar: sanitizeAvatar(profile.avatar || "👤"),
        isOfficial: Boolean(profile.isOfficial),
        bio: profile.bio || "",
        banned: Boolean(mod.banned),
        suspendedUntil: mod.suspendedUntil || "",
        warnings: Array.isArray(mod.warnings) ? mod.warnings : [],
      };
    })
  );

  const filtered = rows
    .filter((r) => {
      if (!q) return true;
      return r.uid.includes(q) || r.name.toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return NextResponse.json(
    { users: filtered },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    }
  );
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as {
    action: "warn" | "ban" | "unban" | "suspend" | "unsuspend" | "official" | "unofficial" | "dm";
    targetUid: string;
    message?: string;
    reason?: string;
    days?: number;
  };

  const targetUidRaw = String(body.targetUid || "").trim();
  if (!targetUidRaw || !body.action) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const targetUid = toAppUid(targetUidRaw);

  const moderationRef = doc(db, "userModeration", targetUid);
  const reasonText = (body.reason || body.message || "").trim();

  if (body.action === "warn") {
    if (!reasonText) {
      return NextResponse.json({ error: "警告理由を入力してください" }, { status: 400 });
    }
    const snap = await getDoc(moderationRef);
    const current = snap.exists() ? snap.data() : {};
    const warnings = Array.isArray(current.warnings) ? current.warnings : [];
    const entry = {
      message: reasonText,
      at: new Date().toISOString(),
      by: guard.appUid,
    };

    await setDoc(
      moderationRef,
      { warnings: [...warnings, entry], updatedAt: serverTimestamp() },
      { merge: true }
    );

    await addDoc(collection(db, "notifications"), {
      toUid: targetUid,
      type: "warning",
      title: "運営からの警告",
      body: entry.message,
      read: false,
      link: "/announcements",
      createdAt: serverTimestamp(),
    });
  }

  if (body.action === "ban" || body.action === "unban") {
    const banned = body.action === "ban";
    if (banned && !reasonText) {
      return NextResponse.json({ error: "BAN理由を入力してください" }, { status: 400 });
    }
    await setDoc(
      moderationRef,
      {
        banned,
        bannedReason: banned ? reasonText : "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await addDoc(collection(db, "notifications"), {
      toUid: targetUid,
      type: "ban",
      title: banned ? "利用停止のお知らせ" : "利用停止解除のお知らせ",
      body: banned
        ? `アカウントが利用停止されました。理由: ${reasonText}`
        : "アカウントの利用停止が解除されました。",
      read: false,
      link: "/announcements",
      createdAt: serverTimestamp(),
    });
  }

  if (body.action === "suspend") {
    if (!reasonText) {
      return NextResponse.json({ error: "停止理由を入力してください" }, { status: 400 });
    }
    const days = Math.max(1, Number(body.days || 1));
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await setDoc(
      moderationRef,
      {
        suspendedUntil: until,
        suspendReason: reasonText,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await addDoc(collection(db, "notifications"), {
      toUid: targetUid,
      type: "suspend",
      title: "一時利用停止のお知らせ",
      body: `${days}日間の一時利用停止となりました。理由: ${reasonText}`,
      read: false,
      link: "/announcements",
      createdAt: serverTimestamp(),
    });
  }

  if (body.action === "unsuspend") {
    await setDoc(moderationRef, { suspendedUntil: "", updatedAt: serverTimestamp() }, { merge: true });
  }

  if (body.action === "official" || body.action === "unofficial") {
    await setDoc(
      doc(db, "userProfiles", targetUid),
      { isOfficial: body.action === "official", updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  if (body.action === "dm") {
    const text = (body.message || "").trim();
    if (!text) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    await addDoc(collection(db, "chatMessages"), {
      conversationId: [guard.appUid, targetUid].sort().join("__"),
      fromUid: guard.appUid,
      toUid: targetUid,
      type: "text",
      content: text,
      readBy: [guard.appUid],
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}

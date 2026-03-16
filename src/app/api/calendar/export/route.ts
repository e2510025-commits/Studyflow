import { NextResponse } from "next/server";
import { collection, getDocs, query, where, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveSessionUser } from "@/lib/server/sessionUser";

function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

export async function GET() {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const from = new Date();
  from.setMonth(from.getMonth() - 3);

  const logsSnap = await getDocs(
    query(
      collection(db, "studyLogs"),
      where("userUid", "==", user.uid),
      where("createdAt", ">=", Timestamp.fromDate(from)),
      orderBy("createdAt", "desc"),
      limit(300)
    )
  );

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//Study Calendar//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  logsSnap.docs.forEach((row) => {
    const data = row.data();
    const createdAtDate = data.createdAt?.toDate?.() as Date | undefined;
    if (!createdAtDate) return;

    const duration = Number(data.duration || 0);
    const endAt = new Date(createdAtDate.getTime() + duration * 1000);
    const memo = String(data.memo || "").replace(/\n/g, "\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${row.id}@studyflow.local`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${formatIcsDate(createdAtDate)}`);
    lines.push(`DTEND:${formatIcsDate(endAt)}`);
    lines.push(`SUMMARY:Study Session (${Math.round(duration / 60)}m)`);
    lines.push(`DESCRIPTION:${memo || "StudyFlow session"}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="studyflow-${new Date().toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

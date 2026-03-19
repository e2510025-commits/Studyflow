import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongo/client";
import { TimelinePostModel } from "@/lib/mongo/models";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectMongo();
    const { searchParams } = new URL(request.url);

    const uid = String(searchParams.get("uid") || "").trim();
    const limit = Math.min(120, Math.max(1, Number(searchParams.get("limit") || 40)));

    const filter = uid ? { uid } : {};

    const posts = await TimelinePostModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("mongo timeline GET error:", error);
    return NextResponse.json({ error: "failed_to_fetch_timeline" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectMongo();

    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      uid?: string;
      name?: string;
      avatar?: string;
      body?: string;
      imageUrl?: string;
    };

    const uid = String(body.uid || "").trim();
    const text = String(body.body || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    if (!uid || (!text && !imageUrl)) {
      return NextResponse.json({ error: "uid_and_body_or_image_required" }, { status: 400 });
    }

    const id = String(body.id || crypto.randomUUID());

    const created = await TimelinePostModel.findByIdAndUpdate(
      id,
      {
        _id: id,
        uid,
        userId: uid,
        name: String(body.name || "").trim() || "Anonymous",
        avatar: String(body.avatar || "").trim() || "🙂",
        body: text,
        imageUrl,
        messageType: imageUrl ? "image" : "text",
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ ok: true, post: created });
  } catch (error) {
    console.error("mongo timeline POST error:", error);
    return NextResponse.json({ error: "failed_to_create_timeline_post" }, { status: 500 });
  }
}

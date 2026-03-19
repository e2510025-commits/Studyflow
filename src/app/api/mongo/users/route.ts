import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongo/client";
import { UserModel } from "@/lib/mongo/models";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectMongo();

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));

    const filter = q
      ? {
          $or: [
            { email: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { _id: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const users = await UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("mongo users GET error:", error);
    return NextResponse.json({ error: "failed_to_fetch_users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const body = (await request.json().catch(() => ({}))) as {
      uid?: string;
      email?: string;
      name?: string;
      image?: string;
    };

    const uid = String(body.uid || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!uid || !email) {
      return NextResponse.json({ error: "uid_and_email_required" }, { status: 400 });
    }

    const doc = await UserModel.findByIdAndUpdate(
      uid,
      {
        _id: uid,
        email,
        name: String(body.name || "").trim(),
        image: String(body.image || "").trim(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ ok: true, user: doc });
  } catch (error) {
    console.error("mongo users POST error:", error);
    return NextResponse.json({ error: "failed_to_upsert_user" }, { status: 500 });
  }
}

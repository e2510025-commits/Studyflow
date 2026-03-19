import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongo/client";
import { UserModel } from "@/lib/mongo/models";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    await connectMongo();
    const { uid } = await context.params;
    const user = await UserModel.findById(uid).lean();
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("mongo user GET error:", error);
    return NextResponse.json({ error: "failed_to_fetch_user" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    await connectMongo();
    const { uid } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (typeof body.image === "string") updates.image = body.image.trim();
    if (typeof body.password === "string") updates.password = body.password;
    if (typeof body.emailVerified === "boolean") updates.emailVerified = body.emailVerified;

    const user = await UserModel.findByIdAndUpdate(uid, { $set: updates }, { new: true }).lean();
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("mongo user PATCH error:", error);
    return NextResponse.json({ error: "failed_to_update_user" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    await connectMongo();
    const { uid } = await context.params;

    const deleted = await UserModel.findByIdAndDelete(uid).lean();
    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mongo user DELETE error:", error);
    return NextResponse.json({ error: "failed_to_delete_user" }, { status: 500 });
  }
}

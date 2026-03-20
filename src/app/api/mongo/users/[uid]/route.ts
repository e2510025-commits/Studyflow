import { NextResponse } from "next/server";

export const runtime = "edge";

function notSupported() {
  return NextResponse.json(
    { error: "mongo_routes_not_supported_on_cloudflare_pages" },
    { status: 501 }
  );
}

export async function GET(_: Request, context: { params: Promise<{ uid: string }> }) {
  void context;
  return notSupported();
}

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> }) {
  void request;
  void context;
  return notSupported();
}

export async function DELETE(_: Request, context: { params: Promise<{ uid: string }> }) {
  void context;
  return notSupported();
}

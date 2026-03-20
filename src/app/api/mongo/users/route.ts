import { NextResponse } from "next/server";

function notSupported() {
  return NextResponse.json(
    { error: "mongo_routes_not_supported_on_cloudflare_pages" },
    { status: 501 }
  );
}

export async function GET(request: Request) {
  void request;
  return notSupported();
}

export async function POST(request: Request) {
  void request;
  return notSupported();
}

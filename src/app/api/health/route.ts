import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "smart-document-intelligence",
    platform: "built-smart-ai",
    timestamp: new Date().toISOString()
  });
}

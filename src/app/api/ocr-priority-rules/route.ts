import { NextResponse } from "next/server";
import {
  getLocalOcrPriorityRules,
  saveLocalOcrPriorityRules
} from "@/lib/ocr/local-ocr-priority-rules";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (tryGetServerEnv()) {
    return jsonError("OCR-Prioritätsregeln werden im MVP nur lokal verwaltet.", 501);
  }

  return NextResponse.json({ rules: await getLocalOcrPriorityRules() });
}

export async function POST(request: Request) {
  if (tryGetServerEnv()) {
    return jsonError("OCR-Prioritätsregeln werden im MVP nur lokal verwaltet.", 501);
  }

  const body = (await request.json().catch(() => ({}))) as { rules?: unknown };

  return NextResponse.json({ rules: await saveLocalOcrPriorityRules(body.rules) });
}

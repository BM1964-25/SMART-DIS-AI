import { NextResponse } from "next/server";
import { runLocalOcrForDocument } from "@/lib/ocr/local-ocr-runner";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";
export const maxDuration = 180;

type RouteContext = {
  params: Promise<unknown>;
};

type OcrRunErrorResponse = {
  error: string;
};

type OcrRunRequest = {
  maxPages?: unknown;
  dpi?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<OcrRunErrorResponse>({ error: message }, { status });
}

function numberOption(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request, context: RouteContext) {
  const params = (await context.params) as { documentId?: string };
  const documentId = params.documentId;

  if (!documentId) {
    return jsonError("Document id is required.", 400);
  }

  if (tryGetServerEnv()) {
    return jsonError(
      "OCR-Ausführung ist im lokalen MVP nur ohne Supabase-Konfiguration aktiv.",
      501
    );
  }

  const body = (await request.json().catch(() => ({}))) as OcrRunRequest;

  try {
    const result = await runLocalOcrForDocument(documentId, {
      maxPages: numberOption(body.maxPages),
      dpi: numberOption(body.dpi)
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "OCR konnte nicht ausgeführt werden.",
      502
    );
  }
}

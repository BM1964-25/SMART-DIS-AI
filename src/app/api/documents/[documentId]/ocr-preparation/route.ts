import { NextResponse } from "next/server";
import type { OcrJobRecord } from "@/domain/ocr";
import { prepareLocalOcrJob } from "@/lib/ocr/local-ocr-preparation";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<unknown>;
};

type OcrPreparationResponse = {
  ocrJob: OcrJobRecord;
};

type OcrPreparationErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<OcrPreparationErrorResponse>({ error: message }, { status });
}

export async function POST(_request: Request, context: RouteContext) {
  const params = (await context.params) as { documentId?: string };
  const documentId = params.documentId;

  if (!documentId) {
    return jsonError("Document id is required.", 400);
  }

  if (tryGetServerEnv()) {
    return jsonError(
      "OCR-Vorbereitung für Supabase ist vorbereitet, aber im lokalen MVP noch nicht aktiv.",
      501
    );
  }

  try {
    const ocrJob = await prepareLocalOcrJob(documentId);

    return NextResponse.json<OcrPreparationResponse>({ ocrJob });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "OCR-Vorbereitung konnte nicht erstellt werden.",
      422
    );
  }
}

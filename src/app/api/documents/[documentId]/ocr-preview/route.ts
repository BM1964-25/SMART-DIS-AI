import { NextResponse } from "next/server";
import { renderLocalOcrPreviewPage } from "@/lib/ocr/local-ocr-preview";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<unknown>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request, context: RouteContext) {
  const params = (await context.params) as { documentId?: string };
  const documentId = params.documentId;

  if (!documentId) {
    return jsonError("Document id is required.", 400);
  }

  if (tryGetServerEnv()) {
    return jsonError("OCR-Seitenvorschau ist im MVP nur im lokalen Modus aktiv.", 501);
  }

  const url = new URL(request.url);

  try {
    const imageBuffer = await renderLocalOcrPreviewPage({
      documentId,
      page: numberParam(url.searchParams.get("page"), 1),
      dpi: numberParam(url.searchParams.get("dpi"), 180)
    });

    return new Response(imageBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/png"
      }
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "OCR-Seitenvorschau konnte nicht erzeugt werden.",
      502
    );
  }
}

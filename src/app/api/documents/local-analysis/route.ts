import { NextResponse } from "next/server";
import { analyzeAllLocalDocuments } from "@/lib/analysis/local-document-analysis";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/upload", url.origin);
  const env = tryGetServerEnv();

  if (env) {
    redirectUrl.searchParams.set(
      "analysisError",
      "Lokale Ordneranalyse ist nur ohne Supabase-Konfiguration aktiv."
    );
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await analyzeAllLocalDocuments();
    redirectUrl.searchParams.set("analysisUpdated", String(result.analyzedCount));
    redirectUrl.searchParams.set("analysisRisks", String(result.riskCount));
    redirectUrl.searchParams.set("analysisDeadlines", String(result.deadlineCount));

    if (result.failed.length > 0) {
      redirectUrl.searchParams.set("analysisFailed", String(result.failed.length));
    }
  } catch (error) {
    redirectUrl.searchParams.set(
      "analysisError",
      error instanceof Error ? error.message : "Lokale Analyse konnte nicht abgeschlossen werden."
    );
  }

  return NextResponse.redirect(redirectUrl);
}

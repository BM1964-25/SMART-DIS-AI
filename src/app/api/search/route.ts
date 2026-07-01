import { NextResponse } from "next/server";
import { searchLocalDocumentChunks } from "@/lib/search/local-semantic-search";
import { searchDocumentChunks } from "@/lib/search/semantic-search";
import { tryGetServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SearchRequest = {
  query?: unknown;
};

type SearchResult = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
};

type SearchErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<SearchErrorResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SearchRequest;
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (query.length < 3) {
    return jsonError("Bitte gib mindestens 3 Zeichen ein.", 400);
  }

  if (query.length > 500) {
    return jsonError("Die Suchanfrage ist zu lang.", 400);
  }

  const optionalEnv = tryGetServerEnv();

  if (!optionalEnv) {
    const results = await searchLocalDocumentChunks({
      query,
      matchCount: 8
    }).catch((error) => {
      throw new Error(
        `Lokale Suche fehlgeschlagen: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`
      );
    });

    return NextResponse.json<SearchResponse>({
      query,
      results
    });
  }

  const supabase = createSupabaseAdminClient();
  const results = await searchDocumentChunks({
    query,
    organizationId: optionalEnv.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID,
    matchCount: 8,
    supabase
  }).catch((error) => {
    throw new Error(
      `Suche fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`
    );
  });

  return NextResponse.json<SearchResponse>({
    query,
    results
  });
}

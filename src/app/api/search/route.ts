import { NextResponse } from "next/server";
import { searchDocumentChunks } from "@/lib/search/semantic-search";
import { getServerEnv } from "@/lib/server-env";
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
  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const body = (await request.json().catch(() => ({}))) as SearchRequest;
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (query.length < 3) {
    return jsonError("Bitte gib mindestens 3 Zeichen ein.", 400);
  }

  if (query.length > 500) {
    return jsonError("Die Suchanfrage ist zu lang.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const results = await searchDocumentChunks({
    query,
    organizationId: env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID,
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

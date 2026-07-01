import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding, toPgVector } from "@/lib/analysis/openai-embeddings";
import { getOpenAiApiKey } from "@/lib/server-env";

export type SemanticSearchResult = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
};

type SearchRow = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  content: string;
  similarity: number;
  document_status?: string | null;
};

async function getIndexedDocumentIds({
  documentIds,
  organizationId,
  supabase
}: {
  documentIds: string[];
  organizationId: string;
  supabase: SupabaseClient;
}) {
  if (documentIds.length === 0) {
    return new Set<string>();
  }

  const result = await supabase
    .from("documents")
    .select("id,status")
    .eq("organization_id", organizationId)
    .in("id", documentIds);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return new Set(
    (result.data ?? [])
      .filter((document) => document.status === "indexed")
      .map((document) => document.id as string)
  );
}

export async function searchDocumentChunks({
  query,
  organizationId,
  matchCount,
  supabase
}: {
  query: string;
  organizationId: string;
  matchCount: number;
  supabase: SupabaseClient;
}): Promise<SemanticSearchResult[]> {
  const embedding = await createEmbedding(getOpenAiApiKey(), query);
  const result = await supabase.rpc("match_document_chunks", {
    query_embedding: toPgVector(embedding),
    target_organization_id: organizationId,
    match_count: matchCount
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data as SearchRow[];
  const rowsWithStatus = rows.filter(
    (row) => row.document_status === undefined || row.document_status === "indexed"
  );
  const indexedDocumentIds = await getIndexedDocumentIds({
    documentIds: Array.from(new Set(rowsWithStatus.map((row) => row.document_id))),
    organizationId,
    supabase
  });

  return rowsWithStatus
    .filter((row) => indexedDocumentIds.has(row.document_id))
    .map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      content: row.content,
      similarity: row.similarity
    }));
}

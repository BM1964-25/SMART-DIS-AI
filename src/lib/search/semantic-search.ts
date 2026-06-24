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
};

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

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    content: row.content,
    similarity: row.similarity
  }));
}

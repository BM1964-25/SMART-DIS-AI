import { NextResponse } from "next/server";
import { chunkText } from "@/lib/analysis/chunk-text";
import { createEmbeddings, embeddingMetadata, toPgVector } from "@/lib/analysis/openai-embeddings";
import { getOpenAiApiKey, getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<unknown>;
};

type SemanticIndexResponse = {
  documentId: string;
  chunkCount: number;
  embeddingModel: string;
};

type SemanticIndexErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<SemanticIndexErrorResponse>({ error: message }, { status });
}

export async function POST(_request: Request, context: RouteContext) {
  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const params = (await context.params) as { documentId?: string };
  const documentId = params.documentId;

  if (!documentId) {
    return jsonError("Document id is required.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const extractionResult = await supabase
    .from("document_extractions")
    .select("document_id,organization_id,extracted_text")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .single();

  if (extractionResult.error) {
    return jsonError(
      `Vor der semantischen Indexierung muss die Dokumentenanalyse abgeschlossen sein: ${extractionResult.error.message}`,
      409
    );
  }

  if (
    typeof extractionResult.data.extracted_text !== "string" ||
    extractionResult.data.extracted_text.trim().length < 20
  ) {
    return jsonError("Es ist kein ausreichender extrahierter Text vorhanden.", 409);
  }

  const chunks = chunkText(extractionResult.data.extracted_text);

  if (chunks.length === 0) {
    return jsonError("Aus dem Dokument konnten keine Such-Chunks erzeugt werden.", 409);
  }

  const jobResult = await supabase
    .from("document_analysis_jobs")
    .insert({
      organization_id: extractionResult.data.organization_id,
      document_id: documentId,
      status: "processing",
      current_step: "Semantische Indexierung",
      model: embeddingMetadata.model,
      prompt_version: "semantic-index-v1",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (jobResult.error) {
    return jsonError(
      `Indexierungsjob konnte nicht erstellt werden: ${jobResult.error.message}`,
      502
    );
  }

  try {
    const embeddings = await createEmbeddings(
      getOpenAiApiKey(),
      chunks.map((chunk) => chunk.content)
    );

    const deleteResult = await supabase
      .from("document_chunks")
      .delete()
      .eq("organization_id", extractionResult.data.organization_id)
      .eq("document_id", documentId);

    if (deleteResult.error) {
      throw new Error(
        `Bestehende Chunks konnten nicht aktualisiert werden: ${deleteResult.error.message}`
      );
    }

    const insertResult = await supabase.from("document_chunks").insert(
      chunks.map((chunk, index) => ({
        organization_id: extractionResult.data.organization_id,
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: chunk.tokenCount,
        embedding: toPgVector(embeddings[index] ?? [])
      }))
    );

    if (insertResult.error) {
      throw new Error(`Chunks konnten nicht gespeichert werden: ${insertResult.error.message}`);
    }

    await supabase
      .from("documents")
      .update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId);

    await supabase
      .from("document_analysis_jobs")
      .update({
        status: "completed",
        current_step: "Semantische Indexierung abgeschlossen",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    return NextResponse.json<SemanticIndexResponse>({
      documentId,
      chunkCount: chunks.length,
      embeddingModel: embeddingMetadata.model
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Semantische Indexierung fehlgeschlagen.";

    await supabase
      .from("document_analysis_jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    return jsonError(errorMessage, 502);
  }
}

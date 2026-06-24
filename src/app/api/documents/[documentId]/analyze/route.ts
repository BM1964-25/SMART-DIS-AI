import { NextResponse } from "next/server";
import { type SupportedFileType } from "@/domain/documents";
import {
  analyzeDocumentText,
  documentAnalysisPromptMetadata
} from "@/lib/analysis/openai-document-analysis";
import { extractTextFromBuffer } from "@/lib/analysis/text-extraction";
import { getOpenAiApiKey, getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<unknown>;
};

type AnalyzeResponse = {
  documentId: string;
  documentType: string;
  summary: string;
  extractedTextLength: number;
};

type AnalyzeErrorResponse = {
  error: string;
};

type DocumentForAnalysis = {
  id: string;
  organization_id: string;
  file_type: SupportedFileType;
  storage_bucket: string;
  storage_path: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<AnalyzeErrorResponse>({ error: message }, { status });
}

async function markDocumentFailed(
  documentId: string,
  errorMessage: string,
  supabase: ReturnType<typeof createSupabaseAdminClient>
) {
  await supabase
    .from("documents")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq("id", documentId);
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

  const documentResult = await supabase
    .from("documents")
    .select("id,organization_id,file_type,storage_bucket,storage_path")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("id", documentId)
    .single<DocumentForAnalysis>();

  if (documentResult.error) {
    return jsonError(`Dokument konnte nicht geladen werden: ${documentResult.error.message}`, 404);
  }

  const document = documentResult.data;

  const jobResult = await supabase
    .from("document_analysis_jobs")
    .insert({
      organization_id: document.organization_id,
      document_id: document.id,
      status: "processing",
      current_step: "Text Extraction",
      model: documentAnalysisPromptMetadata.model,
      prompt_version: documentAnalysisPromptMetadata.promptVersion,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (jobResult.error) {
    return jsonError(`Analysejob konnte nicht erstellt werden: ${jobResult.error.message}`, 502);
  }

  await supabase
    .from("documents")
    .update({
      status: "extracting_text",
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", document.id);

  try {
    const downloadResult = await supabase.storage
      .from(document.storage_bucket)
      .download(document.storage_path);

    if (downloadResult.error) {
      throw new Error(`Datei konnte nicht geladen werden: ${downloadResult.error.message}`);
    }

    const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
    const extracted = await extractTextFromBuffer(document.file_type, fileBuffer);

    if (extracted.text.length < 20) {
      throw new Error("Es konnte nicht genug Text aus dem Dokument extrahiert werden.");
    }

    await supabase
      .from("documents")
      .update({
        status: "analyzing",
        text_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", document.id);

    await supabase
      .from("document_analysis_jobs")
      .update({
        current_step: "Dokumentklassifizierung",
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    const analysis = await analyzeDocumentText(getOpenAiApiKey(), extracted.text);

    const extractionResult = await supabase.from("document_extractions").upsert(
      {
        organization_id: document.organization_id,
        document_id: document.id,
        summary: analysis.summary,
        extracted_text: extracted.text,
        classified_document_type: analysis.documentType,
        confidence: analysis.confidence,
        analysis_model: documentAnalysisPromptMetadata.model,
        prompt_version: documentAnalysisPromptMetadata.promptVersion,
        key_values: {
          pageCount: extracted.pageCount ?? null,
          extractedTextLength: extracted.text.length
        },
        updated_at: new Date().toISOString()
      },
      { onConflict: "document_id" }
    );

    if (extractionResult.error) {
      throw new Error(`Analyse konnte nicht gespeichert werden: ${extractionResult.error.message}`);
    }

    await supabase
      .from("documents")
      .update({
        document_type: analysis.documentType,
        status: "indexed",
        analyzed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", document.id);

    await supabase
      .from("document_analysis_jobs")
      .update({
        status: "completed",
        current_step: "Zusammenfassung",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    return NextResponse.json<AnalyzeResponse>({
      documentId: document.id,
      documentType: analysis.documentType,
      summary: analysis.summary,
      extractedTextLength: extracted.text.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Analyse fehlgeschlagen.";

    await markDocumentFailed(document.id, errorMessage, supabase);
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

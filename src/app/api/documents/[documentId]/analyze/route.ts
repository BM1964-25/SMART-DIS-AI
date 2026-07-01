import { NextResponse } from "next/server";
import { type SupportedFileType } from "@/domain/documents";
import {
  analyzeDocumentText,
  documentAnalysisPromptMetadata
} from "@/lib/analysis/openai-document-analysis";
import { analyzeLocalDocument } from "@/lib/analysis/local-document-analysis";
import { extractTextFromBuffer } from "@/lib/analysis/text-extraction";
import { evaluateTextQuality } from "@/lib/analysis/text-quality";
import { getOpenAiApiKey, getServerEnv, tryGetServerEnv } from "@/lib/server-env";
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
  const params = (await context.params) as { documentId?: string };
  const documentId = params.documentId;

  if (!documentId) {
    return jsonError("Document id is required.", 400);
  }

  const optionalEnv = tryGetServerEnv();

  if (!optionalEnv) {
    try {
      const analysis = await analyzeLocalDocument(documentId);

      return NextResponse.json<AnalyzeResponse>({
        documentId: analysis.documentId,
        documentType: analysis.documentType,
        summary: analysis.summary,
        extractedTextLength: analysis.extractedTextLength
      });
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Lokale Analyse fehlgeschlagen.",
        502
      );
    }
  }

  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
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
    const textQuality = evaluateTextQuality(extracted.text);

    const needsOcr = textQuality.quality === "needs_ocr" || textQuality.quality === "none";

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

    if (needsOcr) {
      const summary =
        "Die technische Textextraktion ist nicht belastbar. Das Dokument benötigt OCR, bevor Risiken, Fristen oder Inhalte verlässlich bewertet werden.";

      const extractionResult = await supabase.from("document_extractions").upsert(
        {
          organization_id: document.organization_id,
          document_id: document.id,
          summary,
          extracted_text: extracted.text,
          classified_document_type: "other",
          classified_document_type_confidence: 0.2,
          classified_document_type_reason:
            "Die Textqualität reicht für eine belastbare Dokumenttyp-Klassifikation nicht aus.",
          confidence: 0.2,
          analysis_model: documentAnalysisPromptMetadata.model,
          prompt_version: documentAnalysisPromptMetadata.promptVersion,
          key_values: {
            pageCount: extracted.pageCount ?? null,
            extractedTextLength: extracted.text.length,
            textQuality
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: "document_id" }
      );

      if (extractionResult.error) {
        throw new Error(
          `Analyse konnte nicht gespeichert werden: ${extractionResult.error.message}`
        );
      }

      await supabase
        .from("documents")
        .update({
          document_type: "other",
          status: "needs_ocr",
          analyzed_at: new Date().toISOString(),
          error_message: "OCR erforderlich: Textqualität ist nicht belastbar.",
          updated_at: new Date().toISOString()
        })
        .eq("id", document.id);

      await supabase
        .from("document_analysis_jobs")
        .update({
          status: "completed",
          current_step: "OCR erforderlich",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", jobResult.data.id);

      return NextResponse.json<AnalyzeResponse>({
        documentId: document.id,
        documentType: "other",
        summary,
        extractedTextLength: extracted.text.length
      });
    }

    const analysis = await analyzeDocumentText(getOpenAiApiKey(), extracted.text);

    const extractionResult = await supabase.from("document_extractions").upsert(
      {
        organization_id: document.organization_id,
        document_id: document.id,
        summary: analysis.summary,
        extracted_text: extracted.text,
        classified_document_type: analysis.documentType,
        classified_document_type_confidence: analysis.confidence,
        classified_document_type_reason: analysis.classificationReason,
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

import { NextResponse } from "next/server";
import {
  analyzeDeadlines,
  deadlineAnalysisPromptMetadata
} from "@/lib/analysis/openai-deadline-analysis";
import { getOpenAiApiKey, getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<unknown>;
};

type DeadlineAnalysisResponse = {
  documentId: string;
  deadlineCount: number;
};

type DeadlineAnalysisErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<DeadlineAnalysisErrorResponse>({ error: message }, { status });
}

function formatContractContext(contractAnalysis: Record<string, unknown> | null) {
  if (!contractAnalysis) {
    return undefined;
  }

  return JSON.stringify(contractAnalysis, null, 2).slice(0, 12000);
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
      `Vor der Fristenerkennung muss die Dokumentenanalyse abgeschlossen sein: ${extractionResult.error.message}`,
      409
    );
  }

  if (
    typeof extractionResult.data.extracted_text !== "string" ||
    extractionResult.data.extracted_text.trim().length < 20
  ) {
    return jsonError("Es ist kein ausreichender extrahierter Text vorhanden.", 409);
  }

  const contractResult = await supabase
    .from("document_contract_analyses")
    .select("*")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .maybeSingle();

  if (contractResult.error) {
    return jsonError(
      `Vertragsdaten konnten nicht geladen werden: ${contractResult.error.message}`,
      502
    );
  }

  const jobResult = await supabase
    .from("document_analysis_jobs")
    .insert({
      organization_id: extractionResult.data.organization_id,
      document_id: documentId,
      status: "processing",
      current_step: "Fristenerkennung",
      model: deadlineAnalysisPromptMetadata.model,
      prompt_version: deadlineAnalysisPromptMetadata.promptVersion,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (jobResult.error) {
    return jsonError(`Analysejob konnte nicht erstellt werden: ${jobResult.error.message}`, 502);
  }

  try {
    const analysis = await analyzeDeadlines(
      getOpenAiApiKey(),
      extractionResult.data.extracted_text,
      formatContractContext(contractResult.data)
    );

    const deleteResult = await supabase
      .from("document_deadlines")
      .delete()
      .eq("organization_id", extractionResult.data.organization_id)
      .eq("document_id", documentId);

    if (deleteResult.error) {
      throw new Error(
        `Bestehende Fristen konnten nicht aktualisiert werden: ${deleteResult.error.message}`
      );
    }

    if (analysis.deadlines.length > 0) {
      const insertResult = await supabase.from("document_deadlines").insert(
        analysis.deadlines.map((deadline) => ({
          organization_id: extractionResult.data.organization_id,
          document_id: documentId,
          title: deadline.title,
          deadline_date: deadline.deadlineDate,
          deadline_type: deadline.deadlineType,
          status: "open",
          source_excerpt: deadline.sourceExcerpt,
          confidence: deadline.confidence
        }))
      );

      if (insertResult.error) {
        throw new Error(`Fristen konnten nicht gespeichert werden: ${insertResult.error.message}`);
      }
    }

    await supabase
      .from("document_analysis_jobs")
      .update({
        status: "completed",
        current_step: "Fristenerkennung abgeschlossen",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    return NextResponse.json<DeadlineAnalysisResponse>({
      documentId,
      deadlineCount: analysis.deadlines.length
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Fristenerkennung fehlgeschlagen.";

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

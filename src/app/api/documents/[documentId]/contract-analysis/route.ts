import { NextResponse } from "next/server";
import {
  analyzeContractText,
  contractAnalysisPromptMetadata
} from "@/lib/analysis/openai-contract-analysis";
import { getOpenAiApiKey, getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<unknown>;
};

type ContractAnalysisResponse = {
  documentId: string;
  contractPartners: string[];
  contractStart: string | null;
  contractEnd: string | null;
};

type ContractAnalysisErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<ContractAnalysisErrorResponse>({ error: message }, { status });
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
      `Vor der Vertragsanalyse muss die Dokumentenanalyse abgeschlossen sein: ${extractionResult.error.message}`,
      409
    );
  }

  if (
    typeof extractionResult.data.extracted_text !== "string" ||
    extractionResult.data.extracted_text.trim().length < 20
  ) {
    return jsonError("Es ist kein ausreichender extrahierter Text vorhanden.", 409);
  }

  const jobResult = await supabase
    .from("document_analysis_jobs")
    .insert({
      organization_id: extractionResult.data.organization_id,
      document_id: documentId,
      status: "processing",
      current_step: "Vertragsanalyse",
      model: contractAnalysisPromptMetadata.model,
      prompt_version: contractAnalysisPromptMetadata.promptVersion,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (jobResult.error) {
    return jsonError(`Analysejob konnte nicht erstellt werden: ${jobResult.error.message}`, 502);
  }

  try {
    const analysis = await analyzeContractText(
      getOpenAiApiKey(),
      extractionResult.data.extracted_text
    );

    const upsertResult = await supabase.from("document_contract_analyses").upsert(
      {
        organization_id: extractionResult.data.organization_id,
        document_id: documentId,
        contract_partners: analysis.contractPartners,
        contract_start: analysis.contractStart,
        contract_end: analysis.contractEnd,
        termination_notice: analysis.terminationNotice,
        contract_value_amount: analysis.contractValueAmount,
        contract_value_currency: analysis.contractValueCurrency,
        payment_terms: analysis.paymentTerms,
        contractual_penalties: analysis.contractualPenalties,
        liability: analysis.liability,
        automatic_renewal: analysis.automaticRenewal,
        confidence: analysis.confidence,
        raw_result: analysis.rawResult,
        analysis_model: contractAnalysisPromptMetadata.model,
        prompt_version: contractAnalysisPromptMetadata.promptVersion,
        updated_at: new Date().toISOString()
      },
      { onConflict: "document_id" }
    );

    if (upsertResult.error) {
      throw new Error(
        `Vertragsanalyse konnte nicht gespeichert werden: ${upsertResult.error.message}`
      );
    }

    await supabase
      .from("document_analysis_jobs")
      .update({
        status: "completed",
        current_step: "Vertragsanalyse abgeschlossen",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobResult.data.id);

    return NextResponse.json<ContractAnalysisResponse>({
      documentId,
      contractPartners: analysis.contractPartners,
      contractStart: analysis.contractStart,
      contractEnd: analysis.contractEnd
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Vertragsanalyse fehlgeschlagen.";

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

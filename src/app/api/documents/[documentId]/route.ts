import { NextResponse } from "next/server";
import {
  mapContractAnalysisRow,
  mapDeadlineRow,
  mapDocumentRow,
  mapExtractionRow,
  mapRiskRow,
  type DocumentDetailRecord
} from "@/domain/document-record";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<unknown>;
};

type DocumentDetailResponse = {
  document: DocumentDetailRecord;
};

type DocumentDetailErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<DocumentDetailErrorResponse>({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
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
    .select("id,title,file_name,file_type,document_type,size_bytes,status,storage_path,created_at")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("id", documentId)
    .single();

  if (documentResult.error) {
    return jsonError(`Dokument konnte nicht geladen werden: ${documentResult.error.message}`, 404);
  }

  const extractionResult = await supabase
    .from("document_extractions")
    .select(
      "id,document_id,summary,extracted_text,classified_document_type,confidence,analysis_model,prompt_version,created_at,updated_at"
    )
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .maybeSingle();

  if (extractionResult.error) {
    return jsonError(`Analyse konnte nicht geladen werden: ${extractionResult.error.message}`, 502);
  }

  const contractAnalysisResult = await supabase
    .from("document_contract_analyses")
    .select(
      "id,document_id,contract_partners,contract_start,contract_end,termination_notice,contract_value_amount,contract_value_currency,payment_terms,contractual_penalties,liability,automatic_renewal,confidence,analysis_model,prompt_version,created_at,updated_at"
    )
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .maybeSingle();

  if (contractAnalysisResult.error) {
    return jsonError(
      `Vertragsanalyse konnte nicht geladen werden: ${contractAnalysisResult.error.message}`,
      502
    );
  }

  const risksResult = await supabase
    .from("document_risks")
    .select(
      "id,document_id,title,description,severity,category,risk_score,source_excerpt,confidence,is_reviewed,created_at,updated_at"
    )
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .order("risk_score", { ascending: false });

  if (risksResult.error) {
    return jsonError(`Risiken konnten nicht geladen werden: ${risksResult.error.message}`, 502);
  }

  const deadlinesResult = await supabase
    .from("document_deadlines")
    .select(
      "id,document_id,title,deadline_date,deadline_type,status,source_excerpt,confidence,created_at,updated_at"
    )
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("document_id", documentId)
    .order("deadline_date", { ascending: true });

  if (deadlinesResult.error) {
    return jsonError(`Fristen konnten nicht geladen werden: ${deadlinesResult.error.message}`, 502);
  }

  return NextResponse.json<DocumentDetailResponse>({
    document: {
      ...mapDocumentRow(documentResult.data),
      extraction: extractionResult.data ? mapExtractionRow(extractionResult.data) : null,
      contractAnalysis: contractAnalysisResult.data
        ? mapContractAnalysisRow(contractAnalysisResult.data)
        : null,
      risks: risksResult.data.map(mapRiskRow),
      deadlines: deadlinesResult.data.map(mapDeadlineRow)
    }
  });
}

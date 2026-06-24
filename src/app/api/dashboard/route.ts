import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DashboardRisk = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  category: string;
  severity: string;
  riskScore: number | null;
  reasoning: string;
};

type DashboardResponse = {
  documentCount: number;
  riskCount: number;
  averageRiskScore: number;
  highRiskCount: number;
  risksByCategory: Array<{ category: string; count: number }>;
  topRisks: DashboardRisk[];
};

type DashboardErrorResponse = {
  error: string;
};

type RiskDashboardRow = {
  id: string;
  document_id: string;
  title: string;
  category: string;
  severity: string;
  risk_score: number | null;
  description: string;
  documents: { title: string } | Array<{ title: string }> | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<DashboardErrorResponse>({ error: message }, { status });
}

function getDocumentTitle(row: RiskDashboardRow) {
  if (Array.isArray(row.documents)) {
    return row.documents[0]?.title ?? "Unbekanntes Dokument";
  }

  return row.documents?.title ?? "Unbekanntes Dokument";
}

export async function GET() {
  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const supabase = createSupabaseAdminClient();

  const documentCountResult = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID);

  if (documentCountResult.error) {
    return jsonError(
      `Dokumentanzahl konnte nicht geladen werden: ${documentCountResult.error.message}`,
      502
    );
  }

  const risksResult = await supabase
    .from("document_risks")
    .select("id,document_id,title,category,severity,risk_score,description,documents(title)")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .order("risk_score", { ascending: false })
    .limit(100);

  if (risksResult.error) {
    return jsonError(`Risiken konnten nicht geladen werden: ${risksResult.error.message}`, 502);
  }

  const risks = risksResult.data as RiskDashboardRow[];
  const scores = risks
    .map((risk) => risk.risk_score)
    .filter((score): score is number => typeof score === "number");
  const averageRiskScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
  const categoryCounts = new Map<string, number>();

  risks.forEach((risk) => {
    categoryCounts.set(risk.category, (categoryCounts.get(risk.category) ?? 0) + 1);
  });

  return NextResponse.json<DashboardResponse>({
    documentCount: documentCountResult.count ?? 0,
    riskCount: risks.length,
    averageRiskScore,
    highRiskCount: risks.filter(
      (risk) =>
        risk.severity === "high" || risk.severity === "critical" || (risk.risk_score ?? 0) >= 70
    ).length,
    risksByCategory: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topRisks: risks.slice(0, 8).map((risk) => ({
      id: risk.id,
      documentId: risk.document_id,
      documentTitle: getDocumentTitle(risk),
      title: risk.title,
      category: risk.category,
      severity: risk.severity,
      riskScore: risk.risk_score,
      reasoning: risk.description
    }))
  });
}

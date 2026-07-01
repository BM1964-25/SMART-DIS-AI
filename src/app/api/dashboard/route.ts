import { NextResponse } from "next/server";
import { guidedQuestionPresets } from "@/domain/guided-questions";
import { listLocalDocumentDetails } from "@/lib/documents/local-document-store";
import { getLocalOcrPriorityRules } from "@/lib/ocr/local-ocr-priority-rules";
import { getServerEnv, tryGetServerEnv } from "@/lib/server-env";
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

type DashboardOcrQueueItem = {
  id: string;
  title: string;
  fileName: string;
  documentType: string;
  status: string;
  textLength: number;
  readableRatio: number;
  brokenCharRatio: number;
  priorityScore: number;
  priorityReason: string;
};

type DashboardResponse = {
  documentCount: number;
  indexedDocumentCount: number;
  needsOcrCount: number;
  deadlineCount: number;
  riskCount: number;
  averageRiskScore: number;
  highRiskCount: number;
  documentStatusDistribution: Array<{ status: string; count: number }>;
  ocrQueue: DashboardOcrQueueItem[];
  guidedQuestionCounts?: Array<{
    id: string;
    count: number;
    label: string;
  }>;
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

function normalizeLegacyGermanText(value: string) {
  return value
    .replaceAll("Ausfuehrung", "Ausführung")
    .replaceAll("ausfuehrung", "ausführung")
    .replaceAll("pruefen", "prüfen")
    .replaceAll("Pruefen", "Prüfen")
    .replaceAll("geprueft", "geprüft")
    .replaceAll("Geprueft", "Geprüft");
}

function toSortedDistribution(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
}

function getOcrPriority(
  document: {
    documentType: string;
    analysisReadableRatio?: number;
    analysisBrokenCharRatio?: number;
    analysisTextLength?: number;
  },
  rules: Record<string, number>
) {
  const readableRatio = document.analysisReadableRatio ?? 0;
  const brokenCharRatio = document.analysisBrokenCharRatio ?? 0;
  const typePriority = rules[document.documentType] ?? rules.other ?? 4;
  const lowQualityScore = Math.round((1 - readableRatio) * 55 + brokenCharRatio * 120);
  const sizeScore = Math.min(12, Math.round((document.analysisTextLength ?? 0) / 750000));
  const priorityScore = Math.max(0, Math.min(100, lowQualityScore + typePriority + sizeScore));

  const reasons = [
    readableRatio < 0.78 ? "niedrige Lesbarkeit" : null,
    brokenCharRatio > 0.02 ? "viele defekte Zeichen" : null,
    typePriority >= 24 ? "fachlich priorisierter Dokumenttyp" : null,
    (document.analysisTextLength ?? 0) > 1_000_000 ? "sehr großer Rohtext" : null
  ].filter(Boolean);

  return {
    priorityScore,
    priorityReason: reasons.join(", ") || "OCR-Qualität prüfen"
  };
}

function getGuidedQuestionCount(
  presetId: string,
  documents: Awaited<ReturnType<typeof listLocalDocumentDetails>>
) {
  const preset = guidedQuestionPresets.find((entry) => entry.id === presetId);
  const matchingDocuments = preset
    ? documents.filter((document) =>
        preset.documentTypes.some((documentType) => documentType === document.documentType)
      )
    : documents;

  if (presetId === "contract-deadlines") {
    return {
      count: matchingDocuments.reduce((sum, document) => sum + document.deadlines.length, 0),
      label: "Fristen"
    };
  }

  if (presetId === "risk-overview") {
    return {
      count: matchingDocuments.reduce((sum, document) => sum + document.risks.length, 0),
      label: "Risiken"
    };
  }

  if (presetId === "defect-overview") {
    return {
      count: matchingDocuments.reduce(
        (sum, document) => sum + document.risks.length + document.deadlines.length,
        0
      ),
      label: "Mängel/Fristen"
    };
  }

  if (presetId === "meeting-actions") {
    return {
      count: matchingDocuments.reduce((sum, document) => sum + document.deadlines.length, 0),
      label: "Aufgaben"
    };
  }

  if (presetId === "cost-review") {
    return {
      count: matchingDocuments.reduce((sum, document) => sum + document.risks.length, 0),
      label: "Prüfpunkte"
    };
  }

  return {
    count: matchingDocuments.reduce(
      (sum, document) => sum + document.deadlines.length + document.risks.length,
      0
    ),
    label: "Hinweise"
  };
}

export async function GET() {
  const optionalEnv = tryGetServerEnv();

  if (!optionalEnv) {
    const documents = await listLocalDocumentDetails();
    const ocrPriorityRules = await getLocalOcrPriorityRules();
    const risks = documents.flatMap((document) =>
      document.risks.map((risk) => ({
        ...risk,
        documentTitle: document.title
      }))
    );
    const scores = risks
      .map((risk) => risk.riskScore)
      .filter((score): score is number => typeof score === "number");
    const averageRiskScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0;
    const categoryCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();

    risks.forEach((risk) => {
      categoryCounts.set(risk.category, (categoryCounts.get(risk.category) ?? 0) + 1);
    });
    documents.forEach((document) => {
      const status =
        document.status === "needs_ocr" || document.analysisQuality === "needs_ocr"
          ? "needs_ocr"
          : document.status;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    });

    return NextResponse.json<DashboardResponse>({
      documentCount: documents.length,
      indexedDocumentCount: documents.filter((document) => document.status === "indexed").length,
      needsOcrCount: documents.filter(
        (document) => document.status === "needs_ocr" || document.analysisQuality === "needs_ocr"
      ).length,
      deadlineCount: documents.reduce((sum, document) => sum + document.deadlines.length, 0),
      riskCount: risks.length,
      averageRiskScore,
      highRiskCount: risks.filter(
        (risk) =>
          risk.severity === "high" || risk.severity === "critical" || (risk.riskScore ?? 0) >= 70
      ).length,
      documentStatusDistribution: toSortedDistribution(statusCounts),
      ocrQueue: documents
        .filter(
          (document) => document.status === "needs_ocr" || document.analysisQuality === "needs_ocr"
        )
        .map((document) => {
          const priority = getOcrPriority(document, ocrPriorityRules);

          return {
            id: document.id,
            title: document.title,
            fileName: document.fileName,
            documentType: document.documentType,
            status: document.status,
            textLength: document.analysisTextLength ?? 0,
            readableRatio: document.analysisReadableRatio ?? 0,
            brokenCharRatio: document.analysisBrokenCharRatio ?? 0,
            priorityScore: priority.priorityScore,
            priorityReason: priority.priorityReason
          };
        })
        .sort(
          (left, right) =>
            right.priorityScore - left.priorityScore || left.title.localeCompare(right.title)
        )
        .slice(0, 8),
      guidedQuestionCounts: guidedQuestionPresets.map((preset) => ({
        id: preset.id,
        ...getGuidedQuestionCount(preset.id, documents)
      })),
      risksByCategory: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      topRisks: risks
        .sort((left, right) => (right.riskScore ?? 0) - (left.riskScore ?? 0))
        .slice(0, 8)
        .map((risk) => ({
          id: risk.id,
          documentId: risk.documentId,
          documentTitle: risk.documentTitle,
          title: normalizeLegacyGermanText(risk.title),
          category: normalizeLegacyGermanText(risk.category),
          severity: risk.severity,
          riskScore: risk.riskScore,
          reasoning: normalizeLegacyGermanText(risk.description)
        }))
    });
  }

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

  const indexedDocumentCountResult = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("status", "indexed");

  if (indexedDocumentCountResult.error) {
    return jsonError(
      `Indexierte Dokumente konnten nicht geladen werden: ${indexedDocumentCountResult.error.message}`,
      502
    );
  }

  const needsOcrCountResult = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .eq("status", "needs_ocr");

  if (needsOcrCountResult.error) {
    return jsonError(
      `OCR-Dokumente konnten nicht geladen werden: ${needsOcrCountResult.error.message}`,
      502
    );
  }

  const deadlineCountResult = await supabase
    .from("document_deadlines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID);

  if (deadlineCountResult.error) {
    return jsonError(
      `Fristen konnten nicht geladen werden: ${deadlineCountResult.error.message}`,
      502
    );
  }

  const documentStatusResult = await supabase
    .from("documents")
    .select("status")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID);

  if (documentStatusResult.error) {
    return jsonError(
      `Dokumentstatus konnten nicht geladen werden: ${documentStatusResult.error.message}`,
      502
    );
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
  const statusCounts = new Map<string, number>();

  risks.forEach((risk) => {
    categoryCounts.set(risk.category, (categoryCounts.get(risk.category) ?? 0) + 1);
  });
  (documentStatusResult.data as Array<{ status: string }>).forEach((document) => {
    statusCounts.set(document.status, (statusCounts.get(document.status) ?? 0) + 1);
  });

  return NextResponse.json<DashboardResponse>({
    documentCount: documentCountResult.count ?? 0,
    indexedDocumentCount: indexedDocumentCountResult.count ?? 0,
    needsOcrCount: needsOcrCountResult.count ?? 0,
    deadlineCount: deadlineCountResult.count ?? 0,
    riskCount: risks.length,
    averageRiskScore,
    highRiskCount: risks.filter(
      (risk) =>
        risk.severity === "high" || risk.severity === "critical" || (risk.risk_score ?? 0) >= 70
    ).length,
    documentStatusDistribution: toSortedDistribution(statusCounts),
    ocrQueue: [],
    risksByCategory: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topRisks: risks.slice(0, 8).map((risk) => ({
      id: risk.id,
      documentId: risk.document_id,
      documentTitle: getDocumentTitle(risk),
      title: normalizeLegacyGermanText(risk.title),
      category: normalizeLegacyGermanText(risk.category),
      severity: risk.severity,
      riskScore: risk.risk_score,
      reasoning: normalizeLegacyGermanText(risk.description)
    }))
  });
}

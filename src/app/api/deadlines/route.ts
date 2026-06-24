import { NextResponse } from "next/server";
import { mapDeadlineRow, type DocumentDeadlineRecord } from "@/domain/document-record";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DeadlineOverviewRecord = DocumentDeadlineRecord & {
  documentTitle: string;
};

type DeadlinesResponse = {
  deadlines: DeadlineOverviewRecord[];
  totalCount: number;
  overdueCount: number;
  next30DaysCount: number;
  byType: Array<{ type: string; count: number }>;
};

type DeadlinesErrorResponse = {
  error: string;
};

type DeadlineRowWithDocument = {
  id: string;
  document_id: string;
  title: string;
  deadline_date: string;
  deadline_type: string;
  status: string;
  source_excerpt: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  documents: { title: string } | Array<{ title: string }> | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<DeadlinesErrorResponse>({ error: message }, { status });
}

function getDocumentTitle(row: DeadlineRowWithDocument) {
  if (Array.isArray(row.documents)) {
    return row.documents[0]?.title ?? "Unbekanntes Dokument";
  }

  return row.documents?.title ?? "Unbekanntes Dokument";
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("document_deadlines")
    .select(
      "id,document_id,title,deadline_date,deadline_type,status,source_excerpt,confidence,created_at,updated_at,documents(title)"
    )
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .order("deadline_date", { ascending: true })
    .limit(200);

  if (result.error) {
    return jsonError(`Fristen konnten nicht geladen werden: ${result.error.message}`, 502);
  }

  const rows = result.data as DeadlineRowWithDocument[];
  const today = toDateOnly(new Date());
  const next30DaysDate = new Date();
  next30DaysDate.setDate(next30DaysDate.getDate() + 30);
  const next30Days = toDateOnly(next30DaysDate);
  const typeCounts = new Map<string, number>();

  rows.forEach((row) => {
    typeCounts.set(row.deadline_type, (typeCounts.get(row.deadline_type) ?? 0) + 1);
  });

  return NextResponse.json<DeadlinesResponse>({
    deadlines: rows.map((row) => ({
      ...mapDeadlineRow(row),
      documentTitle: getDocumentTitle(row)
    })),
    totalCount: rows.length,
    overdueCount: rows.filter((row) => row.deadline_date < today && row.status === "open").length,
    next30DaysCount: rows.filter(
      (row) =>
        row.deadline_date >= today && row.deadline_date <= next30Days && row.status === "open"
    ).length,
    byType: Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  });
}

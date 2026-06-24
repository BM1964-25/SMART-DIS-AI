import { NextResponse } from "next/server";
import { mapDocumentRow, type DocumentRecord } from "@/domain/document-record";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DocumentsResponse = {
  documents: DocumentRecord[];
};

type DocumentsErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<DocumentsErrorResponse>({ error: message }, { status });
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
    .from("documents")
    .select("id,title,file_name,file_type,document_type,size_bytes,status,storage_path,created_at")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) {
    return jsonError(`Dokumente konnten nicht geladen werden: ${result.error.message}`, 502);
  }

  return NextResponse.json<DocumentsResponse>({
    documents: result.data.map(mapDocumentRow)
  });
}

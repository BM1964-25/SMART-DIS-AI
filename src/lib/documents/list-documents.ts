import { mapDocumentRow, type DocumentRecord } from "@/domain/document-record";
import { listLocalDocuments } from "@/lib/documents/local-document-store";
import { tryGetServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function listDocuments(): Promise<DocumentRecord[]> {
  const env = tryGetServerEnv();

  if (!env) {
    return listLocalDocuments();
  }

  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("documents")
    .select("id,title,file_name,file_type,document_type,size_bytes,status,storage_path,created_at")
    .eq("organization_id", env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID)
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) {
    throw new Error(`Dokumente konnten nicht geladen werden: ${result.error.message}`);
  }

  return result.data.map(mapDocumentRow);
}

import { DocumentDetailView } from "@/components/documents/document-detail-view";
import { getLocalDocumentDetail } from "@/lib/documents/local-document-store";
import { getLocalOcrJob } from "@/lib/ocr/local-ocr-preparation";
import { tryGetServerEnv } from "@/lib/server-env";

type DocumentDetailPageProps = {
  params: Promise<{
    documentId: string;
  }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentId } = await params;
  const hasSupabase = Boolean(tryGetServerEnv());
  const initialDocument = hasSupabase ? null : await getLocalDocumentDetail(documentId);
  const initialOcrJob = hasSupabase ? null : await getLocalOcrJob(documentId);

  return (
    <DocumentDetailView
      documentId={documentId}
      initialDocument={initialDocument}
      initialOcrJob={initialOcrJob}
    />
  );
}

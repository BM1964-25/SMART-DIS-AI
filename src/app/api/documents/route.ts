import { NextResponse } from "next/server";
import type { DocumentRecord } from "@/domain/document-record";
import { listDocuments } from "@/lib/documents/list-documents";

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
  try {
    return NextResponse.json<DocumentsResponse>({
      documents: await listDocuments()
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Dokumente konnten nicht geladen werden.",
      502
    );
  }
}

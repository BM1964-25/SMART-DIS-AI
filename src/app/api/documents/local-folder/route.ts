import { NextResponse } from "next/server";
import type { DocumentRecord } from "@/domain/document-record";
import {
  browseLocalDirectories,
  importLocalFolderDocuments
} from "@/lib/documents/local-document-store";

export const runtime = "nodejs";

type LocalFolderRequest = {
  folderPath?: unknown;
};

type LocalFolderResponse = {
  documents: DocumentRecord[];
  skipped: Array<{
    filePath: string;
    reason: string;
  }>;
};

type LocalFolderBrowseResponse = Awaited<ReturnType<typeof browseLocalDirectories>>;

type LocalFolderErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<LocalFolderErrorResponse>({ error: message }, { status });
}

function isLocalFolderImportEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_FOLDER_IMPORT === "true";
}

export async function GET(request: Request) {
  if (!isLocalFolderImportEnabled()) {
    return jsonError("Lokale Ordnerverknüpfung ist in dieser Umgebung deaktiviert.", 403);
  }

  const url = new URL(request.url);
  const folderPath = url.searchParams.get("path") ?? undefined;

  try {
    const result = await browseLocalDirectories(folderPath);

    return NextResponse.json<LocalFolderBrowseResponse>(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Lokaler Ordner konnte nicht gelesen werden.",
      400
    );
  }
}

export async function POST(request: Request) {
  if (!isLocalFolderImportEnabled()) {
    return jsonError("Lokale Ordnerverknüpfung ist in dieser Umgebung deaktiviert.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as LocalFolderRequest;
  const folderPath = typeof body.folderPath === "string" ? body.folderPath.trim() : "";

  if (!folderPath) {
    return jsonError("Bitte gib einen lokalen Ordnerpfad an.", 400);
  }

  try {
    const result = await importLocalFolderDocuments(folderPath);

    return NextResponse.json<LocalFolderResponse>({
      documents: result.documents,
      skipped: result.skipped
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Lokaler Ordner konnte nicht gelesen werden.",
      400
    );
  }
}

import { NextResponse } from "next/server";
import { importLocalFolderDocuments } from "@/lib/documents/local-document-store";

export const runtime = "nodejs";

function isLocalFolderImportEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_FOLDER_IMPORT === "true";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const folderPath = url.searchParams.get("path")?.trim();
  const redirectUrl = new URL("/upload", url.origin);

  if (!isLocalFolderImportEnabled()) {
    redirectUrl.searchParams.set("folderError", "Lokale Ordnerverknüpfung ist deaktiviert.");
    return NextResponse.redirect(redirectUrl);
  }

  if (!folderPath) {
    redirectUrl.searchParams.set("folderError", "Bitte wähle einen lokalen Ordner aus.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await importLocalFolderDocuments(folderPath);
    redirectUrl.searchParams.set("folderImported", String(result.documents.length));
    redirectUrl.searchParams.set("folderSkipped", String(result.skipped.length));
  } catch (error) {
    redirectUrl.searchParams.set(
      "folderError",
      error instanceof Error ? error.message : "Lokaler Ordner konnte nicht verbunden werden."
    );
  }

  return NextResponse.redirect(redirectUrl);
}

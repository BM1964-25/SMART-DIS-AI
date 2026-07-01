import { NextResponse } from "next/server";
import {
  listLinkedLocalFolders,
  syncLinkedLocalFolders
} from "@/lib/documents/local-document-store";

export const runtime = "nodejs";

function isLocalFolderImportEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_FOLDER_IMPORT === "true";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!isLocalFolderImportEnabled()) {
    return jsonError("Lokale Ordnersynchronisation ist in dieser Umgebung deaktiviert.", 403);
  }

  return NextResponse.json({
    folders: await listLinkedLocalFolders()
  });
}

export async function POST() {
  if (!isLocalFolderImportEnabled()) {
    return jsonError("Lokale Ordnersynchronisation ist in dieser Umgebung deaktiviert.", 403);
  }

  try {
    return NextResponse.json(await syncLinkedLocalFolders());
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Lokale Ordner konnten nicht synchronisiert werden.",
      502
    );
  }
}

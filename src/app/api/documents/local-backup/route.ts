import { NextResponse } from "next/server";
import {
  createLocalDocumentsBackup,
  restoreLocalDocumentsBackup
} from "@/lib/documents/local-document-store";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

function isLocalBackupEnabled() {
  return !tryGetServerEnv();
}

export async function GET() {
  if (!isLocalBackupEnabled()) {
    return NextResponse.json(
      { error: "Lokale Dateisicherung ist nur ohne Supabase-Konfiguration aktiv." },
      { status: 503 }
    );
  }

  const backup = await createLocalDocumentsBackup();

  return new NextResponse(backup.content, {
    headers: {
      "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-SMART-DIS-AI-Document-Count": String(backup.documentCount)
    }
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/upload", url.origin);

  if (!isLocalBackupEnabled()) {
    redirectUrl.searchParams.set(
      "backupError",
      "Lokale Dateisicherung ist nur ohne Supabase-Konfiguration aktiv."
    );
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const formData = await request.formData();
    const backupFile = formData.get("backup");

    if (!(backupFile instanceof File)) {
      throw new Error("Bitte wähle eine SMART DIS-AI Sicherungsdatei aus.");
    }

    if (!backupFile.name.toLowerCase().endsWith(".json")) {
      throw new Error("Die Sicherungsdatei muss eine JSON-Datei sein.");
    }

    const result = await restoreLocalDocumentsBackup(await backupFile.text());
    redirectUrl.searchParams.set("backupRestored", String(result.documentCount));
  } catch (error) {
    redirectUrl.searchParams.set(
      "backupError",
      error instanceof Error ? error.message : "Sicherung konnte nicht importiert werden."
    );
  }

  return NextResponse.redirect(redirectUrl);
}

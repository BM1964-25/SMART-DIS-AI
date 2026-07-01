import { NextResponse } from "next/server";
import { mapDocumentRow, type DocumentRecord } from "@/domain/document-record";
import {
  allowedFileExtensionText,
  allowedMimeTypes,
  maxFilesPerUpload,
  maxUploadSizeInBytes
} from "@/domain/security";
import { saveLocalUploadedDocument } from "@/lib/documents/local-document-store";
import { tryGetServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type UploadSuccessResponse = {
  documents: DocumentRecord[];
  failed: UploadFailure[];
};

type UploadErrorResponse = {
  error: string;
};

type UploadFailure = {
  fileName: string;
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<UploadErrorResponse>({ error: message }, { status });
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function getSafeTitle(
  title: FormDataEntryValue | null,
  fallbackFileName: string,
  fileCount: number
) {
  const titleValue = typeof title === "string" ? title.trim() : "";

  if (fileCount === 1 && titleValue.length > 0) {
    return titleValue.slice(0, 160);
  }

  return fallbackFileName.replace(/\.[^.]+$/, "").slice(0, 160);
}

function isAllowedMimeType(mimeType: string): mimeType is keyof typeof allowedMimeTypes {
  return mimeType in allowedMimeTypes;
}

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function getValidatedFileType(uploadedFile: File): string | null {
  const safeFileName = sanitizeFileName(uploadedFile.name);
  const extension = getFileExtension(safeFileName);

  if (
    !Object.values(allowedMimeTypes).includes(
      extension as (typeof allowedMimeTypes)[keyof typeof allowedMimeTypes]
    )
  ) {
    return null;
  }

  if (!uploadedFile.type) {
    return extension;
  }

  if (!isAllowedMimeType(uploadedFile.type)) {
    return null;
  }

  const expectedExtension = allowedMimeTypes[uploadedFile.type];

  return expectedExtension === extension ? extension : null;
}

function validateUploadedFile(uploadedFile: File): string | null {
  if (uploadedFile.size <= 0) {
    return "Die Datei ist leer.";
  }

  if (uploadedFile.size > maxUploadSizeInBytes) {
    return "Die Datei ist größer als 25 MB.";
  }

  if (!getValidatedFileType(uploadedFile)) {
    return `Nur ${allowedFileExtensionText} Dateien sind erlaubt. Dateiendung und MIME-Type müssen zusammenpassen.`;
  }

  return null;
}

export async function POST(request: Request) {
  const env = tryGetServerEnv();
  const formData = await request.formData();
  const uploadedFiles = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (uploadedFiles.length === 0) {
    const legacyFile = formData.get("file");

    if (legacyFile instanceof File) {
      uploadedFiles.push(legacyFile);
    }
  }

  if (uploadedFiles.length === 0) {
    return jsonError("Bitte wähle mindestens eine Datei aus.", 400);
  }

  if (uploadedFiles.length > maxFilesPerUpload) {
    return jsonError(`Maximal ${maxFilesPerUpload} Dateien pro Upload sind erlaubt.`, 400);
  }

  const supabase = env ? createSupabaseAdminClient() : null;
  const uploadedDocuments: DocumentRecord[] = [];
  const failed: UploadFailure[] = [];

  for (const uploadedFile of uploadedFiles) {
    const validationError = validateUploadedFile(uploadedFile);

    if (validationError) {
      failed.push({ fileName: uploadedFile.name, error: validationError });
      continue;
    }

    const fileType = getValidatedFileType(uploadedFile);

    if (!fileType) {
      failed.push({ fileName: uploadedFile.name, error: "Dateityp konnte nicht bestimmt werden." });
      continue;
    }

    const mimeType = uploadedFile.type || "application/octet-stream";
    const safeFileName = sanitizeFileName(uploadedFile.name);
    const documentId = crypto.randomUUID();
    const title = getSafeTitle(formData.get("title"), safeFileName, uploadedFiles.length);

    if (!env || !supabase) {
      const document = await saveLocalUploadedDocument({
        documentId,
        title,
        safeFileName,
        fileType,
        mimeType,
        sizeBytes: uploadedFile.size,
        file: uploadedFile
      });

      uploadedDocuments.push(document);
      continue;
    }

    const storagePath = `${env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID}/${documentId}/${safeFileName}`;

    const uploadResult = await supabase.storage
      .from(env.SUPABASE_DOCUMENTS_BUCKET)
      .upload(storagePath, uploadedFile, {
        cacheControl: "3600",
        contentType: mimeType,
        upsert: false
      });

    if (uploadResult.error) {
      failed.push({
        fileName: safeFileName,
        error: `Upload fehlgeschlagen: ${uploadResult.error.message}`
      });
      continue;
    }

    const insertResult = await supabase
      .from("documents")
      .insert({
        id: documentId,
        organization_id: env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID,
        uploaded_by: null,
        title,
        file_name: safeFileName,
        file_type: fileType,
        mime_type: mimeType,
        storage_bucket: env.SUPABASE_DOCUMENTS_BUCKET,
        storage_path: storagePath,
        size_bytes: uploadedFile.size,
        document_type: "other",
        status: "uploaded"
      })
      .select(
        "id,title,file_name,file_type,document_type,size_bytes,status,storage_path,created_at"
      )
      .single();

    if (insertResult.error) {
      await supabase.storage.from(env.SUPABASE_DOCUMENTS_BUCKET).remove([storagePath]);
      failed.push({
        fileName: safeFileName,
        error: `Dokument konnte nicht gespeichert werden: ${insertResult.error.message}`
      });
      continue;
    }

    uploadedDocuments.push(mapDocumentRow(insertResult.data));
  }

  return NextResponse.json<UploadSuccessResponse>(
    {
      documents: uploadedDocuments,
      failed
    },
    { status: uploadedDocuments.length > 0 ? 201 : 400 }
  );
}

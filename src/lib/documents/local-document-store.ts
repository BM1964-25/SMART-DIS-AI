import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ContractAnalysisRecord,
  DocumentDeadlineRecord,
  DocumentDetailRecord,
  DocumentExtractionRecord,
  DocumentRecord,
  DocumentRiskRecord
} from "@/domain/document-record";
import {
  allowedFileExtensions,
  allowedMimeTypes,
  maxLocalFolderFiles,
  maxUploadSizeInBytes
} from "@/domain/security";
import { evaluateTextQuality } from "@/lib/analysis/text-quality";
import { getLocalDataDirectory } from "@/lib/local-data-path";

const localDataDirectory = getLocalDataDirectory();
const uploadsDirectory = path.join(localDataDirectory, "uploads");
const documentsFilePath = path.join(localDataDirectory, "documents.json");
const linkedFoldersFilePath = path.join(localDataDirectory, "linked-folders.json");
let localDocumentsMutationQueue = Promise.resolve();

type LocalDocumentRecord = DocumentRecord & {
  mimeType: string;
  localFilePath: string;
  sourceKind?: "upload" | "linked_folder";
  sourceStatus?: "available" | "missing";
  sourceCheckedAt?: string | null;
  extraction?: DocumentExtractionRecord | null;
  contractAnalysis?: ContractAnalysisRecord | null;
  risks?: DocumentRiskRecord[];
  deadlines?: DocumentDeadlineRecord[];
};

export type LocalFolderImportResult = {
  documents: DocumentRecord[];
  skipped: Array<{
    filePath: string;
    reason: string;
  }>;
};

export type LocalFolderSyncResult = {
  folders: LinkedLocalFolderRecord[];
  importedCount: number;
  skippedCount: number;
  failed: Array<{ path: string; error: string }>;
  importedDocuments: Array<{
    id: string;
    title: string;
    fileName: string;
    filePath: string;
  }>;
  skippedFiles: Array<{
    folderPath: string;
    filePath: string;
    reason: string;
  }>;
  missingSources: Array<{
    documentId: string;
    title: string;
    fileName: string;
    filePath: string;
  }>;
  restoredSources: Array<{
    documentId: string;
    title: string;
    fileName: string;
    filePath: string;
  }>;
};

export type LocalDirectoryBrowserResult = {
  currentPath: string;
  parentPath: string | null;
  directories: Array<{
    name: string;
    path: string;
  }>;
};

export type LocalAnalysisResult = {
  analyzedCount: number;
  failed: Array<{
    documentId: string;
    fileName: string;
    error: string;
  }>;
  riskCount: number;
  deadlineCount: number;
};

export type LocalBackupRestoreResult = {
  documentCount: number;
  backupPath: string | null;
};

export type LinkedLocalFolderRecord = {
  path: string;
  connectedAt: string;
  lastSyncedAt: string;
  importedCount: number;
  skippedCount: number;
};

const mimeTypeByExtension = Object.fromEntries(
  Object.entries(allowedMimeTypes).map(([mimeType, extension]) => [extension, mimeType])
) as Record<(typeof allowedFileExtensions)[number], string>;

async function ensureLocalDataDirectory() {
  await mkdir(uploadsDirectory, { recursive: true });
}

async function readLocalDocuments(): Promise<LocalDocumentRecord[]> {
  await ensureLocalDataDirectory();

  try {
    const content = await readFile(documentsFilePath, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed.filter(isLocalDocumentRecord) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeLocalDocuments(documents: LocalDocumentRecord[]) {
  await ensureLocalDataDirectory();
  await writeFile(documentsFilePath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
}

async function readLinkedFolders(): Promise<LinkedLocalFolderRecord[]> {
  await ensureLocalDataDirectory();

  try {
    const content = await readFile(linkedFoldersFilePath, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed.filter(isLinkedFolderRecord) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return inferLinkedFoldersFromDocuments(await readLocalDocuments());
    }

    throw error;
  }
}

async function writeLinkedFolders(folders: LinkedLocalFolderRecord[]) {
  await ensureLocalDataDirectory();
  await writeFile(linkedFoldersFilePath, `${JSON.stringify(folders, null, 2)}\n`, "utf8");
}

async function mutateLocalDocuments<T>(
  mutator: (documents: LocalDocumentRecord[]) => Promise<T> | T
) {
  const previousMutation = localDocumentsMutationQueue;
  let releaseMutation: () => void = () => undefined;
  localDocumentsMutationQueue = new Promise<void>((resolve) => {
    releaseMutation = resolve;
  });

  await previousMutation;

  try {
    const documents = await readLocalDocuments();
    const result = await mutator(documents);
    await writeLocalDocuments(documents);

    return result;
  } finally {
    releaseMutation();
  }
}

function timestampForFileName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isLocalDocumentRecord(value: unknown): value is LocalDocumentRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<LocalDocumentRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.fileName === "string" &&
    typeof record.fileType === "string" &&
    typeof record.mimeType === "string" &&
    typeof record.localFilePath === "string" &&
    typeof record.storagePath === "string" &&
    typeof record.createdAt === "string"
  );
}

function isLinkedFolderRecord(value: unknown): value is LinkedLocalFolderRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<LinkedLocalFolderRecord>;

  return (
    typeof record.path === "string" &&
    typeof record.connectedAt === "string" &&
    typeof record.lastSyncedAt === "string" &&
    typeof record.importedCount === "number" &&
    typeof record.skippedCount === "number"
  );
}

function inferLinkedFoldersFromDocuments(
  documents: LocalDocumentRecord[]
): LinkedLocalFolderRecord[] {
  const folderPaths = Array.from(
    new Set(
      documents
        .filter((document) => document.sourceKind === "linked_folder")
        .map((document) => path.dirname(document.localFilePath))
    )
  );
  const now = new Date().toISOString();

  return folderPaths.map((folderPath) => ({
    path: folderPath,
    connectedAt: now,
    lastSyncedAt: now,
    importedCount: 0,
    skippedCount: 0
  }));
}

function toPublicDocument(record: LocalDocumentRecord): DocumentRecord {
  const extractedText = record.extraction?.extractedText ?? "";
  const textQuality = evaluateTextQuality(extractedText);

  return {
    id: record.id,
    title: record.title,
    fileName: record.fileName,
    fileType: record.fileType,
    documentType: record.documentType,
    sizeBytes: record.sizeBytes,
    status: record.status,
    storagePath: record.storagePath,
    createdAt: record.createdAt,
    sourceKind: record.sourceKind,
    sourceStatus: record.sourceStatus,
    sourceCheckedAt: record.sourceCheckedAt,
    localFilePath: record.localFilePath,
    analysisQuality: textQuality.quality,
    analysisTextLength: textQuality.textLength,
    analysisReadableRatio: textQuality.readableRatio,
    analysisBrokenCharRatio: textQuality.brokenCharRatio,
    riskCount: record.risks?.length ?? 0,
    deadlineCount: record.deadlines?.length ?? 0
  };
}

export async function listLocalDocuments(): Promise<DocumentRecord[]> {
  const documents = await readLocalDocuments();

  return documents
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map(toPublicDocument);
}

export async function getLocalDocument(documentId: string): Promise<DocumentRecord | null> {
  const documents = await listLocalDocuments();

  return documents.find((document) => document.id === documentId) ?? null;
}

export async function getLocalDocumentDetail(
  documentId: string
): Promise<DocumentDetailRecord | null> {
  const documents = await readLocalDocuments();
  const document = documents.find((entry) => entry.id === documentId);

  if (!document) {
    return null;
  }

  return {
    ...toPublicDocument(document),
    extraction: document.extraction ?? null,
    contractAnalysis: document.contractAnalysis ?? null,
    risks: document.risks ?? [],
    deadlines: document.deadlines ?? []
  };
}

export async function listLocalDocumentDetails(): Promise<DocumentDetailRecord[]> {
  const documents = await readLocalDocuments();

  return documents
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((document) => ({
      ...toPublicDocument(document),
      extraction: document.extraction ?? null,
      contractAnalysis: document.contractAnalysis ?? null,
      risks: document.risks ?? [],
      deadlines: document.deadlines ?? []
    }));
}

export async function readLocalDocumentFile(documentId: string) {
  const documents = await readLocalDocuments();
  const document = documents.find((entry) => entry.id === documentId);

  if (!document) {
    throw new Error("Dokument wurde lokal nicht gefunden.");
  }

  return {
    document,
    fileBuffer: await readFile(document.localFilePath)
  };
}

export async function updateLocalDocumentAnalysis(
  documentId: string,
  update: {
    documentType: string;
    status: string;
    extraction: DocumentExtractionRecord;
    risks: DocumentRiskRecord[];
    deadlines: DocumentDeadlineRecord[];
  }
) {
  await mutateLocalDocuments((documents) => {
    const documentIndex = documents.findIndex((entry) => entry.id === documentId);

    if (documentIndex === -1) {
      throw new Error("Dokument wurde lokal nicht gefunden.");
    }

    documents[documentIndex] = {
      ...documents[documentIndex],
      documentType: update.documentType,
      status: update.status,
      extraction: update.extraction,
      risks: update.risks,
      deadlines: update.deadlines
    };
  });
}

export async function updateLocalDocumentFindings(
  documentId: string,
  update: {
    risks?: DocumentRiskRecord[];
    deadlines?: DocumentDeadlineRecord[];
  }
) {
  await mutateLocalDocuments((documents) => {
    const documentIndex = documents.findIndex((entry) => entry.id === documentId);

    if (documentIndex === -1) {
      throw new Error("Dokument wurde lokal nicht gefunden.");
    }

    documents[documentIndex] = {
      ...documents[documentIndex],
      risks: update.risks ?? documents[documentIndex].risks,
      deadlines: update.deadlines ?? documents[documentIndex].deadlines
    };
  });
}

export async function createLocalDocumentsBackup() {
  const documents = await readLocalDocuments();

  return {
    fileName: `smart-dis-ai-local-backup-${timestampForFileName()}.json`,
    documentCount: documents.length,
    content: `${JSON.stringify(
      {
        product: "SMART DIS-AI",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        documents
      },
      null,
      2
    )}\n`
  };
}

export async function restoreLocalDocumentsBackup(
  backupContent: string
): Promise<LocalBackupRestoreResult> {
  const parsed = JSON.parse(backupContent) as unknown;
  const documentsSource =
    parsed && typeof parsed === "object" && "documents" in parsed
      ? (parsed as { documents?: unknown }).documents
      : parsed;

  if (!Array.isArray(documentsSource)) {
    throw new Error("Die Sicherungsdatei enthält keine Dokumentenliste.");
  }

  const documents = documentsSource.filter(isLocalDocumentRecord);

  if (documents.length !== documentsSource.length) {
    throw new Error("Die Sicherungsdatei enthält ungültige Dokumenteinträge.");
  }

  await ensureLocalDataDirectory();

  let backupPath: string | null = null;

  try {
    await stat(documentsFilePath);
    backupPath = path.join(
      localDataDirectory,
      `documents.backup-before-restore-${timestampForFileName()}.json`
    );
    await copyFile(documentsFilePath, backupPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  await writeLocalDocuments(documents);

  return {
    documentCount: documents.length,
    backupPath
  };
}

export async function saveLocalUploadedDocument({
  documentId,
  title,
  safeFileName,
  fileType,
  mimeType,
  sizeBytes,
  file
}: {
  documentId: string;
  title: string;
  safeFileName: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  file: File;
}): Promise<DocumentRecord> {
  await ensureLocalDataDirectory();

  const documentDirectory = path.join(uploadsDirectory, documentId);
  await mkdir(documentDirectory, { recursive: true });

  const localFilePath = path.join(documentDirectory, safeFileName);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(localFilePath, Buffer.from(arrayBuffer));

  const createdAt = new Date().toISOString();
  const storagePath = `local/${documentId}/${safeFileName}`;
  const document: LocalDocumentRecord = {
    id: documentId,
    title,
    fileName: safeFileName,
    fileType,
    mimeType,
    documentType: "other",
    sizeBytes,
    status: "uploaded",
    storagePath,
    localFilePath,
    sourceKind: "upload",
    sourceStatus: "available",
    sourceCheckedAt: createdAt,
    createdAt
  };

  const documents = await readLocalDocuments();
  documents.push(document);
  await writeLocalDocuments(documents);

  return toPublicDocument(document);
}

function getFileExtension(filePath: string) {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

function isAllowedFileExtension(
  extension: string
): extension is (typeof allowedFileExtensions)[number] {
  return allowedFileExtensions.includes(extension as (typeof allowedFileExtensions)[number]);
}

async function collectLocalFolderFiles(folderPath: string) {
  const collectedFiles: string[] = [];
  const pendingDirectories = [folderPath];

  while (pendingDirectories.length > 0 && collectedFiles.length < maxLocalFolderFiles) {
    const currentDirectory = pendingDirectories.shift();

    if (!currentDirectory) {
      continue;
    }

    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        collectedFiles.push(entryPath);
      }

      if (collectedFiles.length >= maxLocalFolderFiles) {
        break;
      }
    }
  }

  return collectedFiles;
}

export async function importLocalFolderDocuments(
  folderPath: string
): Promise<LocalFolderImportResult> {
  const resolvedFolderPath = path.resolve(folderPath);
  const folderStats = await stat(resolvedFolderPath);

  if (!folderStats.isDirectory()) {
    throw new Error("Der angegebene Pfad ist kein Ordner.");
  }

  const existingDocuments = await readLocalDocuments();
  const existingPaths = new Set(existingDocuments.map((document) => document.localFilePath));
  const files = await collectLocalFolderFiles(resolvedFolderPath);
  const createdDocuments: LocalDocumentRecord[] = [];
  const skipped: LocalFolderImportResult["skipped"] = [];

  for (const filePath of files) {
    const extension = getFileExtension(filePath);

    if (!isAllowedFileExtension(extension)) {
      skipped.push({ filePath, reason: "Dateityp nicht unterstützt." });
      continue;
    }

    if (existingPaths.has(filePath)) {
      skipped.push({ filePath, reason: "Datei ist bereits verbunden." });
      continue;
    }

    const fileStats = await stat(filePath);

    if (fileStats.size <= 0) {
      skipped.push({ filePath, reason: "Datei ist leer." });
      continue;
    }

    if (fileStats.size > maxUploadSizeInBytes) {
      skipped.push({ filePath, reason: "Datei ist größer als 25 MB." });
      continue;
    }

    const documentId = crypto.randomUUID();
    const fileName = path.basename(filePath);
    const document: LocalDocumentRecord = {
      id: documentId,
      title: fileName.replace(/\.[^.]+$/, "").slice(0, 160),
      fileName,
      fileType: extension,
      mimeType: mimeTypeByExtension[extension],
      documentType: "other",
      sizeBytes: fileStats.size,
      status: "linked",
      storagePath: `local-folder/${documentId}/${fileName}`,
      localFilePath: filePath,
      sourceKind: "linked_folder",
      sourceStatus: "available",
      sourceCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    createdDocuments.push(document);
    existingPaths.add(filePath);
  }

  if (createdDocuments.length > 0) {
    await writeLocalDocuments([...existingDocuments, ...createdDocuments]);
  }

  await upsertLinkedFolder({
    folderPath: resolvedFolderPath,
    importedCount: createdDocuments.length,
    skippedCount: skipped.length
  });

  return {
    documents: createdDocuments.map(toPublicDocument),
    skipped
  };
}

async function upsertLinkedFolder({
  folderPath,
  importedCount,
  skippedCount
}: {
  folderPath: string;
  importedCount: number;
  skippedCount: number;
}) {
  const folders = await readLinkedFolders();
  const existingIndex = folders.findIndex((folder) => folder.path === folderPath);
  const now = new Date().toISOString();
  const nextFolder: LinkedLocalFolderRecord = {
    path: folderPath,
    connectedAt: existingIndex >= 0 ? folders[existingIndex].connectedAt : now,
    lastSyncedAt: now,
    importedCount,
    skippedCount
  };

  if (existingIndex >= 0) {
    folders[existingIndex] = nextFolder;
  } else {
    folders.push(nextFolder);
  }

  await writeLinkedFolders(folders.sort((left, right) => left.path.localeCompare(right.path)));
}

export async function listLinkedLocalFolders() {
  return readLinkedFolders();
}

async function updateLinkedFolderSourceAvailability() {
  const now = new Date().toISOString();
  const missingSources: LocalFolderSyncResult["missingSources"] = [];
  const restoredSources: LocalFolderSyncResult["restoredSources"] = [];

  await mutateLocalDocuments(async (documents) => {
    for (const document of documents) {
      if (document.sourceKind !== "linked_folder") {
        continue;
      }

      const previousSourceStatus = document.sourceStatus ?? "available";

      try {
        await stat(document.localFilePath);
        document.sourceStatus = "available";
        document.sourceCheckedAt = now;

        if (previousSourceStatus === "missing") {
          restoredSources.push({
            documentId: document.id,
            title: document.title,
            fileName: document.fileName,
            filePath: document.localFilePath
          });
        }
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
          throw error;
        }

        document.sourceStatus = "missing";
        document.sourceCheckedAt = now;
        missingSources.push({
          documentId: document.id,
          title: document.title,
          fileName: document.fileName,
          filePath: document.localFilePath
        });
      }
    }
  });

  return {
    missingSources,
    restoredSources
  };
}

export async function syncLinkedLocalFolders(): Promise<LocalFolderSyncResult> {
  const folders = await readLinkedFolders();
  const result: LocalFolderSyncResult = {
    folders: [] as LinkedLocalFolderRecord[],
    importedCount: 0,
    skippedCount: 0,
    failed: [] as Array<{ path: string; error: string }>,
    importedDocuments: [],
    skippedFiles: [],
    missingSources: [],
    restoredSources: []
  };

  for (const folder of folders) {
    try {
      const syncResult = await importLocalFolderDocuments(folder.path);
      result.importedCount += syncResult.documents.length;
      result.skippedCount += syncResult.skipped.length;
      result.importedDocuments.push(
        ...syncResult.documents.map((document) => ({
          id: document.id,
          title: document.title,
          fileName: document.fileName,
          filePath: document.localFilePath ?? document.storagePath
        }))
      );
      result.skippedFiles.push(
        ...syncResult.skipped.map((skippedFile) => ({
          folderPath: folder.path,
          filePath: skippedFile.filePath,
          reason: skippedFile.reason
        }))
      );
    } catch (error) {
      result.failed.push({
        path: folder.path,
        error: error instanceof Error ? error.message : "Ordner konnte nicht synchronisiert werden."
      });
    }
  }

  const sourceAvailability = await updateLinkedFolderSourceAvailability();
  result.missingSources = sourceAvailability.missingSources;
  result.restoredSources = sourceAvailability.restoredSources;
  result.folders = await readLinkedFolders();

  return result;
}

export async function browseLocalDirectories(
  folderPath?: string
): Promise<LocalDirectoryBrowserResult> {
  const currentPath = path.resolve(folderPath?.trim() || os.homedir());
  const folderStats = await stat(currentPath);

  if (!folderStats.isDirectory()) {
    throw new Error("Der angegebene Pfad ist kein Ordner.");
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: path.join(currentPath, entry.name)
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "de"));
  const parentPath = path.dirname(currentPath);

  return {
    currentPath,
    parentPath: parentPath === currentPath ? null : parentPath,
    directories
  };
}

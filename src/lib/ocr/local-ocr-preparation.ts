import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OcrJobRecord, OcrJobStatus } from "@/domain/ocr";
import { evaluateTextQuality } from "@/lib/analysis/text-quality";
import { getLocalDocumentDetail } from "@/lib/documents/local-document-store";
import { getLocalDataDirectory } from "@/lib/local-data-path";

const localDataDirectory = getLocalDataDirectory();
const ocrJobsFilePath = path.join(localDataDirectory, "ocr-jobs.json");

async function ensureLocalDataDirectory() {
  await mkdir(localDataDirectory, { recursive: true });
}

function isOcrJobRecord(value: unknown): value is OcrJobRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<OcrJobRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.documentId === "string" &&
    typeof record.documentTitle === "string" &&
    typeof record.fileName === "string" &&
    typeof record.fileType === "string" &&
    typeof record.sourcePath === "string" &&
    typeof record.status === "string" &&
    typeof record.reason === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

async function readOcrJobs(): Promise<OcrJobRecord[]> {
  await ensureLocalDataDirectory();

  try {
    const content = await readFile(ocrJobsFilePath, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed.filter(isOcrJobRecord) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeOcrJobs(jobs: OcrJobRecord[]) {
  await ensureLocalDataDirectory();
  await writeFile(ocrJobsFilePath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
}

function getRecommendedProvider(fileType: string, sourceKind: string) {
  if (fileType !== "pdf") {
    return "manual_review";
  }

  if (sourceKind === "linked_folder") {
    return "local_tesseract";
  }

  return "cloud_ocr";
}

export async function getLocalOcrJob(documentId: string) {
  const jobs = await readOcrJobs();

  return jobs.find((job) => job.documentId === documentId) ?? null;
}

export async function updateLocalOcrJob(
  documentId: string,
  update: {
    status?: OcrJobStatus;
    reason?: string;
  }
) {
  const jobs = await readOcrJobs();
  const jobIndex = jobs.findIndex((job) => job.documentId === documentId);

  if (jobIndex === -1) {
    return null;
  }

  const nextJob: OcrJobRecord = {
    ...jobs[jobIndex],
    status: update.status ?? jobs[jobIndex].status,
    reason: update.reason ?? jobs[jobIndex].reason,
    updatedAt: new Date().toISOString()
  };

  jobs[jobIndex] = nextJob;
  await writeOcrJobs(jobs);

  return nextJob;
}

export async function prepareLocalOcrJob(documentId: string): Promise<OcrJobRecord> {
  const document = await getLocalDocumentDetail(documentId);

  if (!document) {
    throw new Error("Dokument wurde lokal nicht gefunden.");
  }

  const textQuality = evaluateTextQuality(document.extraction?.extractedText);
  const needsOcr = document.status === "needs_ocr" || textQuality.quality === "needs_ocr";

  if (!needsOcr) {
    throw new Error("Dieses Dokument benötigt nach aktueller Textqualitätsprüfung keine OCR.");
  }

  const now = new Date().toISOString();
  const jobs = await readOcrJobs();
  const existingJob = jobs.find((job) => job.documentId === document.id);
  const nextJob: OcrJobRecord = {
    id: existingJob?.id ?? crypto.randomUUID(),
    documentId: document.id,
    documentTitle: document.title,
    fileName: document.fileName,
    fileType: document.fileType,
    sourceKind: document.sourceKind ?? "storage",
    sourcePath: document.localFilePath ?? document.storagePath,
    status: "prepared",
    reason:
      "Die Textqualitätsprüfung hat zu viele defekte Zeichen oder zu wenig verlässlichen Inhalt erkannt.",
    recommendedProvider: getRecommendedProvider(
      document.fileType,
      document.sourceKind ?? "storage"
    ),
    textLength: textQuality.textLength,
    readableRatio: textQuality.readableRatio,
    brokenCharRatio: textQuality.brokenCharRatio,
    createdAt: existingJob?.createdAt ?? now,
    updatedAt: now
  };

  const nextJobs = existingJob
    ? jobs.map((job) => (job.documentId === document.id ? nextJob : job))
    : [nextJob, ...jobs];

  await writeOcrJobs(nextJobs);

  return nextJob;
}

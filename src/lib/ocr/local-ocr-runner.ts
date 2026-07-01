import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { DocumentExtractionRecord } from "@/domain/document-record";
import {
  analyzeLocalDeadlines,
  analyzeLocalRisks,
  classifyLocalDocument
} from "@/lib/analysis/local-document-analysis";
import { evaluateTextQuality } from "@/lib/analysis/text-quality";
import {
  readLocalDocumentFile,
  updateLocalDocumentAnalysis
} from "@/lib/documents/local-document-store";
import {
  getLocalOcrJob,
  prepareLocalOcrJob,
  updateLocalOcrJob
} from "@/lib/ocr/local-ocr-preparation";

const execFileAsync = promisify(execFile);
const defaultMaxOcrPages = 5;
const defaultOcrDpi = 300;
const pageSegmentationModes = ["6", "4", "11"] as const;

type LocalOcrRunResult = {
  documentId: string;
  extractedTextLength: number;
  processedPages: number;
  status: string;
  documentType: string;
  riskCount: number;
  deadlineCount: number;
  pages: NonNullable<DocumentExtractionRecord["ocrPages"]>;
};

export type LocalOcrOptions = {
  maxPages?: number;
  dpi?: number;
};

function getBoundedInteger(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getOcrOptions(options: LocalOcrOptions = {}) {
  return {
    maxPages: getBoundedInteger(
      options.maxPages ?? process.env.LOCAL_OCR_MAX_PAGES,
      defaultMaxOcrPages,
      1,
      25
    ),
    dpi: getBoundedInteger(options.dpi ?? process.env.LOCAL_OCR_DPI, defaultOcrDpi, 150, 450)
  };
}

async function executableWorks(command: string, args: string[]) {
  try {
    await execFileAsync(command, args, { timeout: 5000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutable(candidates: string[], probeArgs: string[]) {
  for (const candidate of candidates) {
    if (await executableWorks(candidate, probeArgs)) {
      return candidate;
    }
  }

  return null;
}

async function getPdfToPpmExecutable() {
  return resolveExecutable(
    [
      process.env.PDFTOPPM_PATH ?? "",
      "/Users/bernhard/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm",
      "/opt/homebrew/bin/pdftoppm",
      "/usr/local/bin/pdftoppm",
      "pdftoppm"
    ].filter(Boolean),
    ["-v"]
  );
}

async function getTesseractExecutable() {
  return resolveExecutable(
    [
      process.env.TESSERACT_PATH ?? "",
      "/opt/homebrew/bin/tesseract",
      "/usr/local/bin/tesseract",
      "tesseract"
    ].filter(Boolean),
    ["--version"]
  );
}

function createOcrSummary(fileName: string, text: string, processedPages: number, dpi: number) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
  const preview = lines.slice(0, 3).join(" ");

  if (preview.length > 0) {
    return `OCR wurde für ${processedPages} Seite(n) mit ${dpi} DPI ausgeführt. ${preview.slice(0, 620)}`;
  }

  return `OCR wurde für ${processedPages} Seite(n) mit ${dpi} DPI ausgeführt, hat aber keinen belastbaren Text aus ${fileName} extrahiert.`;
}

async function renderPdfPagesToPng(
  pdfBuffer: Buffer,
  workspacePath: string,
  maxPages: number,
  dpi: number
) {
  const pdftoppm = await getPdfToPpmExecutable();

  if (!pdftoppm) {
    throw new Error(
      "pdftoppm wurde nicht gefunden. Bitte Poppler installieren oder PDFTOPPM_PATH setzen."
    );
  }

  const pdfPath = path.join(workspacePath, "source.pdf");
  const outputPrefix = path.join(workspacePath, "page");
  await writeFile(pdfPath, pdfBuffer);

  await execFileAsync(
    pdftoppm,
    ["-f", "1", "-l", String(maxPages), "-r", String(dpi), "-gray", "-png", pdfPath, outputPrefix],
    {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 20
    }
  );

  const files = await readdir(workspacePath);

  return files
    .filter((file) => /^page-\d+\.png$/.test(file))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((file) => path.join(workspacePath, file));
}

async function ocrImageWithPsm(imagePath: string, tesseract: string, psm: string, dpi: number) {
  const result = await execFileAsync(
    tesseract,
    [imagePath, "stdout", "-l", "deu+eng", "--psm", psm, "--dpi", String(dpi)],
    {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 20
    }
  );

  return result.stdout.trim();
}

async function ocrImage(imagePath: string, tesseract: string, dpi: number) {
  const candidates: Array<{ text: string; score: number }> = [];

  for (const psm of pageSegmentationModes) {
    const text = await ocrImageWithPsm(imagePath, tesseract, psm, dpi);
    const quality = evaluateTextQuality(text);
    const score =
      quality.readableRatio * 100 -
      quality.brokenCharRatio * 120 +
      Math.min(text.length, 4000) / 200;
    candidates.push({ text, score });
  }

  candidates.sort((left, right) => right.score - left.score);

  return candidates[0]?.text.trim() ?? "";
}

export async function runLocalOcrForDocument(
  documentId: string,
  options: LocalOcrOptions = {}
): Promise<LocalOcrRunResult> {
  const { document, fileBuffer } = await readLocalDocumentFile(documentId);

  if (document.fileType !== "pdf") {
    throw new Error("Lokale OCR ist im MVP nur für PDF-Dokumente aktiviert.");
  }

  await ((await getLocalOcrJob(documentId)) ?? prepareLocalOcrJob(documentId));
  await updateLocalOcrJob(documentId, {
    status: "processing",
    reason: "OCR wird lokal mit Tesseract vorbereitet und ausgeführt."
  });
  const tesseract = await getTesseractExecutable();

  if (!tesseract) {
    throw new Error(
      "Tesseract wurde nicht gefunden. Bitte TESSERACT_PATH setzen oder Tesseract installieren."
    );
  }

  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "smart-dis-ai-ocr-"));
  const ocrOptions = getOcrOptions(options);

  try {
    const pageImages = await renderPdfPagesToPng(
      fileBuffer,
      workspacePath,
      ocrOptions.maxPages,
      ocrOptions.dpi
    );

    if (pageImages.length === 0) {
      throw new Error("PDF konnte nicht in OCR-Seitenbilder umgewandelt werden.");
    }

    const pageTexts: string[] = [];

    for (const pageImage of pageImages) {
      pageTexts.push(await ocrImage(pageImage, tesseract, ocrOptions.dpi));
    }

    const ocrPages = pageTexts.map((pageText, index) => {
      const quality = evaluateTextQuality(pageText);

      return {
        page: index + 1,
        textLength: quality.textLength,
        readableRatio: quality.readableRatio,
        brokenCharRatio: quality.brokenCharRatio,
        quality: quality.quality
      };
    });

    const extractedText = pageTexts
      .map((pageText, index) => `--- OCR Seite ${index + 1} ---\n${pageText}`)
      .join("\n\n")
      .trim();
    const textQuality = evaluateTextQuality(extractedText);
    const classification = classifyLocalDocument(document.fileName, extractedText);
    const status =
      textQuality.quality === "needs_ocr" || textQuality.quality === "none"
        ? "needs_ocr"
        : "indexed";
    const analysisText = `${document.fileName}\n${extractedText}`;
    const risks = status === "indexed" ? analyzeLocalRisks(document.id, analysisText) : [];
    const deadlines = status === "indexed" ? analyzeLocalDeadlines(document.id, analysisText) : [];
    const now = new Date().toISOString();
    const extraction: DocumentExtractionRecord = {
      id: crypto.randomUUID(),
      documentId: document.id,
      summary: createOcrSummary(
        document.fileName,
        extractedText,
        pageImages.length,
        ocrOptions.dpi
      ),
      extractedText,
      classifiedDocumentType: classification.documentType,
      classifiedDocumentTypeConfidence: classification.confidence,
      classifiedDocumentTypeReason: classification.reason,
      confidence: status === "indexed" ? 0.72 : 0.38,
      analysisModel: "local-tesseract-ocr",
      promptVersion: "ocr-local-2026-06-30",
      ocrPages,
      createdAt: now,
      updatedAt: now
    };

    await updateLocalDocumentAnalysis(document.id, {
      documentType: classification.documentType,
      status,
      extraction,
      risks,
      deadlines
    });

    await updateLocalOcrJob(documentId, {
      status: status === "indexed" ? "completed" : "failed",
      reason:
        status === "indexed"
          ? `OCR wurde für ${pageImages.length} Seite(n) mit ${ocrOptions.dpi} DPI erfolgreich ausgeführt.`
          : "OCR wurde ausgeführt, die Textqualität ist aber weiterhin nicht belastbar."
    });

    return {
      documentId: document.id,
      extractedTextLength: extractedText.length,
      processedPages: pageImages.length,
      status,
      documentType: classification.documentType,
      riskCount: risks.length,
      deadlineCount: deadlines.length,
      pages: ocrPages
    };
  } catch (error) {
    await updateLocalOcrJob(documentId, {
      status: "failed",
      reason: error instanceof Error ? error.message : "OCR konnte nicht ausgeführt werden."
    });
    throw error;
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
}

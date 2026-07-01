import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { readLocalDocumentFile } from "@/lib/documents/local-document-store";

const execFileAsync = promisify(execFile);

async function executableWorks(command: string, args: string[]) {
  try {
    await execFileAsync(command, args, { timeout: 5000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function getPdfToPpmExecutable() {
  const candidates = [
    process.env.PDFTOPPM_PATH ?? "",
    "/Users/bernhard/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm",
    "/opt/homebrew/bin/pdftoppm",
    "/usr/local/bin/pdftoppm",
    "pdftoppm"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await executableWorks(candidate, ["-v"])) {
      return candidate;
    }
  }

  return null;
}

function getBoundedInteger(value: number, fallback: number, min: number, max: number) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export async function renderLocalOcrPreviewPage({
  documentId,
  page,
  dpi
}: {
  documentId: string;
  page: number;
  dpi: number;
}) {
  const { document, fileBuffer } = await readLocalDocumentFile(documentId);

  if (document.fileType !== "pdf") {
    throw new Error("OCR-Seitenvorschau ist nur für PDF-Dokumente verfügbar.");
  }

  const pdftoppm = await getPdfToPpmExecutable();

  if (!pdftoppm) {
    throw new Error("pdftoppm wurde nicht gefunden. Bitte Poppler installieren.");
  }

  const safePage = getBoundedInteger(page, 1, 1, 200);
  const safeDpi = getBoundedInteger(dpi, 180, 100, 350);
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "smart-dis-ai-preview-"));

  try {
    const pdfPath = path.join(workspacePath, "source.pdf");
    const outputPrefix = path.join(workspacePath, "preview");
    await writeFile(pdfPath, fileBuffer);

    await execFileAsync(
      pdftoppm,
      [
        "-f",
        String(safePage),
        "-l",
        String(safePage),
        "-singlefile",
        "-r",
        String(safeDpi),
        "-png",
        pdfPath,
        outputPrefix
      ],
      {
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 20
      }
    );

    return await readFile(path.join(workspacePath, "preview.png"));
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
}

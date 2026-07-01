import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import type { SupportedFileType } from "@/domain/documents";

export type ExtractedDocumentText = {
  text: string;
  pageCount?: number;
};

function normalizeWhitespace(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripXml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}

function extractReadablePdfFallback(fileBuffer: Buffer) {
  const utf8Text = fileBuffer.toString("utf8");
  const utf16Text = fileBuffer
    .toString("utf16le")
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]€%/+-]/gu, " ");
  const literalPdfStrings = Array.from(utf8Text.matchAll(/\(([^()]{8,})\)/g))
    .map((match) => match[1])
    .join("\n");
  const readableRuns = utf8Text
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]€%/+-]/gu, " ")
    .split(/\s{2,}/)
    .filter((part) => /[A-Za-zÄÖÜäöüß]/.test(part) && part.trim().length > 12)
    .slice(0, 1200)
    .join("\n");

  return normalizeWhitespace([literalPdfStrings, readableRuns, utf16Text].join("\n"));
}

async function extractTextFromXlsx(fileBuffer: Buffer) {
  const archive = await JSZip.loadAsync(fileBuffer);
  const sharedStringsXml = await archive.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings =
    sharedStringsXml
      ?.match(/<si[\s\S]*?<\/si>/g)
      ?.map((entry) => stripXml(entry))
      .filter(Boolean) ?? [];
  const sheetNames = Object.keys(archive.files)
    .filter((fileName) => /^xl\/worksheets\/sheet\d+\.xml$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));
  const sheetTexts: string[] = [];

  for (const sheetName of sheetNames) {
    const sheetXml = await archive.file(sheetName)?.async("text");

    if (!sheetXml) {
      continue;
    }

    const values =
      sheetXml
        .match(/<c\b[\s\S]*?<\/c>/g)
        ?.map((cell) => {
          const rawValue = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1]?.trim();

          if (!rawValue) {
            return "";
          }

          if (cell.includes(' t="s"')) {
            return sharedStrings[Number(rawValue)] ?? rawValue;
          }

          return rawValue;
        })
        .filter(Boolean) ?? [];

    if (values.length > 0) {
      sheetTexts.push(values.join(" | "));
    }
  }

  return normalizeWhitespace(sheetTexts.join("\n"));
}

export async function extractTextFromBuffer(
  fileType: SupportedFileType,
  fileBuffer: Buffer
): Promise<ExtractedDocumentText> {
  if (fileType === "txt" || fileType === "csv") {
    return {
      text: normalizeWhitespace(fileBuffer.toString("utf-8"))
    };
  }

  if (fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });

    return {
      text: normalizeWhitespace(result.value)
    };
  }

  if (fileType === "pdf") {
    const parser = new PDFParse({ data: fileBuffer });

    try {
      const result = await parser.getText();

      return {
        text: normalizeWhitespace(result.text),
        pageCount: result.total
      };
    } catch (error) {
      const fallbackText = extractReadablePdfFallback(fileBuffer);

      if (fallbackText.length < 20) {
        throw error;
      }

      return {
        text: fallbackText
      };
    } finally {
      await parser.destroy();
    }
  }

  if (fileType === "xlsx") {
    return {
      text: await extractTextFromXlsx(fileBuffer)
    };
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

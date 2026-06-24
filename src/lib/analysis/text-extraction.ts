import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
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

export async function extractTextFromBuffer(
  fileType: SupportedFileType,
  fileBuffer: Buffer
): Promise<ExtractedDocumentText> {
  if (fileType === "txt") {
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
    const result = await parser.getText();
    await parser.destroy();

    return {
      text: normalizeWhitespace(result.text),
      pageCount: result.total
    };
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

export const ocrJobStatuses = ["prepared", "processing", "completed", "failed"] as const;

export type OcrJobStatus = (typeof ocrJobStatuses)[number];

export type OcrJobRecord = {
  id: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  fileType: string;
  sourceKind: "upload" | "linked_folder" | "storage";
  sourcePath: string;
  status: OcrJobStatus;
  reason: string;
  recommendedProvider: "local_tesseract" | "cloud_ocr" | "manual_review";
  textLength: number;
  readableRatio: number;
  brokenCharRatio: number;
  createdAt: string;
  updatedAt: string;
};

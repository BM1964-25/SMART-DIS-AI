export const supportedFileTypes = ["pdf", "docx", "txt"] as const;

export type SupportedFileType = (typeof supportedFileTypes)[number];

export const plannedFileTypes = ["eml", "pptx", "ocr"] as const;

export type PlannedFileType = (typeof plannedFileTypes)[number];

export const documentTypes = [
  "contract",
  "proposal",
  "invoice",
  "minutes",
  "policy",
  "other"
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels: Record<DocumentType, string> = {
  contract: "Verträge",
  proposal: "Angebote",
  invoice: "Rechnungen",
  minutes: "Protokolle",
  policy: "Richtlinien",
  other: "Sonstige"
};

export const analysisStatuses = ["queued", "processing", "completed", "failed"] as const;

export type AnalysisStatus = (typeof analysisStatuses)[number];

export const analysisPipelineSteps = [
  "Upload",
  "Text Extraction",
  "Dokumentklassifizierung",
  "Information Extraction",
  "Risikoanalyse",
  "Fristenerkennung",
  "Chunking",
  "Embeddings",
  "pgvector",
  "Chat",
  "Dashboard"
] as const;

export type AnalysisPipelineStep = (typeof analysisPipelineSteps)[number];

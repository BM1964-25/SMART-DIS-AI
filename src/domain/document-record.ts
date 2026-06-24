export type DocumentRecord = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  documentType: string;
  sizeBytes: number;
  status: string;
  storagePath: string;
  createdAt: string;
};

export type DocumentExtractionRecord = {
  id: string;
  documentId: string;
  summary: string | null;
  extractedText: string | null;
  classifiedDocumentType: string | null;
  confidence: number | null;
  analysisModel: string | null;
  promptVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractAnalysisRecord = {
  id: string;
  documentId: string;
  contractPartners: string[];
  contractStart: string | null;
  contractEnd: string | null;
  terminationNotice: string | null;
  contractValueAmount: number | null;
  contractValueCurrency: string | null;
  paymentTerms: string | null;
  contractualPenalties: string | null;
  liability: string | null;
  automaticRenewal: string | null;
  confidence: number | null;
  analysisModel: string | null;
  promptVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRiskRecord = {
  id: string;
  documentId: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  riskScore: number | null;
  sourceExcerpt: string | null;
  confidence: number | null;
  isReviewed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDeadlineRecord = {
  id: string;
  documentId: string;
  title: string;
  deadlineDate: string;
  deadlineType: string;
  status: string;
  sourceExcerpt: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDetailRecord = DocumentRecord & {
  extraction: DocumentExtractionRecord | null;
  contractAnalysis: ContractAnalysisRecord | null;
  risks: DocumentRiskRecord[];
  deadlines: DocumentDeadlineRecord[];
};

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  document_type: string;
  size_bytes: number;
  status: string;
  storage_path: string;
  created_at: string;
};

export function mapDocumentRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    fileType: row.file_type,
    documentType: row.document_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    storagePath: row.storage_path,
    createdAt: row.created_at
  };
}

type ExtractionRow = {
  id: string;
  document_id: string;
  summary: string | null;
  extracted_text: string | null;
  classified_document_type: string | null;
  confidence: number | null;
  analysis_model: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
};

export function mapExtractionRow(row: ExtractionRow): DocumentExtractionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    summary: row.summary,
    extractedText: row.extracted_text,
    classifiedDocumentType: row.classified_document_type,
    confidence: row.confidence,
    analysisModel: row.analysis_model,
    promptVersion: row.prompt_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type ContractAnalysisRow = {
  id: string;
  document_id: string;
  contract_partners: unknown;
  contract_start: string | null;
  contract_end: string | null;
  termination_notice: string | null;
  contract_value_amount: number | null;
  contract_value_currency: string | null;
  payment_terms: string | null;
  contractual_penalties: string | null;
  liability: string | null;
  automatic_renewal: string | null;
  confidence: number | null;
  analysis_model: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
};

function mapStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function mapContractAnalysisRow(row: ContractAnalysisRow): ContractAnalysisRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    contractPartners: mapStringArray(row.contract_partners),
    contractStart: row.contract_start,
    contractEnd: row.contract_end,
    terminationNotice: row.termination_notice,
    contractValueAmount: row.contract_value_amount,
    contractValueCurrency: row.contract_value_currency,
    paymentTerms: row.payment_terms,
    contractualPenalties: row.contractual_penalties,
    liability: row.liability,
    automaticRenewal: row.automatic_renewal,
    confidence: row.confidence,
    analysisModel: row.analysis_model,
    promptVersion: row.prompt_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type RiskRow = {
  id: string;
  document_id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  risk_score: number | null;
  source_excerpt: string | null;
  confidence: number | null;
  is_reviewed: boolean;
  created_at: string;
  updated_at: string;
};

export function mapRiskRow(row: RiskRow): DocumentRiskRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    category: row.category,
    riskScore: row.risk_score,
    sourceExcerpt: row.source_excerpt,
    confidence: row.confidence,
    isReviewed: row.is_reviewed,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type DeadlineRow = {
  id: string;
  document_id: string;
  title: string;
  deadline_date: string;
  deadline_type: string;
  status: string;
  source_excerpt: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export function mapDeadlineRow(row: DeadlineRow): DocumentDeadlineRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    deadlineDate: row.deadline_date,
    deadlineType: row.deadline_type,
    status: row.status,
    sourceExcerpt: row.source_excerpt,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

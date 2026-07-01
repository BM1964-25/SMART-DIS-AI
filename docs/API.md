# SMART DIS-AI API

## Version

`0.1.0`

## Principles

- All write endpoints must require authentication.
- All organization-scoped records must be filtered by organization membership.
- User input must be validated before database or AI processing.
- AI answers must include source references once document analysis is implemented.
- Service role secrets must never be exposed to client components.

## Current Endpoints

### `GET /api/health`

Returns the service status for deployment and smoke tests.

Response:

```json
{
  "status": "ok",
  "service": "smart-document-intelligence",
  "platform": "built-smart-ai",
  "timestamp": "2026-06-24T00:00:00.000Z"
}
```

## Planned MVP Endpoints

### `POST /api/documents/upload`

Uploads one or more files to the active storage backend and creates the corresponding document records. With full Supabase configuration this uses Supabase Storage and PostgreSQL. Without Supabase configuration local development uses `.local-data`.

Request:

```text
files: File[]
title: string optional, used only for single-file uploads
```

Validation:

- Allowed file types: PDF, DOCX, TXT, XLSX, XLS, CSV
- Maximum size: 25 MB
- Maximum files per request: 10
- File extension must match MIME type

Response:

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Rahmenvertrag Bauprojekt A",
      "fileName": "rahmenvertrag.pdf",
      "fileType": "pdf",
      "documentType": "other",
      "sizeBytes": 102400,
      "status": "uploaded",
      "storagePath": "organization-id/document-id/rahmenvertrag.pdf",
      "createdAt": "2026-06-24T00:00:00.000Z"
    }
  ],
  "failed": []
}
```

### `GET /api/documents`

Lists the latest uploaded documents for the configured bootstrap organization.

Response:

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Rahmenvertrag Bauprojekt A",
      "fileName": "rahmenvertrag.pdf",
      "fileType": "pdf",
      "documentType": "other",
      "sizeBytes": 102400,
      "status": "uploaded",
      "storagePath": "organization-id/document-id/rahmenvertrag.pdf",
      "createdAt": "2026-06-24T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/documents/local-folder`

Connects a local folder in development mode. Supported files are registered as linked local sources without uploading or copying them.

Request:

```json
{
  "folderPath": "/Users/bernhard/Documents/Projektordner"
}
```

Response:

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Projektliste",
      "fileName": "projektliste.xlsx",
      "fileType": "xlsx",
      "documentType": "other",
      "sizeBytes": 20480,
      "status": "linked",
      "storagePath": "local-folder/document-id/projektliste.xlsx",
      "createdAt": "2026-06-30T00:00:00.000Z"
    }
  ],
  "skipped": []
}
```

Security boundary:

- Local development only by default
- No background folder watching
- No upload or file copy
- Files are referenced by local path in `.local-data/documents.json`

### `GET /api/documents/{documentId}`

Returns a document with its stored extraction result, if available.

Response:

```json
{
  "document": {
    "id": "uuid",
    "title": "Rahmenvertrag Bauprojekt A",
    "fileName": "rahmenvertrag.pdf",
    "fileType": "pdf",
    "documentType": "contract",
    "sizeBytes": 102400,
    "status": "indexed",
    "storagePath": "organization-id/document-id/rahmenvertrag.pdf",
    "createdAt": "2026-06-24T00:00:00.000Z",
    "extraction": {
      "id": "uuid",
      "documentId": "uuid",
      "summary": "Kurzfassung des Dokuments.",
      "extractedText": "Volltext...",
      "classifiedDocumentType": "contract",
      "confidence": 0.91,
      "analysisModel": "gpt-4.1-mini",
      "promptVersion": "document-analysis-v1",
      "createdAt": "2026-06-24T00:00:00.000Z",
      "updatedAt": "2026-06-24T00:00:00.000Z"
    }
  }
}
```

### `POST /api/documents/{documentId}/analyze`

Downloads the stored file from Supabase Storage, extracts text, classifies the document type, creates a summary and stores the result in PostgreSQL.

This phase does not detect risks or deadlines yet.

Response:

```json
{
  "documentId": "uuid",
  "documentType": "contract",
  "summary": "Kurzfassung des Dokuments.",
  "extractedTextLength": 12000
}
```

### `POST /api/documents/{documentId}/contract-analysis`

Extracts structured contract data from the already stored extracted text. The document must be analyzed first.

Extracted fields:

- Contract partners
- Contract start
- Contract end
- Termination notice
- Contract value
- Payment terms
- Contractual penalties
- Liability
- Automatic renewals

Response:

```json
{
  "documentId": "uuid",
  "contractPartners": ["Auftraggeber GmbH", "Dienstleister AG"],
  "contractStart": "2026-01-01",
  "contractEnd": "2028-12-31"
}
```

### `POST /api/documents/{documentId}/risk-analysis`

Creates risk records from the extracted document text and optional contract analysis context. The document must be analyzed first.

Generated fields:

- Risk score
- Risk category
- Reasoning
- Severity
- Optional source excerpt

Response:

```json
{
  "documentId": "uuid",
  "riskCount": 3,
  "maxRiskScore": 82
}
```

### `POST /api/documents/{documentId}/deadline-analysis`

Detects deadlines from the extracted document text and optional contract context. The document must be analyzed first.

Detected deadline types:

- Kündigungsfrist
- Vertragsende
- Zahlungsfrist
- Projekttermin

Response:

```json
{
  "documentId": "uuid",
  "deadlineCount": 4
}
```

### `POST /api/documents/{documentId}/semantic-index`

Chunks the extracted document text, creates OpenAI embeddings and stores them in `document_chunks` using `pgvector`.

Response:

```json
{
  "documentId": "uuid",
  "chunkCount": 12,
  "embeddingModel": "text-embedding-3-small"
}
```

### `POST /api/search`

Runs semantic search over indexed document chunks. This search uses embeddings and `pgvector`, not keyword matching.

Request:

```json
{
  "query": "Welche Dokumente enthalten Haftungsrisiken?"
}
```

Response:

```json
{
  "query": "Welche Dokumente enthalten Haftungsrisiken?",
  "results": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentTitle": "Rahmenvertrag",
      "content": "Passender Dokumentauszug...",
      "similarity": 0.82
    }
  ]
}
```

### `GET /api/deadlines`

Returns a deadline overview for the active organization.

Response:

```json
{
  "deadlines": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "documentTitle": "Rahmenvertrag",
      "title": "Vertragsende",
      "deadlineDate": "2026-12-31",
      "deadlineType": "Vertragsende",
      "status": "open",
      "sourceExcerpt": "...",
      "confidence": 0.92
    }
  ],
  "totalCount": 1,
  "overdueCount": 0,
  "next30DaysCount": 0,
  "byType": [{ "type": "Vertragsende", "count": 1 }]
}
```

### `GET /api/dashboard`

Returns dashboard aggregates for documents and risks.

Response:

```json
{
  "documentCount": 12,
  "riskCount": 7,
  "averageRiskScore": 58,
  "highRiskCount": 2,
  "risksByCategory": [{ "category": "Haftung", "count": 2 }],
  "topRisks": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "documentTitle": "Rahmenvertrag",
      "title": "Unbegrenzte Haftung",
      "category": "Haftung",
      "severity": "high",
      "riskScore": 82,
      "reasoning": "..."
    }
  ]
}
```

### `POST /api/chat`

Answers questions using imported and semantically indexed document chunks. The answer must be based only on retrieved document context and always returns the source chunks used for the response.

Request:

```json
{
  "question": "Welche Kündigungsfristen gelten in den Mietverträgen?"
}
```

Response:

```json
{
  "answer": "Die Kündigungsfrist beträgt laut den gefundenen Dokumenten drei Monate zum Vertragsende.",
  "sources": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentTitle": "Mietvertrag Projekt A",
      "similarity": 0.84,
      "excerpt": "Der Vertrag kann mit einer Frist von drei Monaten zum Laufzeitende gekündigt werden."
    }
  ]
}
```

## Data Contract

The initial database migration lives in `supabase/migrations/001_initial_schema.sql`.
Document analysis storage is extended in `supabase/migrations/003_document_analysis.sql`.
Contract analysis storage is added in `supabase/migrations/004_contract_analysis.sql`.
Risk score storage is added in `supabase/migrations/005_risk_analysis_score.sql`.
Semantic search RPC is added in `supabase/migrations/006_semantic_search.sql`.
The chat endpoint reuses the semantic search RPC and does not introduce additional storage in Phase 8.
Spreadsheet upload support is added in `supabase/migrations/007_spreadsheet_uploads.sql`.

Core tables:

- `organizations`
- `profiles`
- `organization_memberships`
- `documents`
- `document_analysis_jobs`
- `document_extractions`
- `document_risks`
- `document_deadlines`
- `document_chunks`

The `document_chunks.embedding` column uses `vector(1536)` for OpenAI embedding models with 1536 dimensions.

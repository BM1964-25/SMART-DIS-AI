# Architecture

## Platform Direction

SMART DIS-AI is a product inside the BuiltSmart AI SaaS platform. The app uses the same foundation that future BuiltSmart products should share:

- Next.js App Router for UI and server routes
- TypeScript for strict application code
- TailwindCSS with shared design tokens
- Supabase Auth for identity
- PostgreSQL for relational records
- pgvector for semantic document search
- OpenAI for controlled AI extraction and chat
- Vercel for deployment

## Domain Boundaries

The MVP is split into small modules:

- Documents: upload, metadata, storage references
- Analysis: classification, extraction, chunking, embeddings
- Risks: detected risks with source references and review state
- Deadlines: detected dates with type, confidence and reminder state
- Search: semantic retrieval over document chunks
- Chat: retrieval-augmented answers with source references

## MVP Processing Pipeline

The first production path is intentionally linear:

1. Upload
2. Text Extraction
3. Document Classification
4. Information Extraction
5. Risk Analysis
6. Deadline Detection
7. Chunking
8. Embeddings
9. pgvector Indexing
10. Chat
11. Dashboard

The system stays a modular monolith. Next.js API routes own orchestration, Supabase stores product data, Supabase Storage stores original files, PostgreSQL stores structured analysis, and pgvector stores semantic retrieval vectors.

## Supported File Types

MVP:

- PDF
- DOCX
- TXT
- XLSX
- XLS
- CSV

Planned later:

- EML
- PPTX
- OCR for scanned documents

## Document Types

The classifier must map uploaded documents into one of these product categories:

- Contracts
- Proposals
- Invoices
- Minutes
- Policies
- Other

Classification is useful for dashboards, prompt routing, extraction schemas and risk heuristics.

## Database Foundation

The first Supabase migration defines:

- Organizations, profiles and organization memberships
- Documents with storage references and processing status
- Analysis jobs with pipeline status
- Extractions for structured information
- Risks with severity, source and review state
- Deadlines with date, type, source and status
- Document chunks with `vector(1536)` embeddings

All tenant-owned tables enable Row Level Security. Policies are organization-scoped and separate member read access from admin write access for generated analysis records.

## Security Model

- Authentication is required for all product data.
- Authorization is organization-scoped.
- Row Level Security must be enabled for tenant-owned tables.
- Uploads must validate file type, size and ownership.
- AI prompts must separate system instructions, user input and retrieved context.
- Retrieved document text is untrusted input and must never override system instructions.
- API routes must validate all input before database writes.
- Secrets live only in environment variables.
- Source documents and extracted text are treated as untrusted content.
- Chat answers must be retrieval-augmented and cite document chunks.

## First Iteration

The current iteration creates a production-oriented app foundation:

- Shared shell navigation
- Design tokens
- Dashboard overview
- Health endpoint
- Documentation and environment contract

No fake document analysis is included. AI and persistence will be added as real server modules in later iterations.

## Second Iteration

The current iteration adds the MVP data contract:

- Shared document domain constants
- Initial Supabase migration
- `pgvector` embedding table
- Dashboard alignment with the MVP processing pipeline

No upload endpoint is implemented yet. The next step should create the authenticated document upload flow against this schema.

## Third Iteration

The current iteration adds the first end-to-end upload workflow:

- `/upload` page
- `POST /api/documents/upload`
- `GET /api/documents`
- Server-side Supabase admin client
- Local development storage fallback
- Private Supabase Storage bucket bootstrap
- `documents` metadata insert
- Drag & drop multi-file upload
- Modern document table

Authentication is still intentionally deferred because the requested order starts with upload. The route uses the service role only on the server and stores uploads under the bootstrap organization when Supabase is configured. Without Supabase environment variables, uploads are stored locally under `.local-data` so development can continue without cloud setup. The next step should replace the bootstrap organization with the authenticated user's active organization.

The local folder connector is a development-only source connector. It registers supported files from a user-provided local path without copying them into `.local-data/uploads`. This keeps the concept separate from upload and prepares the architecture for future connectors such as SharePoint, OneDrive and Teams.

## Phase 2 Upload Flow

1. User drops or selects up to 10 PDF, DOCX, TXT, XLSX, XLS or CSV files.
2. Client validates file count, type and size for immediate feedback.
3. `POST /api/documents/upload` validates again on the server.
4. Each valid file is stored in the active storage backend.
5. A metadata record is inserted in PostgreSQL or the local JSON store.
6. If a database insert fails, the stored file is removed again.
7. The UI refreshes `GET /api/documents` and renders the table.

There is no text extraction and no AI analysis in this phase.

## Phase 3 Document Analysis

The current iteration adds document analysis for uploaded files:

- `GET /api/documents/{documentId}`
- `POST /api/documents/{documentId}/analyze`
- `/documents/{documentId}` detail page
- Text extraction for TXT, DOCX and PDF
- OpenAI-based document type classification
- OpenAI-based German summary
- Storage of extracted text and analysis metadata in `document_extractions`

The analysis route is synchronous for the MVP. It creates a `document_analysis_jobs` row, updates document status through `extracting_text`, `analyzing` and `indexed`, and marks failed documents as `failed` with an error message.

Risks, deadlines, chunking and embeddings remain separate future phases.

## Phase 4 Contract Analysis

The current iteration adds structured contract analysis:

- `POST /api/documents/{documentId}/contract-analysis`
- `document_contract_analyses` table
- Contract partners
- Contract start and end
- Termination notice
- Contract value and currency
- Payment terms
- Contractual penalties
- Liability clauses
- Automatic renewals

The contract analysis uses the extracted text from Phase 3. It does not download or parse the original file again. Unknown or ambiguous values are stored as `null` rather than guessed.

Contractual penalties and liability are stored as extracted contract clauses in this phase. They are not yet converted into risk records.

## Phase 5 Risk Analysis

The current iteration adds risk analysis:

- `POST /api/documents/{documentId}/risk-analysis`
- `GET /api/dashboard`
- Risk score from 0 to 100
- Risk category
- Severity
- Reasoning
- Optional source excerpt
- Dashboard visualization by score and category

Risk records are stored in `document_risks`. Re-running risk analysis replaces previous risks for the same document to avoid duplicate findings in the MVP.

The risk analysis uses extracted document text and, when available, structured contract analysis context. It does not provide legal advice.

## Phase 6 Deadline Detection

The current iteration adds deadline detection:

- `POST /api/documents/{documentId}/deadline-analysis`
- `GET /api/deadlines`
- `/deadlines` overview page
- Kündigungsfristen
- Vertragsenden
- Zahlungsfristen
- Projekttermine

Deadlines are stored in `document_deadlines`. Re-running deadline detection replaces previous deadlines for the same document to avoid duplicates in the MVP.

Only concrete ISO dates are stored. Relative deadlines without a reliably computable date are ignored until a more advanced date reasoning module is added.

## Phase 7 Semantic Search

The current iteration adds semantic search with `pgvector`:

- `POST /api/documents/{documentId}/semantic-index`
- `POST /api/search`
- `/search` page
- Text chunking from extracted document text
- OpenAI embeddings with `text-embedding-3-small`
- Storage in `document_chunks.embedding`
- PostgreSQL RPC `match_document_chunks`

The search finds chunks by embedding similarity, not by exact words. Documents must be analyzed and semantically indexed before they can appear in search results.

## Phase 8 KI Chat

The current iteration adds retrieval-augmented chat:

- `POST /api/chat`
- `/chat` page
- Shared semantic retrieval service
- OpenAI answer generation with strict document-only grounding
- Source references for every answer

The chat does not use general model knowledge as a product source. It first retrieves the most relevant indexed chunks from `document_chunks` through `pgvector`, then asks the model to answer only from that context. Retrieved document text is treated as untrusted input and cannot override system instructions.

Chat history is intentionally not persisted in this phase. This keeps the MVP small and avoids introducing retention, audit and permission decisions before authentication is finalized.

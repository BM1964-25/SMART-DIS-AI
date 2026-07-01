# SMART DIS-AI

SMART DIS-AI is a BuiltSmart AI SaaS application for analyzing enterprise documents and turning them into structured knowledge, risks, deadlines and searchable context.

The product is not a document management system. It is designed as an intelligent analysis and decision system.

## MVP Scope

- Document upload
- Text extraction
- Document classification
- Information extraction
- Document analysis
- Risk detection
- Deadline detection
- Chunking and embeddings
- Semantic search
- Dashboard
- RAG chat with sources

## Supported Files

MVP:

- PDF
- DOCX
- TXT
- XLSX
- XLS
- CSV

Later:

- EML
- PPTX
- OCR

## Tech Stack

- Next.js App Router
- TypeScript
- React
- TailwindCSS
- Supabase Auth
- PostgreSQL
- pgvector
- OpenAI
- Vercel

## Getting Started

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)

## Supabase

The initial database migration is available at:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_storage_bootstrap.sql
supabase/migrations/003_document_analysis.sql
supabase/migrations/004_contract_analysis.sql
supabase/migrations/005_risk_analysis_score.sql
supabase/migrations/006_semantic_search.sql
supabase/migrations/007_spreadsheet_uploads.sql
```

The migrations include organization-scoped Row Level Security, document metadata, analysis jobs, risks, deadlines, `pgvector` chunks, a private `documents` storage bucket and a bootstrap organization for the first upload workflow.

Required environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DOCUMENTS_BUCKET
BUILTSMART_BOOTSTRAP_ORGANIZATION_ID
```

## Upload Workflow

Open:

```text
http://localhost:3000/upload
```

The first upload workflow:

1. Accepts PDF, DOCX, TXT, XLSX, XLS and CSV.
2. Supports drag & drop.
3. Supports up to 10 files per upload.
4. Validates MIME type, extension and size.
5. Stores each file in the active storage backend.
6. Creates a document metadata record with status `uploaded`.
7. Shows uploaded documents in a table.

Text extraction starts in the next development step.

Without Supabase environment variables, local development uses `.local-data/uploads` and `.local-data/documents.json`. This local data directory is ignored by Git.

For local development, the upload page can also connect a local folder by path. This does not upload or copy the files. It registers supported files as linked local sources so the app can read them from the original folder during local analysis.

## Document Analysis

Open a document from the upload table and click:

```text
Dokument analysieren
```

The analysis workflow:

1. Downloads the original file from Supabase Storage.
2. Extracts text from PDF, DOCX or TXT.
3. Classifies the document type.
4. Generates a German summary.
5. Stores extracted text, document type, summary, confidence and model metadata in PostgreSQL.

Risks and deadlines are not part of this phase.

## Contract Analysis

After document analysis, open the document detail page and click:

```text
Vertrag analysieren
```

The contract analysis extracts:

- Vertragspartner
- Vertragsbeginn
- Vertragsende
- Kündigungsfrist
- Vertragswert
- Zahlungsbedingungen
- Vertragsstrafen
- Haftung
- Automatische Verlängerungen

The results are stored in `document_contract_analyses`.

## Risk Analysis

After document analysis, open the document detail page and click:

```text
Risiken analysieren
```

The risk analysis generates:

- Risiko Score
- Risiko Kategorie
- Schweregrad
- Begründung
- optionalen Quellenauszug

The dashboard visualizes total risks, average risk score, categories and top risks.

## Deadline Detection

After document analysis, open the document detail page and click:

```text
Fristen erkennen
```

The deadline detection recognizes:

- Kündigungsfristen
- Vertragsenden
- Zahlungsfristen
- Projekttermine

Open the overview:

```text
http://localhost:3000/deadlines
```

## Semantic Search

After document analysis, open the document detail page and click:

```text
Semantisch indexieren
```

Then open:

```text
http://localhost:3000/search
```

The semantic search uses OpenAI embeddings and PostgreSQL `pgvector` to find document chunks by meaning rather than exact words.

## KI Chat

After document analysis and semantic indexing, open:

```text
http://localhost:3000/chat
```

The chat answers questions across all imported and indexed documents. Answers are grounded only in retrieved document chunks and include source references with document title, similarity and excerpt.

## Security Notes

- Do not commit `.env` or `.env.local`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components.
- All future organization data must use Supabase Row Level Security.
- All document text must be treated as untrusted input during AI processing.

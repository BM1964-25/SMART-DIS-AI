# Project Structure

```text
.
├── docs
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── PROJECT_STRUCTURE.md
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── chat
│   │   │   │   └── route.ts
│   │   │   ├── dashboard
│   │   │   │   └── route.ts
│   │   │   ├── deadlines
│   │   │   │   └── route.ts
│   │   │   ├── documents
│   │   │   │   ├── [documentId]
│   │   │   │   │   ├── analyze
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── contract-analysis
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── deadline-analysis
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── risk-analysis
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── semantic-index
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── upload
│   │   │   │   │   └── route.ts
│   │   │   │   ├── local-folder
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── health
│   │   │   │   └── route.ts
│   │   │   └── search
│   │   │       └── route.ts
│   │   ├── chat
│   │   │   └── page.tsx
│   │   ├── deadlines
│   │   │   └── page.tsx
│   │   ├── documents
│   │   │   └── [documentId]
│   │   │       └── page.tsx
│   │   ├── search
│   │   │   └── page.tsx
│   │   ├── upload
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── chat
│   │   │   └── document-chat.tsx
│   │   ├── dashboard
│   │   │   ├── metric-card.tsx
│   │   │   └── risk-dashboard.tsx
│   │   ├── deadlines
│   │   │   └── deadline-overview.tsx
│   │   ├── documents
│   │   │   └── document-detail-view.tsx
│   │   ├── layout
│   │   │   └── app-shell.tsx
│   │   ├── search
│   │   │   └── semantic-search.tsx
│   │   ├── ui
│   │   │   ├── section-header.tsx
│   │   │   └── status-badge.tsx
│   │   └── upload
│   │       ├── document-table.tsx
│   │       ├── upload-form.tsx
│   │       └── upload-workspace.tsx
│   ├── domain
│   │   ├── document-record.ts
│   │   ├── documents.ts
│   │   └── security.ts
│   └── lib
│       ├── analysis
│       │   ├── chunk-text.ts
│       │   ├── openai-contract-analysis.ts
│       │   ├── openai-deadline-analysis.ts
│       │   ├── openai-embeddings.ts
│       │   ├── openai-document-analysis.ts
│       │   ├── openai-rag-chat.ts
│       │   ├── openai-risk-analysis.ts
│       │   └── text-extraction.ts
│       ├── search
│       │   └── semantic-search.ts
│       ├── documents
│       │   └── local-document-store.ts
│       ├── supabase
│       │   └── admin.ts
│       ├── cn.ts
│       ├── env.ts
│       └── server-env.ts
├── supabase
│   └── migrations
│       ├── 001_initial_schema.sql
│       ├── 002_storage_bootstrap.sql
│       ├── 003_document_analysis.sql
│       ├── 004_contract_analysis.sql
│       ├── 005_risk_analysis_score.sql
│       ├── 006_semantic_search.sql
│       └── 007_spreadsheet_uploads.sql
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

alter table public.document_extractions
add column if not exists extracted_text text,
add column if not exists classified_document_type public.document_type,
add column if not exists analysis_model text,
add column if not exists prompt_version text;

create index if not exists document_extractions_document_idx
on public.document_extractions (document_id);

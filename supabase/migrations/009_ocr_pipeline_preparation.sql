alter type public.document_status add value if not exists 'needs_ocr';

alter table public.document_extractions
add column if not exists classified_document_type_confidence numeric(5, 4)
  check (
    classified_document_type_confidence is null
    or (
      classified_document_type_confidence >= 0
      and classified_document_type_confidence <= 1
    )
  ),
add column if not exists classified_document_type_reason text;

create table if not exists public.document_ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  status text not null default 'prepared'
    check (status in ('prepared', 'processing', 'completed', 'failed')),
  provider text not null default 'cloud_ocr'
    check (provider in ('local_tesseract', 'cloud_ocr', 'manual_review')),
  reason text not null,
  source_storage_path text,
  text_length integer not null default 0,
  readable_ratio numeric(6, 5) not null default 0,
  broken_char_ratio numeric(6, 5) not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists document_ocr_jobs_document_idx
on public.document_ocr_jobs (document_id);

create index if not exists document_ocr_jobs_status_idx
on public.document_ocr_jobs (organization_id, status);

alter table public.document_ocr_jobs enable row level security;

create policy "ocr_jobs_select_members"
on public.document_ocr_jobs
for select
using (public.is_organization_member(organization_id));

create policy "ocr_jobs_write_admins"
on public.document_ocr_jobs
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

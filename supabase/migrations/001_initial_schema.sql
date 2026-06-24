create extension if not exists vector;
create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.document_file_type as enum ('pdf', 'docx', 'txt');
create type public.document_type as enum ('contract', 'proposal', 'invoice', 'minutes', 'policy', 'other');
create type public.document_status as enum ('uploaded', 'extracting_text', 'analyzing', 'indexed', 'failed');
create type public.analysis_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.risk_severity as enum ('low', 'medium', 'high', 'critical');
create type public.deadline_status as enum ('open', 'reviewed', 'completed', 'dismissed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  title text not null,
  file_name text not null,
  file_type public.document_file_type not null,
  mime_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  size_bytes bigint not null check (size_bytes > 0),
  document_type public.document_type not null default 'other',
  status public.document_status not null default 'uploaded',
  text_extracted_at timestamptz,
  analyzed_at timestamptz,
  indexed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  status public.analysis_status not null default 'queued',
  current_step text not null default 'Upload',
  model text,
  prompt_version text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  summary text,
  parties jsonb not null default '[]'::jsonb,
  entities jsonb not null default '{}'::jsonb,
  key_values jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4) check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create table public.document_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  title text not null,
  description text not null,
  severity public.risk_severity not null,
  category text not null,
  source_excerpt text,
  source_page integer check (source_page is null or source_page > 0),
  confidence numeric(5, 4) check (confidence >= 0 and confidence <= 1),
  is_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_deadlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  title text not null,
  deadline_date date not null,
  deadline_type text not null,
  status public.deadline_status not null default 'open',
  source_excerpt text,
  source_page integer check (source_page is null or source_page > 0),
  confidence numeric(5, 4) check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer check (page_number is null or page_number > 0),
  token_count integer check (token_count is null or token_count > 0),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_memberships_user_idx on public.organization_memberships (user_id);
create index documents_organization_status_idx on public.documents (organization_id, status);
create index documents_organization_type_idx on public.documents (organization_id, document_type);
create index document_analysis_jobs_document_idx on public.document_analysis_jobs (document_id);
create index document_risks_organization_severity_idx on public.document_risks (organization_id, severity);
create index document_deadlines_organization_date_idx on public.document_deadlines (organization_id, deadline_date);
create index document_chunks_document_idx on public.document_chunks (document_id);
create index document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.documents enable row level security;
alter table public.document_analysis_jobs enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_risks enable row level security;
alter table public.document_deadlines enable row level security;
alter table public.document_chunks enable row level security;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = any(allowed_roles)
  );
$$;

create policy "profiles_select_self"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_members"
on public.organizations
for select
using (public.is_organization_member(id));

create policy "memberships_select_members"
on public.organization_memberships
for select
using (public.is_organization_member(organization_id));

create policy "memberships_manage_admins"
on public.organization_memberships
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "documents_select_members"
on public.documents
for select
using (public.is_organization_member(organization_id));

create policy "documents_insert_members"
on public.documents
for insert
with check (public.is_organization_member(organization_id));

create policy "documents_update_admins"
on public.documents
for update
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "documents_delete_admins"
on public.documents
for delete
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "analysis_jobs_select_members"
on public.document_analysis_jobs
for select
using (public.is_organization_member(organization_id));

create policy "analysis_jobs_insert_members"
on public.document_analysis_jobs
for insert
with check (public.is_organization_member(organization_id));

create policy "analysis_jobs_update_admins"
on public.document_analysis_jobs
for update
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "extractions_select_members"
on public.document_extractions
for select
using (public.is_organization_member(organization_id));

create policy "extractions_write_admins"
on public.document_extractions
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "risks_select_members"
on public.document_risks
for select
using (public.is_organization_member(organization_id));

create policy "risks_write_admins"
on public.document_risks
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "deadlines_select_members"
on public.document_deadlines
for select
using (public.is_organization_member(organization_id));

create policy "deadlines_write_admins"
on public.document_deadlines
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "chunks_select_members"
on public.document_chunks
for select
using (public.is_organization_member(organization_id));

create policy "chunks_write_admins"
on public.document_chunks
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

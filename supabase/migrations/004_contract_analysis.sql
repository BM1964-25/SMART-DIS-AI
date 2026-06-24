create table if not exists public.document_contract_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  contract_partners jsonb not null default '[]'::jsonb,
  contract_start date,
  contract_end date,
  termination_notice text,
  contract_value_amount numeric(14, 2),
  contract_value_currency text,
  payment_terms text,
  contractual_penalties text,
  liability text,
  automatic_renewal text,
  confidence numeric(5, 4) check (confidence >= 0 and confidence <= 1),
  raw_result jsonb not null default '{}'::jsonb,
  analysis_model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists document_contract_analyses_organization_idx
on public.document_contract_analyses (organization_id);

create index if not exists document_contract_analyses_document_idx
on public.document_contract_analyses (document_id);

alter table public.document_contract_analyses enable row level security;

create policy "contract_analyses_select_members"
on public.document_contract_analyses
for select
using (public.is_organization_member(organization_id));

create policy "contract_analyses_write_admins"
on public.document_contract_analyses
for all
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

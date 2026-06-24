alter table public.document_risks
add column if not exists risk_score integer check (risk_score >= 0 and risk_score <= 100);

create index if not exists document_risks_organization_score_idx
on public.document_risks (organization_id, risk_score desc);

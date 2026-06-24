create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  target_organization_id uuid,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    chunk.id as chunk_id,
    chunk.document_id,
    document.title as document_title,
    chunk.content,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.document_chunks chunk
  join public.documents document on document.id = chunk.document_id
  where chunk.organization_id = target_organization_id
    and chunk.embedding is not null
  order by chunk.embedding <=> query_embedding
  limit match_count;
$$;

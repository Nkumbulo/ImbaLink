-- ImbaLink published legal documents
-- Run this migration in Supabase before publishing the Terms & Conditions.

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  version text not null default '1.0',
  effective_date date not null default current_date,
  content text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_documents enable row level security;

drop policy if exists "Published legal documents are publicly readable" on public.legal_documents;
create policy "Published legal documents are publicly readable"
on public.legal_documents
for select
using (is_published = true);

create index if not exists legal_documents_published_idx
  on public.legal_documents (slug, is_published);

-- Staff/admin users can manage legal documents through the normal authenticated/admin workflow.
-- Do not add a broad authenticated write policy here. Keep publishing rights server-side/admin-only.

-- Seed a placeholder row. Replace the content with the approved legal text supplied below,
-- then set is_published = true.
insert into public.legal_documents (slug, title, version, effective_date, content, is_published)
values ('terms-of-service', 'ImbaLink Terms & Conditions', '1.0', current_date,
'REPLACE_WITH_APPROVED_IMBALINK_TERMS', false)
on conflict (slug) do nothing;

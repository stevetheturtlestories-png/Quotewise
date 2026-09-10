-- ChoiceGrade V6 Phase 2A
-- Run in Supabase SQL Editor after creating the project.

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null check (access_type in ('project_30','lifetime')),
  status text not null default 'active' check (status in ('active','expired','revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz null,
  stripe_customer_id text null,
  stripe_checkout_session_id text unique null,
  created_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "Users can read own entitlements" on public.entitlements;
create policy "Users can read own entitlements"
on public.entitlements for select
using (auth.uid() = user_id);

-- Do NOT create a client insert/update policy.
-- Entitlements should only be created or changed by trusted server-side webhook code.

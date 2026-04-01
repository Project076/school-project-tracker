create extension if not exists pgcrypto;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('Admin', 'Project Manager', 'Member')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_projects (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_profiles_set_updated_at on public.app_profiles;
create trigger app_profiles_set_updated_at
before update on public.app_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists app_projects_set_updated_at on public.app_projects;
create trigger app_projects_set_updated_at
before update on public.app_projects
for each row
execute function public.set_updated_at();

alter table public.app_profiles enable row level security;
alter table public.app_projects enable row level security;

drop policy if exists "profiles_select_authenticated" on public.app_profiles;
create policy "profiles_select_authenticated"
on public.app_profiles
for select
to authenticated
using (true);

drop policy if exists "projects_access_authenticated" on public.app_projects;
create policy "projects_access_authenticated"
on public.app_projects
for all
to authenticated
using (true)
with check (true);


-- Phase 1: profiles + businesses
-- Run this once in the Supabase Dashboard -> SQL Editor.

-- ---------- profiles ----------
-- One row per authenticated user (student or vendor).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'vendor')),
  vendor_type text check (vendor_type in ('student', 'external')),
  name text not null,
  matric text,
  level text,
  dept text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- businesses ----------
-- One row per vendor's business/shop info. verified is admin-only —
-- the trigger below blocks vendors from flipping it themselves.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  description text,
  phone text,
  location text,
  social_handle text,
  cac_number text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create policy "Businesses are publicly readable"
  on public.businesses for select
  using (true);

create policy "Vendors can insert their own business"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

create policy "Vendors can update their own business"
  on public.businesses for update
  using (auth.uid() = owner_id);

create or replace function public.prevent_verified_self_update()
returns trigger language plpgsql as $$
begin
  if new.verified is distinct from old.verified and auth.role() <> 'service_role' then
    new.verified := old.verified;
  end if;
  return new;
end;
$$;

create trigger businesses_prevent_verified_self_update
  before update on public.businesses
  for each row execute function public.prevent_verified_self_update();

-- ---------- avatars storage bucket ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

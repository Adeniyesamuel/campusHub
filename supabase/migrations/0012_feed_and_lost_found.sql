-- Phase 5, chunk 1: campus feed + lost & found
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0011.

-- ---------- campus feed ----------
-- audience is split into a type + value rather than one free-text
-- channel string, so RLS can actually enforce visibility instead of
-- relying on the client to filter honestly:
--   'general'    -> audience_value is null, visible to everyone
--   'level'      -> audience_value = one of LEVELS, visible to profiles
--                    whose own level matches
--   'department' -> audience_value = one of DEPARTMENTS, visible to
--                    profiles whose own dept matches
-- No separate check constraint against the LEVELS/DEPARTMENTS lists is
-- needed: matches_my_audience() below requires audience_value to equal
-- the *poster's own* profile.level/profile.dept, and those columns are
-- already only ever set through the app's pickers — so any value that
-- passes the insert policy is already a valid one.
create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  audience_type text not null check (audience_type in ('general', 'level', 'department')),
  audience_value text,
  text text not null,
  created_at timestamptz not null default now(),
  constraint audience_value_matches_type check (
    (audience_type = 'general' and audience_value is null) or
    (audience_type in ('level', 'department') and audience_value is not null)
  )
);

alter table public.feed_posts enable row level security;

-- shared by both policies below: same rule for "can I see this post" and
-- "am I allowed to post with this audience" (self-attested — a poster
-- can only target the channels their own profile actually belongs to)
create or replace function public.matches_my_audience(p_type text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'general' then true
    when 'level' then exists (select 1 from public.profiles where id = auth.uid() and level = p_value)
    when 'department' then exists (select 1 from public.profiles where id = auth.uid() and dept = p_value)
    else false
  end;
$$;

create policy "Users can read posts in channels they belong to"
  on public.feed_posts for select
  using (public.matches_my_audience(audience_type, audience_value));

create policy "Users can post to channels they belong to"
  on public.feed_posts for insert
  with check (auth.uid() = author_id and public.matches_my_audience(audience_type, audience_value));

-- ---------- lost & found ----------
-- Campus-wide, no audience scoping (matches today's demo behavior —
-- lost/found items aren't filtered by level or department).
create table public.lost_found_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('lost', 'found')),
  item text not null,
  location text not null default 'Campus',
  created_at timestamptz not null default now()
);

alter table public.lost_found_reports enable row level security;

create policy "Anyone can read lost & found reports"
  on public.lost_found_reports for select
  using (true);

create policy "Users can post their own lost & found reports"
  on public.lost_found_reports for insert
  with check (auth.uid() = reporter_id);

-- Phase 5, chunk 6 (final chunk): study materials, real uploads, per-user ratings
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0016.

-- ---------- study materials ----------
-- Campus-wide by course, no level/dept scoping — matches today's demo
-- data exactly (materials have no level/dept fields at all) and the
-- approved call that course materials are useful across levels (e.g.
-- retakes), not just within one exact class cohort. Post-only, no
-- update/delete, same as every other "posted content" table this phase.
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  course text not null,
  title text not null,
  material_type text not null check (material_type in ('PDF', 'Handwritten Notes', 'Recorded Tutorial', 'Slides', 'Past Questions')),
  file_path text not null,
  created_at timestamptz not null default now()
);

alter table public.study_materials enable row level security;

create policy "Anyone can read study materials"
  on public.study_materials for select
  using (true);

create policy "Authenticated users can upload study materials"
  on public.study_materials for insert
  with check (auth.uid() = uploader_id);

-- ---------- per-user ratings ----------
-- The actual bug fix: today's demo stores sum/count/mine on the shared
-- material object (a "mine" rating from whichever browser last touched
-- it), so ratings can drift and there's no real one-rating-per-user
-- enforcement. unique(material_id, user_id) via the composite primary
-- key makes that a real constraint; re-rating is an update, not a
-- second row.
create table public.material_ratings (
  material_id uuid not null references public.study_materials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

alter table public.material_ratings enable row level security;

-- Same privacy stance as polls: you can see your OWN rating, never
-- anyone else's individual score — averages come from
-- get_material_ratings() below. Flag if you'd rather ratings be fully
-- public instead (there's less of a social-pressure argument for star
-- ratings than poll votes, so this is a closer call than polls was).
create policy "Users can view their own rating"
  on public.material_ratings for select
  using (auth.uid() = user_id);

create policy "Users can rate materials"
  on public.material_ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can change their own rating"
  on public.material_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- aggregate ratings (no individual scores exposed) ----------
-- Returns one row per material that has at least one rating — a
-- material with zero ratings simply won't appear, same as
-- get_poll_results() only ever aggregates what exists.
create or replace function public.get_material_ratings()
returns table (material_id uuid, avg_stars numeric, rating_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select material_id, avg(stars)::numeric, count(*)
  from public.material_ratings
  group by material_id;
$$;

grant execute on function public.get_material_ratings() to authenticated;

-- ---------- public material-files bucket ----------
-- Public (unlike assignment-files/chat-images) — study materials are
-- meant to be freely downloaded by anyone, same as listing-images.
-- {uploader_id}/{filename} still gates uploads to their own folder.
insert into storage.buckets (id, name, public)
values ('material-files', 'material-files', true)
on conflict (id) do nothing;

create policy "Study material files are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'material-files');

create policy "Authenticated users can upload study material files"
  on storage.objects for insert
  with check (bucket_id = 'material-files' and auth.uid()::text = (storage.foldername(name))[1]);

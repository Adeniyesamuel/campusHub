-- Phase 5, chunk 2: class info — announcements, timetable, exams
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0012.

-- All three are scoped to a single (level, dept) pair — a user's exact
-- class/cohort, matching "My Class" in the UI — not two separate
-- level-wide/dept-wide channels like the campus feed's audience model.
create or replace function public.is_my_class(p_level text, p_dept text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and level = p_level and dept = p_dept
  );
$$;

-- ---------- announcements ----------
-- Read-only once posted (no update/delete), same as the campus feed —
-- any classmate can post, self-attested via is_my_class() same as the
-- feed's matches_my_audience().
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  level text not null,
  dept text not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "Classmates can read their class announcements"
  on public.announcements for select
  using (public.is_my_class(level, dept));

create policy "Classmates can post class announcements"
  on public.announcements for insert
  with check (auth.uid() = author_id and public.is_my_class(level, dept));

-- ---------- timetable ----------
-- A shared, mutable resource per (level, dept) — any classmate can add,
-- edit, or remove any entry (no per-row ownership check), matching the
-- explicit "editable by anyone in that dept/level" decision. time_label
-- stays free text (e.g. "10:00 – 12:00") since it's a recurring weekly
-- slot, not a specific date.
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  dept text not null,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')),
  course text not null,
  time_label text not null,
  venue text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.timetable_entries enable row level security;

create policy "Classmates can read their class timetable"
  on public.timetable_entries for select
  using (public.is_my_class(level, dept));

create policy "Classmates can add timetable entries"
  on public.timetable_entries for insert
  with check (public.is_my_class(level, dept) and updated_by = auth.uid());

create policy "Classmates can edit any timetable entry in their class"
  on public.timetable_entries for update
  using (public.is_my_class(level, dept))
  with check (public.is_my_class(level, dept) and updated_by = auth.uid());

create policy "Classmates can delete any timetable entry in their class"
  on public.timetable_entries for delete
  using (public.is_my_class(level, dept));

-- ---------- exams / tests ----------
-- Same collaborative-editing policy as the timetable (per your call to
-- treat "class schedule info" as one bucket). starts_at is a real
-- timestamptz instead of the old free-text date string, same fix
-- already applied to events in Phase 3.
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  dept text not null,
  course text not null,
  exam_type text not null check (exam_type in ('Test', 'Exam')),
  starts_at timestamptz not null,
  venue text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.exams enable row level security;

create policy "Classmates can read their class exams"
  on public.exams for select
  using (public.is_my_class(level, dept));

create policy "Classmates can add exams"
  on public.exams for insert
  with check (public.is_my_class(level, dept) and created_by = auth.uid());

create policy "Classmates can edit any exam in their class"
  on public.exams for update
  using (public.is_my_class(level, dept))
  with check (public.is_my_class(level, dept));

create policy "Classmates can delete any exam in their class"
  on public.exams for delete
  using (public.is_my_class(level, dept));

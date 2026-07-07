-- Phase 5, chunk 5: self-reported attendance
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0015.

-- Fully private personal record — nobody but the student themself can
-- read or write their own attendance, not even classmates or the
-- course rep (rep-marked attendance needs the rep system, tracked as a
-- future refinement in PENDING.md). unique(user_id, course, class_date)
-- means marking the same course/day twice is an update, not a
-- duplicate row, and present/total per course is always computed live
-- via count() rather than a stored running tally (the same class of bug
-- fixed for polls/materials elsewhere in this phase).
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course text not null,
  class_date date not null,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now(),
  unique (user_id, course, class_date)
);

alter table public.attendance_records enable row level security;

create policy "Users can view their own attendance"
  on public.attendance_records for select
  using (auth.uid() = user_id);

create policy "Users can mark their own attendance"
  on public.attendance_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own attendance"
  on public.attendance_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

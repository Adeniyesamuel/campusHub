-- Phase 5, chunk 3: assignments + real file submissions
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0013.

-- ---------- assignments ----------
-- Post-only, no update/delete — same as announcements, not the
-- collaborative-editing model used for timetable/exams. An assignment
-- reads more like a posted announcement (with a due date) than a
-- shared living document, so any classmate can post one but nobody
-- edits someone else's after the fact. Flag if you'd rather it behave
-- like the timetable instead.
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  level text not null,
  dept text not null,
  course text not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

create policy "Classmates can read their class assignments"
  on public.assignments for select
  using (public.is_my_class(level, dept));

create policy "Classmates can post class assignments"
  on public.assignments for insert
  with check (auth.uid() = author_id and public.is_my_class(level, dept));

-- ---------- submissions ----------
-- Private to the submitting student — today's demo bug is that
-- "submitted" lives on the shared assignment object, so one student
-- submitting marks it submitted for the whole class. A real per-student
-- row with a unique(assignment_id, student_id) constraint fixes that;
-- resubmitting is an update (new file_path), not a new row.
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.assignment_submissions enable row level security;

create policy "Students can view their own submissions"
  on public.assignment_submissions for select
  using (auth.uid() = student_id);

create policy "Students can submit their own work"
  on public.assignment_submissions for insert
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.is_my_class(a.level, a.dept)
    )
  );

create policy "Students can update their own submission"
  on public.assignment_submissions for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- No select policy for anyone other than the student themself — the
-- assignment (and its due date) is visible to the whole class, but who
-- submitted what stays private, same as attendance will be in chunk 5.

-- ---------- private assignment-files bucket ----------
-- {student_id}/{filename} — same one-level-folder-is-the-owner pattern
-- as avatars/chat-images, so a single auth.uid() check on the folder
-- gates both read and write.
insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do nothing;

create policy "Students can view their own assignment files"
  on storage.objects for select
  using (bucket_id = 'assignment-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Students can upload their own assignment files"
  on storage.objects for insert
  with check (bucket_id = 'assignment-files' and auth.uid()::text = (storage.foldername(name))[1]);

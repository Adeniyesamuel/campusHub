-- Phase 5, chunk 4: polls with real per-user votes
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0014.

-- ---------- polls ----------
-- Post-only, no update/delete — same reasoning as announcements and
-- assignments: editing a question after people start voting would be
-- misleading, so a poll is immutable once created.
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  dept text not null,
  question text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.polls enable row level security;

create policy "Classmates can read their class polls"
  on public.polls for select
  using (public.is_my_class(level, dept));

create policy "Classmates can post class polls"
  on public.polls for insert
  with check (auth.uid() = created_by and public.is_my_class(level, dept));

-- ---------- poll options ----------
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

alter table public.poll_options enable row level security;

create policy "Classmates can read options for their class polls"
  on public.poll_options for select
  using (exists (
    select 1 from public.polls p where p.id = poll_id and public.is_my_class(p.level, p.dept)
  ));

-- Only the poll's own creator can attach options to it (done once, at
-- creation time, right after the poll row itself is inserted).
create policy "Poll creator can add options to their own poll"
  on public.poll_options for insert
  with check (exists (
    select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid()
  ));

-- ---------- votes ----------
-- unique(poll_id, user_id) via the composite primary key is the actual
-- bug fix here: today's demo stores "voted" as a single field on the
-- poll object itself (one vote, shared by the whole class in memory).
-- A real per-user row makes one-vote-per-poll an actual constraint, and
-- an update (not a new row) is how someone changes their vote.
create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

-- Privacy: a classmate can see THEIR OWN vote, never anyone else's —
-- aggregate tallies (what everyone needs to see the results) come from
-- get_poll_results() below instead, which exposes counts but not who
-- voted for what.
create policy "Users can view their own vote"
  on public.poll_votes for select
  using (auth.uid() = user_id);

create policy "Users can vote in their class polls"
  on public.poll_votes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.polls p where p.id = poll_id and public.is_my_class(p.level, p.dept))
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id)
  );

create policy "Users can change their own vote"
  on public.poll_votes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id)
  );

-- ---------- aggregate results (no individual votes exposed) ----------
create or replace function public.get_poll_results(p_poll_id uuid)
returns table (option_id uuid, votes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, count(v.user_id)
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
    and exists (
      select 1 from public.polls p where p.id = p_poll_id and public.is_my_class(p.level, p.dept)
    )
  group by o.id;
$$;

grant execute on function public.get_poll_results(uuid) to authenticated;

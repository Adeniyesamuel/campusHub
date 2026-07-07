-- Phase 4 follow-up 3: a central Messages inbox
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0010.

-- ---------- per-user read state, per conversation ----------
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create policy "Users can view their own read state"
  on public.conversation_reads for select
  using (auth.uid() = user_id);

create policy "Users can set their own read state"
  on public.conversation_reads for insert
  with check (auth.uid() = user_id and public.is_conversation_participant(conversation_id));

create policy "Users can update their own read state"
  on public.conversation_reads for update
  using (auth.uid() = user_id);

-- ---------- inbox listing ----------
-- One row per conversation the caller participates in that has at least
-- one visible message, newest first, with the other person's name, a
-- preview of the last message (text, or an image flag for a caption-less
-- photo), and an unread count. Mirrors the same "hide messages sent by
-- someone who blocked me, after the block" rule as the messages select
-- policy (0009) — blocking is unreachable from the UI right now, but the
-- rule stays correct here too in case it's ever re-enabled.
create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  last_message_text text,
  last_message_image boolean,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    other.id,
    other.name,
    lm.text,
    (lm.image_path is not null),
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
        and not exists (
          select 1 from public.blocks b
          where b.blocker_id = auth.uid() and b.blocked_id = m.sender_id and b.created_at < m.created_at
        )
    )
  from public.conversations c
  join public.profiles other on other.id = (case when c.user_a = auth.uid() then c.user_b else c.user_a end)
  left join lateral (
    select m2.text, m2.image_path, m2.created_at, m2.sender_id
    from public.messages m2
    where m2.conversation_id = c.id
      and not exists (
        select 1 from public.blocks b2
        where b2.blocker_id = auth.uid() and b2.blocked_id = m2.sender_id and b2.created_at < m2.created_at
      )
    order by m2.created_at desc
    limit 1
  ) lm on true
  left join public.conversation_reads cr on cr.conversation_id = c.id and cr.user_id = auth.uid()
  where (c.user_a = auth.uid() or c.user_b = auth.uid())
    and lm.created_at is not null
  order by lm.created_at desc;
$$;

grant execute on function public.get_my_conversations() to authenticated;

-- Realtime already broadcasts INSERTs on messages (enabled in 0008); the
-- client subscribes without a conversation filter to catch new messages
-- across ALL of the caller's conversations for a live-updating unread
-- badge — RLS on messages (0009) already scopes what each subscriber
-- receives, so no separate publication change is needed here.

-- Phase 4 (original plan numbering): real-time chat
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0007.

-- ---------- conversations ----------
-- One row per pair of people, ever. user_a < user_b is a canonical
-- ordering (UUIDs compare byte-wise) so the same two people can never
-- end up with two separate conversation rows depending on who messaged
-- first — get_or_create_conversation() below handles the ordering, so
-- the client never has to think about it.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint distinct_users check (user_a <> user_b),
  constraint ordered_pair check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.conversations enable row level security;

create policy "Participants can read their own conversations"
  on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- No insert policy for regular roles at all — a conversation can only be
-- created through this function (security definer, bypasses RLS), which
-- is also what enforces the canonical ordering above.
create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = other_user_id then
    raise exception 'Cannot message yourself';
  end if;

  if me < other_user_id then a := me; b := other_user_id;
  else a := other_user_id; b := me;
  end if;

  select id into conv_id from public.conversations where user_a = a and user_b = b;
  if conv_id is null then
    insert into public.conversations (user_a, user_b) values (a, b) returning id into conv_id;
  end if;
  return conv_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.conversations
    where id = target_conversation_id and (user_a = auth.uid() or user_b = auth.uid())
  );
$$;

create policy "Participants can read messages in their conversations"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

create policy "Participants can send messages in their conversations"
  on public.messages for insert
  with check (auth.uid() = sender_id and public.is_conversation_participant(conversation_id));

-- enable Realtime change broadcasts for messages, so an open chat panel
-- gets new messages pushed live rather than needing a manual refresh
alter publication supabase_realtime add table public.messages;

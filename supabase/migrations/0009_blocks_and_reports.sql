-- Phase 4 follow-up: restricted user blocking + message reporting
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0008.

-- ---------- blocks ----------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "Users can view their own blocks"
  on public.blocks for select
  using (auth.uid() = blocker_id);

create policy "Users can remove their own blocks"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

-- Deliberately no insert policy: a block can only be created through
-- block_user() below (security definer), which is what enforces the
-- "no active transaction" rule server-side. A direct client insert into
-- this table is rejected by RLS with no matching policy.

-- true if the two users have a paid-but-not-completed order between them
-- (in either buyer/seller direction), or either one holds a paid ticket
-- to the other's upcoming event — the two "active transaction" cases a
-- block must not be allowed to interrupt.
create or replace function public.has_active_transaction(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.businesses b on b.id = o.shop_id
    where o.payment_status = 'paid' and o.status <> 'completed'
      and (
        (o.buyer_id = user_a and b.owner_id = user_b) or
        (o.buyer_id = user_b and b.owner_id = user_a)
      )
  )
  or exists (
    select 1
    from public.tickets t
    join public.ticket_tiers tt on tt.id = t.tier_id
    join public.events e on e.id = tt.event_id
    where t.status = 'paid' and e.starts_at > now()
      and (
        (t.buyer_id = user_a and e.organizer_id = user_b) or
        (t.buyer_id = user_b and e.organizer_id = user_a)
      )
  );
$$;

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = target_user_id then
    raise exception 'Cannot block yourself';
  end if;
  if public.has_active_transaction(me, target_user_id) then
    raise exception 'ACTIVE_TRANSACTION';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (me, target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;

-- ---------- message reports ----------
-- reporter_id / reported_user_id / message_text are always filled in by
-- the trigger below from the real message row, never trusted from the
-- client — so a report can't be forged to blame the wrong person, and
-- the message text survives as evidence even if something else about
-- the conversation later changes.
create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  message_text text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.message_reports enable row level security;

create or replace function public.set_message_report_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select sender_id, text, conversation_id into m
  from public.messages where id = new.message_id;

  if not found then
    raise exception 'Message not found';
  end if;
  if not public.is_conversation_participant(m.conversation_id) then
    raise exception 'Not a participant in this conversation';
  end if;

  new.reporter_id := auth.uid();
  new.reported_user_id := m.sender_id;
  new.message_text := m.text;
  return new;
end;
$$;

create trigger trg_set_message_report_fields
  before insert on public.message_reports
  for each row execute function public.set_message_report_fields();

create policy "Authenticated users can file message reports"
  on public.message_reports for insert
  with check (auth.uid() is not null);

-- No select policy at all for regular roles — reports are reviewed by
-- you (the admin) via the Supabase Dashboard/SQL editor, which uses the
-- service role and bypasses RLS. Nothing client-side can read them back.

-- ---------- hide (not delete) messages sent by someone you've blocked ----------
-- Only messages sent AFTER the block existed are hidden from the
-- blocker's view — anything sent before stays fully visible, so blocking
-- can never be used to erase conversation history. The blocked sender's
-- insert is untouched (still succeeds, still stored), so from their side
-- nothing looks different — it just never reaches the blocker. Realtime
-- (postgres_changes) evaluates this same policy per-subscriber, so the
-- live push is silently skipped too, with no error/announcement.
drop policy "Participants can read messages in their conversations" on public.messages;

create policy "Participants can read non-blocked messages in their conversations"
  on public.messages for select
  using (
    public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.blocks
      where blocker_id = auth.uid()
        and blocked_id = messages.sender_id
        and blocks.created_at < messages.created_at
    )
  );

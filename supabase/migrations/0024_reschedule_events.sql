-- Chunk 6: reschedule flow (date/venue changes for genuine emergencies).
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0023.

alter table public.events
  add column rescheduled_from_starts_at timestamptz,
  add column rescheduled_from_venue text,
  add column reschedule_reason text,
  add column rescheduled_at timestamptz;

-- Server-enforced: organizer-only, one reschedule per event ever
-- (rescheduled_at is null check), event must not be cancelled, a
-- reason is required. Stashes the old date/venue so the event page can
-- show "Rescheduled from X to Y — reason" permanently, then notifies
-- every paid ticket holder by reusing the existing 1:1 chat system —
-- same pattern as get_or_create_conversation in migration 0008, just
-- inlined here since the organizer (not the buyer) is the auth.uid()
-- initiating each conversation.
create or replace function public.reschedule_event(
  p_event_id uuid,
  p_new_starts_at timestamptz,
  p_new_venue text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  buyer record;
  a uuid;
  b uuid;
  conv_id uuid;
  msg text;
begin
  select * into ev from public.events where id = p_event_id for update;
  if ev is null then
    raise exception 'Event not found';
  end if;
  if ev.organizer_id <> auth.uid() then
    raise exception 'Not your event';
  end if;
  if ev.cancelled_at is not null then
    raise exception 'This event is cancelled';
  end if;
  if ev.rescheduled_at is not null then
    raise exception 'This event has already been rescheduled once';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required';
  end if;
  if p_new_venue is null or length(trim(p_new_venue)) = 0 then
    raise exception 'A venue is required';
  end if;

  msg := 'Event rescheduled: "' || ev.title || '" has moved from '
    || to_char(ev.starts_at, 'DD Mon YYYY, HH12:MI AM') || ' at ' || ev.venue
    || ' to ' || to_char(p_new_starts_at, 'DD Mon YYYY, HH12:MI AM') || ' at ' || p_new_venue
    || '. Reason: ' || p_reason
    || '. You can request a full refund for your ticket within 72 hours of this message if the new date/venue does not work for you.';

  update public.events set
    rescheduled_from_starts_at = ev.starts_at,
    rescheduled_from_venue = ev.venue,
    reschedule_reason = p_reason,
    rescheduled_at = now(),
    starts_at = p_new_starts_at,
    venue = p_new_venue
  where id = p_event_id;

  for buyer in
    select distinct t.buyer_id
    from public.tickets t
    join public.ticket_tiers tt on tt.id = t.tier_id
    where tt.event_id = p_event_id and t.status = 'paid'
  loop
    if buyer.buyer_id < ev.organizer_id then a := buyer.buyer_id; b := ev.organizer_id;
    else a := ev.organizer_id; b := buyer.buyer_id;
    end if;

    select id into conv_id from public.conversations where user_a = a and user_b = b;
    if conv_id is null then
      insert into public.conversations (user_a, user_b) values (a, b) returning id into conv_id;
    end if;

    insert into public.messages (conversation_id, sender_id, text)
    values (conv_id, ev.organizer_id, msg);
  end loop;
end;
$$;

grant execute on function public.reschedule_event(uuid, timestamptz, text, text) to authenticated;

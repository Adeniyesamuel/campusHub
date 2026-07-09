-- Launch sweep follow-up, chunk 5: delete/cancel event with refunds
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0022.

-- ---------- cancellation marker ----------
alter table public.events add column cancelled_at timestamptz;

-- ---------- a ticket can now be refunded, not just pending/paid/failed ----------
-- Finds whatever the existing status check constraint is actually named
-- (rather than assuming Postgres's default auto-naming) and drops it,
-- so this doesn't fail if it turns out to be named differently.
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'tickets' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.tickets drop constraint %I', cname);
  end if;
end $$;

alter table public.tickets add constraint tickets_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded'));

-- ---------- stop NEW purchases against a cancelled event ----------
-- Cancelling refunds everyone already holding a ticket (handled by the
-- cancel-event Edge Function, service-role, not RLS) — but without this,
-- the free-ticket path (which inserts directly, no Edge Function) could
-- still reserve a ticket against a cancelled event via a direct API
-- call, since cancelled_at didn't exist when this policy was written.
-- The paid path gets the equivalent check added to init-ticket-payment
-- itself (same migration set, deployed alongside this).
drop policy "Buyers can reserve a pending ticket" on public.tickets;

create policy "Buyers can reserve a pending ticket for an active event"
  on public.tickets for insert
  with check (
    auth.uid() = buyer_id and status = 'pending'
    and exists (
      select 1 from public.ticket_tiers tt
      join public.events e on e.id = tt.event_id
      where tt.id = tier_id and e.cancelled_at is null
    )
  );

-- No new RLS policy for deleting/cancelling events themselves — that
-- goes through the new cancel-event Edge Function (service role),
-- since it needs to count paid tickets and potentially call Paystack's
-- refund API for each one, which a plain RLS policy can't do.

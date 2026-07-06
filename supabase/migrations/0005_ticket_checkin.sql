-- Phase 3 follow-up: ticket check-in (one-time entry scanning)
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0004.

alter table public.tickets
  add column used_at timestamptz;

-- No new RLS policy needed: tickets already has no update policy for
-- regular clients (see 0004), so check-in has to go through a
-- service-role Edge Function (scan-ticket) just like payment
-- confirmation does. This keeps "who can mark a ticket used" enforced
-- at the database level, not just by client-side convention.

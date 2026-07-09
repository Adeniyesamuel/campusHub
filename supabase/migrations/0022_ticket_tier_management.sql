-- Launch sweep follow-up, chunk 4: ticket tier management (rename, add, restock)
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0021.

-- Adding a NEW tier to an already-published event already works today —
-- the existing insert policy ("Organizers can add tiers to their own
-- event", migration 0004) only checks is_event_organizer(event_id), with
-- no restriction on when. This migration is only about EDITING an
-- existing tier, since there's been no update policy on this table at
-- all until now.
--
-- One policy covers both renaming and restocking — the client will only
-- ever send name/description/quantity_total, never price (changing a
-- price after tickets have already sold at the old one is a bait-and-
-- switch risk, kept out of scope even though this policy itself doesn't
-- distinguish columns), but nothing here needs to enforce that
-- specifically: increasing quantity_total is already proven safe
-- (confirm-ticket reads it fresh at confirm-time, not cached), and
-- renaming a tier doesn't affect anything else that reads it by id.
create policy "Organizers can update their own event's ticket tiers"
  on public.ticket_tiers for update
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- Phase 3 follow-up: store event date/time as one sortable timestamp
-- instead of two free-text fields.
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0005.

alter table public.events add column starts_at timestamptz not null default now();
alter table public.events alter column starts_at drop default;

alter table public.events drop column date;
alter table public.events drop column time;

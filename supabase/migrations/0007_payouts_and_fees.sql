-- Phase 4: marketplace payments + revenue splits via Paystack subaccounts
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0006.

-- ---------- configurable platform fees ----------
-- Read publicly (client displays "includes fee") and by the Edge
-- Functions (authoritative split calculation). Change the numbers here
-- any time without touching code or redeploying anything.
create table public.platform_fees (
  key text primary key check (key in ('events', 'marketplace')),
  percent numeric not null,
  min_fee integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_fees enable row level security;

create policy "Platform fees are publicly readable"
  on public.platform_fees for select
  using (true);

insert into public.platform_fees (key, percent, min_fee) values
  ('events', 5, 0),
  ('marketplace', 2.5, 100);

-- ---------- payout accounts (vendors AND event organizers) ----------
-- One per profile, not per business — a vendor who also organizes
-- events reuses the same payout destination for both. Fully
-- service-role-write: the client only ever reads its own row. Bank
-- details are validated (Paystack account-resolve) and the Paystack
-- subaccount is created by the create-payout-account Edge Function
-- BEFORE this row is ever inserted, so paystack_subaccount_code is
-- always present the moment a row exists — no partial/pending state.
create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  paystack_subaccount_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;

create policy "Users can read their own payout account"
  on public.payout_accounts for select
  using (auth.uid() = profile_id);

-- ---------- orders: add payment tracking for the new Buy Now flow ----------
-- status (existing) tracks fulfillment: new -> completed, unchanged —
-- vendors still click "Complete" the same way for both order origins.
-- payment_status (new) tracks money: 'unpaid' for today's free "Place
-- order" reservations (default, matches current behavior exactly), or
-- 'pending' -> 'paid'/'failed' for the new Buy Now flow.
alter table public.orders
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed')),
  add column unit_price integer,
  add column platform_fee integer,
  add column total integer,
  add column payment_reference text;

-- Tighten the existing buyer-insert policy so a client can never insert
-- a row directly claiming payment_status = 'paid' — only the
-- confirm-marketplace-payment Edge Function (service role) can do that.
drop policy "Buyers can place an order" on public.orders;
create policy "Buyers can place an order"
  on public.orders for insert
  with check (auth.uid() = buyer_id and payment_status in ('unpaid', 'pending'));

-- A shop owner can still update order status (existing policy), but
-- this trigger stops that same update from also flipping payment_status
-- — same pattern as businesses.verified in migration 0001.
create or replace function public.prevent_payment_status_change_by_owner()
returns trigger language plpgsql as $$
begin
  if new.payment_status is distinct from old.payment_status and auth.role() <> 'service_role' then
    new.payment_status := old.payment_status;
  end if;
  return new;
end;
$$;

create trigger orders_prevent_payment_status_change_by_owner
  before update on public.orders
  for each row execute function public.prevent_payment_status_change_by_owner();

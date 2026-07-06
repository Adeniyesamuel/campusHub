-- Phase 3: events, ticket tiers, and tickets
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0003.

-- ---------- events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  organizer_name text not null,
  organizer_email text not null,
  organizer_phone text not null,
  title text not null,
  date text not null,
  time text,
  venue text not null,
  tag text,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Events are publicly readable"
  on public.events for select
  using (true);

create policy "Organizers can create events"
  on public.events for insert
  with check (auth.uid() = organizer_id);

-- ---------- ticket_tiers ----------
create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  price integer not null default 0,
  description text,
  quantity_total integer not null check (quantity_total > 0),
  created_at timestamptz not null default now()
);

alter table public.ticket_tiers enable row level security;

create policy "Ticket tiers are publicly readable"
  on public.ticket_tiers for select
  using (true);

-- needs events to exist first, since it checks organizer_id on that table
create or replace function public.is_event_organizer(target_event_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.events
    where id = target_event_id and organizer_id = auth.uid()
  );
$$;

create policy "Organizers can add tiers to their own event"
  on public.ticket_tiers for insert
  with check (public.is_event_organizer(event_id));

-- ---------- tickets ----------
-- No update policy at all here, on purpose: only the service role (used
-- inside the payment-confirmation Edge Function) can ever move a ticket
-- from 'pending' to 'paid'/'failed'. Regular clients can only insert a
-- 'pending' reservation and read their own.
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.ticket_tiers(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  qty integer not null check (qty > 0),
  total integer not null,
  code text not null unique,
  payment_reference text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;

-- needs ticket_tiers + events to exist first, since it joins both
create or replace function public.is_tier_event_organizer(target_tier_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.ticket_tiers t
    join public.events e on e.id = t.event_id
    where t.id = target_tier_id and e.organizer_id = auth.uid()
  );
$$;

create policy "Buyers and organizers can read their tickets"
  on public.tickets for select
  using (auth.uid() = buyer_id or public.is_tier_event_organizer(tier_id));

create policy "Buyers can reserve a pending ticket"
  on public.tickets for insert
  with check (auth.uid() = buyer_id and status = 'pending');

-- ---------- public "tickets left" count ----------
-- tickets is buyer/organizer-only, so the public events screen needs a
-- way to know how many are left per tier without reading the table
-- directly. Mirrors get_shop_sales_count from migration 0003. Needs
-- tickets to exist first.
create or replace function public.get_tier_sold_counts()
returns table(tier_id uuid, sold bigint)
language sql
security definer
set search_path = public
stable
as $$
  select tier_id, coalesce(sum(qty), 0)
  from public.tickets
  where status = 'paid'
  group by tier_id;
$$;

grant execute on function public.get_tier_sold_counts() to anon, authenticated;

-- ---------- event banner storage ----------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "Event images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "Organizers can upload their own event images"
  on storage.objects for insert
  with check (bucket_id = 'event-images' and auth.uid()::text = (storage.foldername(name))[1]);

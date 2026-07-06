-- Phase 2: marketplace + vendor shops
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0001.

-- ---------- helper: is the current user the owner of this shop? ----------
-- Reused by products/orders/sales RLS policies below instead of repeating
-- the same subquery on every policy.
create or replace function public.is_shop_owner(target_shop_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.businesses
    where id = target_shop_id and owner_id = auth.uid()
  );
$$;

-- ---------- products ----------
-- A vendor's own inventory/SKUs. Never exposed to buyers directly —
-- buyers only ever see a listing (below), which snapshots the fields
-- it needs at the time it's posted. So cost/stock stay owner-only.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price integer not null,
  cost integer not null default 0,
  stock integer not null default 0,
  image_url text,
  listed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Vendors can read their own products"
  on public.products for select
  using (public.is_shop_owner(shop_id));

create policy "Vendors can insert their own products"
  on public.products for insert
  with check (public.is_shop_owner(shop_id));

create policy "Vendors can update their own products"
  on public.products for update
  using (public.is_shop_owner(shop_id));

create policy "Vendors can delete their own products"
  on public.products for delete
  using (public.is_shop_owner(shop_id));

-- ---------- listings ----------
-- Public marketplace items. Either posted directly ("Sell" flow) or
-- pushed from a product via product_id ("List from inventory" flow).
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  price integer not null,
  category text not null,
  location text,
  description text,
  image_url text,
  status text not null default 'active' check (status in ('active', 'sold')),
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "Listings are publicly readable"
  on public.listings for select
  using (true);

create policy "Sellers can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update their own listings"
  on public.listings for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete their own listings"
  on public.listings for delete
  using (auth.uid() = seller_id);

-- ---------- shop_reviews ----------
create table public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.businesses(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  text text,
  created_at timestamptz not null default now(),
  unique (shop_id, reviewer_id)
);

alter table public.shop_reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.shop_reviews for select
  using (true);

create policy "Buyers can leave a review"
  on public.shop_reviews for insert
  with check (auth.uid() = reviewer_id);

-- ---------- shop_follows ----------
create table public.shop_follows (
  shop_id uuid not null references public.businesses(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, follower_id)
);

alter table public.shop_follows enable row level security;

create policy "Follows are publicly readable"
  on public.shop_follows for select
  using (true);

create policy "Users can follow a shop"
  on public.shop_follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow a shop"
  on public.shop_follows for delete
  using (auth.uid() = follower_id);

-- ---------- orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  qty integer not null check (qty > 0),
  status text not null default 'new' check (status in ('new', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Buyers and shop owners can read their orders"
  on public.orders for select
  using (auth.uid() = buyer_id or public.is_shop_owner(shop_id));

create policy "Buyers can place an order"
  on public.orders for insert
  with check (auth.uid() = buyer_id);

create policy "Shop owners can update order status"
  on public.orders for update
  using (public.is_shop_owner(shop_id));

-- ---------- sales ----------
-- Append-only ledger for the vendor dashboard's profit tracking.
-- Kept separate from orders so historical profit is stable even if a
-- product's price/cost changes later.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty integer not null check (qty > 0),
  unit_price integer not null,
  unit_cost integer not null,
  total integer not null,
  profit integer not null,
  created_at timestamptz not null default now()
);

alter table public.sales enable row level security;

create policy "Vendors can read their own sales"
  on public.sales for select
  using (public.is_shop_owner(shop_id));

create policy "Vendors can record their own sales"
  on public.sales for insert
  with check (public.is_shop_owner(shop_id));

-- ---------- storage buckets ----------
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Listing images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "Users can upload their own listing images"
  on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Product images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Vendors can upload their own product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.uid()::text = (storage.foldername(name))[1]);

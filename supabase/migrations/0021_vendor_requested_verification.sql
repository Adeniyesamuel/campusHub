-- Launch sweep follow-up, chunk 2: vendor-requested verification with a track record requirement
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0020.

-- ---------- configurable thresholds (same pattern as platform_fees) ----------
create table public.verification_requirements (
  key text primary key check (key = 'vendor'),
  min_completed_sales integer not null default 5,
  min_avg_rating numeric not null default 4.0,
  min_rating_count integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table public.verification_requirements enable row level security;

create policy "Verification requirements are publicly readable"
  on public.verification_requirements for select
  using (true);

insert into public.verification_requirements (key, min_completed_sales, min_avg_rating, min_rating_count)
values ('vendor', 5, 4.0, 3);

-- ---------- request tracking ----------
-- Selling stays open to every vendor regardless of verification status
-- (unchanged) — this only gates whether a vendor shows up in the admin
-- queue at all. Today, EVERY never-reviewed vendor implicitly sits in
-- that queue; after this, only vendors who've both met the thresholds
-- and explicitly asked will appear (see the admin query change needed
-- client-side).
alter table public.businesses add column verification_requested_at timestamptz;

-- Re-checks the thresholds server-side — the client also gates the
-- button, but this is the real enforcement, same pattern as every other
-- self-attested action in this app.
create or replace function public.request_business_verification(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  biz record;
  req record;
  sales_count integer;
  rating_avg numeric;
  rating_count integer;
begin
  select * into biz from public.businesses where id = p_business_id;
  if not found then
    raise exception 'Business not found';
  end if;
  if biz.owner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if biz.verified then
    raise exception 'Already verified';
  end if;

  select * into req from public.verification_requirements where key = 'vendor';

  select count(*) into sales_count from public.sales where shop_id = p_business_id;
  select coalesce(avg(stars), 0), count(*) into rating_avg, rating_count
    from public.shop_reviews where shop_id = p_business_id;

  if sales_count < req.min_completed_sales then
    raise exception 'Not enough completed sales yet (% of % needed)', sales_count, req.min_completed_sales;
  end if;
  if rating_count < req.min_rating_count then
    raise exception 'Not enough ratings yet (% of % needed)', rating_count, req.min_rating_count;
  end if;
  if rating_avg < req.min_avg_rating then
    raise exception 'Average rating too low (% of % needed)', round(rating_avg, 1), req.min_avg_rating;
  end if;

  -- a fresh request also clears any earlier rejection, so a vendor who
  -- improves after being rejected can be reviewed again rather than
  -- being permanently excluded from the queue
  update public.businesses
  set verification_requested_at = now(), rejected_at = null
  where id = p_business_id;
end;
$$;

grant execute on function public.request_business_verification(uuid) to authenticated;

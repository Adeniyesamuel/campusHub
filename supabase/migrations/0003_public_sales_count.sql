-- Phase 2 follow-up: expose a public "completed sales" count per shop
-- without making the sales ledger itself publicly readable.
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0002.

create or replace function public.get_shop_sales_count(target_shop_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*) from public.sales where shop_id = target_shop_id;
$$;

grant execute on function public.get_shop_sales_count(uuid) to anon, authenticated;

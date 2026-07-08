-- Fix: 0018 added profiles.is_admin without a protective trigger. The
-- existing Phase 1 policy ("Users can update their own profile", using
-- auth.uid() = id) has no column restriction, so any authenticated user
-- could currently self-grant admin via a direct client update. This is
-- the same protection businesses.verified already has — closes the gap
-- before the admin panel goes any further.
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0018.

create or replace function public.prevent_is_admin_self_update()
returns trigger language plpgsql as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_is_admin_self_update
  before update on public.profiles
  for each row execute function public.prevent_is_admin_self_update();

-- Note: the row-level policy still only ever lets someone update their
-- OWN profile row (auth.uid() = id) — so even an existing admin can't
-- grant is_admin to someone else through the client, only through this
-- same trigger's is_admin() bypass acting on their own row, or via the
-- SQL Editor (service role) as today. That's intentional: this repo
-- has no "add another admin" UI, so the SQL Editor remains the only way
-- to add a second admin, which is fine for now.

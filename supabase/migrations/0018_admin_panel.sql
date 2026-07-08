-- Launch sweep, part 1: admin panel — vendor verification queue + message reports inbox
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0017.

-- ---------- admin flag ----------
-- A boolean on profiles rather than hardcoding your user ID into every
-- policy — easier to read, and works if you ever want a second admin.
-- Nothing in this migration sets it to true for anyone; you do that
-- yourself with a one-off UPDATE after running this (SQL given below,
-- outside the migration file on purpose — a migration shouldn't bake in
-- a specific person's UUID).
alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;

-- ---------- vendor verification queue ----------
-- rejected_at is new: today's schema only has the verified boolean, so
-- there's no way to distinguish "never reviewed" from "reviewed and
-- declined" — Reject needs that distinction to mean anything. Verifying
-- clears a previous rejection (a business can't be both at once);
-- rejecting leaves verified false and stamps when it was declined.
alter table public.businesses add column rejected_at timestamptz;

-- The existing Phase 1 trigger only ever let the service role touch
-- verified (so vendors can't self-verify). Extending it to also allow
-- is_admin() — otherwise an admin's own update would be silently
-- reverted by this same trigger, since it fires regardless of who or
-- what issued the UPDATE.
create or replace function public.prevent_verified_self_update()
returns trigger language plpgsql as $$
begin
  if (new.verified is distinct from old.verified or new.rejected_at is distinct from old.rejected_at)
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    new.verified := old.verified;
    new.rejected_at := old.rejected_at;
  end if;
  return new;
end;
$$;

-- Single entry point for both actions, so the verified/rejected_at pair
-- always ends up in a consistent state (never both "verified" and
-- "rejected" at once) rather than trusting the client to clear the
-- other field itself.
create or replace function public.admin_set_business_verification(p_business_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('verified', 'rejected', 'pending') then
    raise exception 'Invalid status';
  end if;

  update public.businesses
  set verified = (p_status = 'verified'),
      rejected_at = case when p_status = 'rejected' then now() else null end
  where id = p_business_id;
end;
$$;

grant execute on function public.admin_set_business_verification(uuid, text) to authenticated;

-- ---------- message reports inbox ----------
-- message_reports has had no select policy at all since migration
-- 0009 (deliberately — reports were only ever readable via the SQL
-- Editor). This is the first policy giving any client role read
-- access, scoped to admins only.
alter table public.message_reports add column reviewed_at timestamptz;

create policy "Admins can read all message reports"
  on public.message_reports for select
  using (public.is_admin());

create policy "Admins can mark reports reviewed"
  on public.message_reports for update
  using (public.is_admin())
  with check (public.is_admin());

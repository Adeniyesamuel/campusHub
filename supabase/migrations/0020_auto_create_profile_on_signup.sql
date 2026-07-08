-- Launch sweep, part 2: email confirmation support
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0019.

-- Today, completeAuth() calls signUp() then immediately inserts the
-- profiles (and, for vendors, businesses) row using the brand-new
-- session. That only works because email confirmation is currently
-- off, so signUp() returns an active session instantly. Once
-- confirmation is on, signUp() returns session: null until the user
-- clicks the email link — auth.uid() is null until then, so those
-- client-side inserts would be rejected by RLS.
--
-- This is the standard fix: a trigger on auth.users that reads
-- raw_user_meta_data (which Supabase populates immediately at signUp()
-- time, before confirmation) and creates the profiles/businesses rows
-- itself, security definer, regardless of confirmation status. The
-- client-side signup wizard will be changed to pass all the collected
-- wizard data via signUp(email, password, { data: {...} }) instead of
-- calling sbInsertProfile()/sbInsertBusiness() afterward — those two
-- functions become dead code for the signup path once this ships (the
-- "switch account type" flow in Settings doesn't call them today either
-- — it's client-only per PENDING.md, unaffected either way).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  biz jsonb := meta -> 'business';
begin
  insert into public.profiles (id, role, vendor_type, name, matric, level, dept)
  values (
    new.id,
    meta ->> 'role',
    meta ->> 'vendor_type',
    coalesce(meta ->> 'name', 'CampusHub User'),
    meta ->> 'matric',
    meta ->> 'level',
    meta ->> 'dept'
  );

  if meta ->> 'role' = 'vendor' and biz is not null then
    insert into public.businesses (owner_id, name, category, description, phone, location, social_handle, cac_number)
    values (
      new.id,
      biz ->> 'name',
      biz ->> 'category',
      biz ->> 'description',
      biz ->> 'phone',
      biz ->> 'location',
      biz ->> 'social_handle',
      biz ->> 'cac_number'
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing profiles/businesses RLS policies (auth.uid() = id /
-- auth.uid() = owner_id, from migration 0001) are untouched — this
-- trigger bypasses them entirely via security definer, and they still
-- do their job for any future direct client insert (there isn't one
-- today, but no reason to remove a working policy).

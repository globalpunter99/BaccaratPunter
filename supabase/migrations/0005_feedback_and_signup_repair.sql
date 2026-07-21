-- ============================================================================
-- 0005_feedback_and_signup_repair.sql
--
-- Two things:
--   1. feedback  — user-submitted feedback. Anyone signed in may INSERT their
--                  own row; only the super admin may read the list. There is
--                  deliberately no update/delete policy: feedback is a log.
--   2. Signup repair — the 0003 signup trigger could abort the whole auth
--      signup, which is what makes a normal account impossible to register:
--        * username is NOT NULL, but its value was
--          `coalesce(meta->>'username', split_part(new.email,'@',1))`. Both
--          arms are NULL when the identity carries no email (or metadata is
--          absent), so the insert raised a not-null violation.
--        * The trigger is AFTER INSERT on auth.users in the SAME transaction,
--          so ANY exception it raises rolls the new auth user back. The user
--          sees "Database error saving new user" and no account is created.
--      Now the username falls back through to 'player', and the whole insert
--      is wrapped so a profile problem can never block a signup. A missing
--      profile row is then repaired on next sign-in by ensure_profile().
--
-- Run in the Supabase SQL Editor after 0003 and 0004.
-- ============================================================================

-- ── feedback ────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Mirrored at submit time so the list still reads correctly if the account
  -- is later renamed, and so the admin list needs no join.
  username    text not null default '',
  email       text not null default '',
  subject     text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Submit: signed-in, active, and only as yourself.
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert with check (user_id = auth.uid() and public.is_active_user());

-- Read: super admin only. A user cannot even read back their own submission,
-- which is what keeps the list an admin-only surface.
drop policy if exists "feedback select admin" on public.feedback;
create policy "feedback select admin" on public.feedback
  for select using (public.is_super_admin());

drop policy if exists "feedback delete admin" on public.feedback;
create policy "feedback delete admin" on public.feedback
  for delete using (public.is_super_admin());

-- ── Signup trigger, hardened ────────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email, role)
  values (
    new.id,
    -- nullif() catches the empty-string case too, so a blank username in the
    -- signup metadata still falls through to the email local-part.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'player'
    ),
    coalesce(new.email, ''),
    case when lower(coalesce(new.email, '')) = lower(public.super_admin_email())
         then 'super_admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let a profile problem roll back the auth signup. The account is
  -- created; ensure_profile() below repairs the missing row at next sign-in.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- ── Self-heal: create the caller's profile row if it is missing ─────────────
-- Called by the client right after sign-in when no profile comes back. Fixes
-- accounts that were created while the trigger above was raising, without any
-- dashboard work. Security definer because the profiles table has no INSERT
-- policy (rows are meant to originate from the trigger).
create or replace function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into p from public.profiles where id = auth.uid();
  if found then
    return p;
  end if;

  select * into u from auth.users where id = auth.uid();

  insert into public.profiles (id, username, email, role)
  values (
    u.id,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'player'
    ),
    coalesce(u.email, ''),
    case when lower(coalesce(u.email, '')) = lower(public.super_admin_email())
         then 'super_admin' else 'user' end
  )
  on conflict (id) do nothing;

  select * into p from public.profiles where id = auth.uid();
  return p;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- ── Backfill any auth user that never got a profile row ─────────────────────
insert into public.profiles (id, username, email, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'player'
  ),
  coalesce(u.email, ''),
  case when lower(coalesce(u.email, '')) = lower(public.super_admin_email())
       then 'super_admin' else 'user' end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

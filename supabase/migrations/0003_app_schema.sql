-- ============================================================================
-- 0003_app_schema.sql — BaccaratPunter application schema (supersedes 0001/2)
--
-- Run in the Supabase SQL Editor (or `supabase db push`). Idempotent-ish:
-- safe to re-run on a fresh project; on a project holding 0001/0002 it DROPS
-- those prototype tables (they held no production data and 0002 exposed an
-- insecure anon-full-access policy).
--
-- Design:
--   profiles    one row per auth user — username/email mirror, role, status,
--               device passcode + Face-ID preference. Super admin manages all.
--   sessions    one row per recorded shoe (live, uploaded, or practice save).
--               Queryable metadata in columns; the hand list as jsonb (hands
--               are always read/written as a unit with their session).
--   user_state  one row per user — the app's settings documents as jsonb:
--               payout settings (casinos + game types + odds), player-profile
--               questionnaire answers, calibration answers, favourites,
--               hidden (deleted) session ids.
--   storage     private "screen-photos" bucket, per-user folders (wired in a
--               later client pass; policies ready).
--
-- Security: RLS on everything. Users see only their own rows and only while
-- their account is active. A super_admin (bootstrapped by email at signup)
-- can read and manage every row. Role/status changes by non-admins are
-- blocked by trigger, so a user can never escalate their own account.
-- ============================================================================

-- The email that becomes super admin when it signs up (edit before running
-- if you want a different bootstrap account).
create or replace function public.super_admin_email() returns text
language sql immutable as $$ select 'cheng_hl@yahoo.com' $$;

-- ── Drop the 0001/0002 prototype tables ─────────────────────────────────────
drop table if exists public.rounds cascade;
drop table if exists public.sessions cascade;
drop table if exists public.boards cascade;
drop table if exists public.strategy_configs cascade;

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null default '',
  email       text not null default '',
  role        text not null default 'user'
              check (role in ('super_admin', 'admin', 'user')),
  status      text not null default 'active'
              check (status in ('active', 'disabled')),
  -- Device-lock conveniences (not account security): 4-digit passcode and
  -- the Face-ID preference, synced from the Settings > Account card.
  passcode    text,
  face_id     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── sessions ────────────────────────────────────────────────────────────────
create table public.sessions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- App-side string id ("s1-P2" etc.) — practice saves echo their original.
  id           text not null,
  date         text not null default '',
  venue        text not null default '',
  table_number text not null default '',
  session_type text not null default 'live' check (session_type in ('live', 'extra')),
  game_type    text not null default '',
  commission   boolean not null default false,
  notes        text,
  practice_of  text,
  -- Hand[] — [{id, outcome, bankerPair, playerPair, natural, variant?,
  --            tieTotal?, betResult?}, ...] in hand order.
  hands        jsonb not null default '[]',
  saved_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index sessions_user_idx on public.sessions (user_id, saved_at desc);

-- ── user_state (one row per user; settings documents) ───────────────────────
create table public.user_state (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  -- PayoutSettings: { defaults: PayoutTable,
  --                   casinos: [{id, name, games: [{id, name, table}]}] }
  payout_settings  jsonb,
  -- Answers: the 8 profile-questionnaire answers (question id -> option text)
  profile_answers  jsonb,
  -- CalibrationState: { answers: CalAnswer[], completed: string[] }
  calibration      jsonb,
  -- string[] of favourite session ids (covers built-in demo shoes too)
  favourites       jsonb not null default '[]',
  -- string[] of deleted/hidden session ids
  hidden_sessions  jsonb not null default '[]',
  updated_at       timestamptz not null default now()
);

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Security definer so policies can consult profiles without recursive RLS.
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- ── Signup trigger: create the profile row, bootstrap the super admin ───────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    case when lower(new.email) = lower(public.super_admin_email())
         then 'super_admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Escalation guard: only a super admin may change role or status ──────────
create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_super_admin() then
    raise exception 'Only a super admin can change role or status';
  end if;
  -- No one demotes or disables the bootstrap super admin (lock-out guard).
  if lower(old.email) = lower(public.super_admin_email())
     and (new.role <> 'super_admin' or new.status <> 'active') then
    raise exception 'The bootstrap super admin cannot be demoted or disabled';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ── updated_at maintenance ──────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger sessions_touch  before update on public.sessions
  for each row execute function public.touch_updated_at();
create trigger user_state_touch before update on public.user_state
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.sessions   enable row level security;
alter table public.user_state enable row level security;

-- profiles: read/update own row; super admin reads and updates all.
-- (Inserts come only from the signup trigger; deletes are super admin only —
-- note that deleting a profile row does NOT delete the auth user; full user
-- deletion is done from the Supabase dashboard or a service-role function.)
create policy "profiles select own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy "profiles update own or admin" on public.profiles
  for update using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());
create policy "profiles delete admin" on public.profiles
  for delete using (public.is_super_admin());

-- sessions / user_state: owner (while active) or super admin, all operations.
create policy "sessions owner or admin" on public.sessions
  for all
  using ((user_id = auth.uid() and public.is_active_user()) or public.is_super_admin())
  with check ((user_id = auth.uid() and public.is_active_user()) or public.is_super_admin());

create policy "user_state owner or admin" on public.user_state
  for all
  using ((user_id = auth.uid() and public.is_active_user()) or public.is_super_admin())
  with check ((user_id = auth.uid() and public.is_active_user()) or public.is_super_admin());

-- ── Storage: private per-user screen-photo bucket ───────────────────────────
insert into storage.buckets (id, name, public)
values ('screen-photos', 'screen-photos', false)
on conflict (id) do nothing;

-- Objects live under <user_id>/<screen_id>/<slot>.jpg
create policy "photos owner read" on storage.objects
  for select using (
    bucket_id = 'screen-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin())
  );
create policy "photos owner write" on storage.objects
  for insert with check (
    bucket_id = 'screen-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );
create policy "photos owner delete" on storage.objects
  for delete using (
    bucket_id = 'screen-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin())
  );

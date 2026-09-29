-- 0007_casinos.sql — shared casino directory.
--
-- Casinos move out of user_state.payout_settings (a per-user jsonb blob) into
-- their own table so a super admin can publish "universal" casinos that every
-- user sees, while each user still keeps their own private list.
--
--   owner      the account that created the casino
--   universal  true  → visible to every user (super admin only may set this)
--              false → private to the owner
--   games      the baccarat game variants offered, as jsonb:
--              [{ id, name, table, commission, sideBets: [] }, …]
--              Every casino carries a "Traditional" game (5% commission,
--              no side bets); other variants are added by the owner.
--
-- Reuses the helpers from 0003: is_super_admin(), is_active_user(),
-- touch_updated_at().

create table public.casinos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  universal  boolean not null default false,
  games      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index casinos_owner_idx on public.casinos (owner);
create index casinos_universal_idx on public.casinos (universal) where universal;

create trigger casinos_touch before update on public.casinos
  for each row execute function public.touch_updated_at();

alter table public.casinos enable row level security;

-- Visible: your own casinos, any universal casino, or (super admin) all.
create policy "casinos select" on public.casinos
  for select using (
    owner = auth.uid() or universal or public.is_super_admin()
  );

-- Create your own rows while active. Only a super admin may mark one universal.
create policy "casinos insert" on public.casinos
  for insert with check (
    ((owner = auth.uid() and public.is_active_user()) or public.is_super_admin())
    and (universal = false or public.is_super_admin())
  );

-- Edit your own (or, for a super admin, any) row; the universal flag stays
-- super-admin-only on update too.
create policy "casinos update" on public.casinos
  for update using (
    (owner = auth.uid() and public.is_active_user()) or public.is_super_admin()
  ) with check (
    ((owner = auth.uid() and public.is_active_user()) or public.is_super_admin())
    and (universal = false or public.is_super_admin())
  );

create policy "casinos delete" on public.casinos
  for delete using (
    (owner = auth.uid() and public.is_active_user()) or public.is_super_admin()
  );

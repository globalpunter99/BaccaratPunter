-- Boards (recorded shoes) and saved strategy configurations.
-- Apply via the Supabase SQL editor or the Supabase CLI.

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Compact outcome string, most recent last: P = player, B = banker, T = tie.
  outcomes text not null default '',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists strategy_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  strategy_key text not null,
  params jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table boards enable row level security;
alter table strategy_configs enable row level security;

-- Single-user app with no auth yet: allow the anon key full access.
-- Anyone holding the anon key can read/write these tables — tighten to
-- authenticated policies if you ever add Supabase Auth.
create policy "anon all boards" on boards
  for all to anon using (true) with check (true);

create policy "anon all strategy_configs" on strategy_configs
  for all to anon using (true) with check (true);

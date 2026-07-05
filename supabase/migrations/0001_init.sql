-- Initial schema for storing baccarat sessions and rounds.
-- Apply via the Supabase SQL editor or the Supabase CLI.

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  strategy text not null default 'streak',
  note text
);

create table if not exists rounds (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions (id) on delete cascade,
  round_no int not null,
  outcome text not null check (outcome in ('player', 'banker', 'tie')),
  player_total int not null,
  banker_total int not null,
  created_at timestamptz not null default now()
);

create index if not exists rounds_session_idx on rounds (session_id);

-- Row Level Security: enable and lock down by default.
-- Add policies once you wire up auth.
alter table sessions enable row level security;
alter table rounds enable row level security;

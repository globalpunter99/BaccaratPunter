-- ============================================================================
-- 0004_bets_and_details.sql — recorded plays + session detail fields
--
-- Run in the Supabase SQL Editor after 0003. Adds to public.sessions:
--
--   bets     jsonb — SessionBet[]: every hand where the player made a main
--            call, with or without money. { handId, slip: BetSlip, staked,
--            returned, profit }. Call-only plays carry stake/profit 0.
--            This is the source for the "You — as recorded" lens and the
--            real money P/L in Prediction Analysis.
--   details  jsonb — table context from Session Details that isn't queryable
--            metadata: { shoeNumber, minBet, maxBet, tiger, dragon }.
-- ============================================================================

alter table public.sessions
  add column if not exists bets jsonb not null default '[]',
  add column if not exists details jsonb;

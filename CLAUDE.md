# CLAUDE.md — BaccaratPunter

Context for Claude Code. Read this before making changes.

## What this is

A Vite + React + TypeScript app for **recording baccarat boards, backtesting
strategy variables, and getting live suggestions**. It is a study/simulation
tool — no wagering, no payments, no real money. Baccarat rounds are
independent events; past boards do not change future odds. Treat backtests as
*descriptive* of a history, never as predictive of future results, and keep
that framing in any UI copy or features.

## Stack

- Frontend: Vite 5, React 18, TypeScript (strict)
- Backend: Supabase (Postgres). Client in `src/lib/supabase.ts`, reads
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env.
- Hosting: Vercel (Vite preset, see `vercel.json`)
- Repo: https://github.com/globalpunter99/BaccaratPunter (branch `main`)

## Commands

```bash
npm install
npm run dev      # local dev server
npm run build    # tsc -b && vite build  (must pass before every commit)
npm run lint     # tsc --noEmit  (type-check only)
```

Always run `npm run build` before committing; the project treats a clean
type-check + build as the bar for "done." There is no test suite yet — if you
add non-trivial game/strategy logic, add tests (Vitest) rather than relying on
manual checks.

## Layout

```
src/
  game/baccarat.ts    Rules engine: scoring + third-card draw rules (pure)
  game/strategy.ts    Strategy registry — each strategy declares tunable
                      `params` (ParamSpec) consumed by UI + backtester
  game/backtest.ts    Backtest engine: payouts, staking, drawdown
  lib/supabase.ts     Supabase client (null when env not configured)
  lib/db.ts           Boards + strategy-config persistence
  components/         BoardsTab, BacktestTab, PredictTab, shared.tsx
  App.tsx             Tab shell (boards | backtest | predict)
supabase/migrations/  0001 sessions/rounds · 0002 boards/strategy_configs
```

## Conventions

- **Adding a strategy:** add an entry to the `strategies` registry in
  `src/game/strategy.ts`. Declare its tunable variables in `params` as
  `ParamSpec` (label/min/max/step/default) and read them in `run(ctx, params)`.
  It then appears in the Backtest and Predict dropdowns automatically, with its
  variables editable — no other wiring needed.
- Keep `game/` logic pure and framework-free; UI concerns live in `components/`.
- Prefer small, composable pure functions (see `nonTie`, `tailStreak`,
  `tailChop` for the house style).

## Backend / secrets

- `.env` (gitignored) holds the local `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. The anon key is public by design (shipped in the
  client bundle); RLS protects the data.
- **Never** put the Supabase `service_role` key — or any secret — into a
  `VITE_`-prefixed var or anywhere in client code. Vite inlines those into the
  browser bundle. This app has no server, so `service_role` has no place here.
- RLS is enabled on all tables but no access policies exist yet. Adding auth +
  policies is an open task before real multi-user use.
- The same two env vars must be set in Vercel's project settings for deploys.

## Current state / open items

- Code is scaffolded and pushed to `main` on GitHub.
- Supabase project is provisioned; `.env` is populated locally.
- Verify the SQL migrations in `supabase/migrations/` have been applied to the
  Supabase project (SQL Editor). `0001` and `0002` should both be run.
- This `CLAUDE.md` was committed and pushed to `origin/main` from another
  environment. The local repo is still on branch `master` at the initial commit,
  with stale `.git/*.lock` files and a working tree full of uncommitted app work
  (tabs, backtest engine, migration `0002`, etc.). To reconcile, once, on the
  machine:
  `rm -f .git/HEAD.lock .git/refs/heads/master.lock .git/objects/maintenance.lock`
  then `git branch -M main`, then `git fetch origin && git reset --soft origin/main`
  (absorbs the pushed CLAUDE.md commit without touching your working tree). Then
  review and commit the remaining app changes.
- Not yet done: user auth + RLS policies, Vercel env vars / first deploy, tests.

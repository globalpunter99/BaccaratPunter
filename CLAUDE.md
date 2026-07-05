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

```bash
npm test        # vitest run — game/roads.ts and future game logic
```

Always run `npm run build` before committing; the project treats a clean
type-check + build as the bar for "done." Vitest is set up (`npm test`) — add
tests alongside any non-trivial game/strategy logic rather than relying on
manual checks.

## Layout

```
src/
  game/baccarat.ts    Rules engine: scoring + third-card draw rules (pure)
  game/roads.ts       Road derivation: Bead Plate, Big Road, and the three
                      derived roads (Big Eye Boy / Small Road / Cockroach
                      Pig via `deriveRoad(stones, lookback)`). Pure functions
                      of the outcome list — nothing persisted. Not yet wired
                      into any component. See roads.test.ts for the algorithm
                      spelled out against known sequences.
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
  environment. Locally you are on `main` at the app-work commit, and
  `origin/main` is exactly one commit ahead (this file). `CLAUDE.md` sits in the
  working tree as an untracked-but-identical file. To sync, once, on the machine:
  `git fetch origin && git reset --soft origin/main`
  (fast-forwards the branch pointer without touching your working tree; the
  untracked CLAUDE.md becomes tracked and unmodified). If stale `.git/*.lock`
  files block git first, remove them:
  `rm -f .git/*.lock .git/refs/heads/*.lock .git/objects/*.lock`
- Not yet done: user auth + RLS policies, Vercel env vars / first deploy.
- `game/roads.ts` (Bead Plate, Big Road, Big Eye Boy/Small Road/Cockroach Pig)
  is written and unit-tested (`npm test`) but has no UI yet — no component
  renders these grids. That's the natural next step: a road-display component
  fed by `toBigRoad`/`bigEyeBoy` etc., likely reusing the outcome data already
  flowing through `BoardsTab`/`PredictTab`.
- The derived-road algorithm (`deriveRoad`) implements the commonly published
  "compare against an earlier column" rule. It's internally consistent (tests
  pass) but hasn't been checked against a real Macau screen/known shoe —
  worth a sanity pass before leaning on it for anything beyond a visual
  reference.
- Bigger product direction (discussed outside this repo's session): phone
  capture + web admin split, a "playability" confidence layer showing the
  user's own rule signal alongside a self-tuning "machine" model, and a
  profiling questionnaire to calibrate what "aligned roads" means for this
  specific player. None of that is built yet — `roads.ts` is the first piece
  it all sits on.

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
  game/beadExtract.ts Bead-plate photo reader: pure pixel → result-sequence
                      detector (colour blobs → grid fit → column-major read).
                      Handles BOTH marker styles casinos use — solid discs and
                      hollow rings — on dark or light panels; a marker is
                      identified by being radially symmetric, not by how much
                      of its box it fills. Reports failure rather than
                      guessing; browser glue is in `lib/beadPhoto.ts`.
  game/roads.ts       Road derivation: Bead Plate, Big Road, and the three
                      derived roads (Big Eye Boy / Small Road / Cockroach
                      Pig via `deriveRoad(stones, lookback)`). Pure functions
                      of the outcome list — nothing persisted. Not yet wired
                      into any component. See roads.test.ts for the algorithm
                      spelled out against known sequences.
  game/strategy.ts    Strategy registry — each strategy declares tunable
                      `params` (ParamSpec) consumed by UI + backtester
  game/backtest.ts    Backtest engine: payouts, staking, drawdown
  lib/supabase.ts     Supabase client (null when env not configured → local mode)
  lib/cloud.ts        Cloud sync: hydrate localStorage cache at login,
                      write-through push on every store save
  lib/auth.tsx        AuthProvider/useAuth — gates the app in cloud mode
  components/         Feature folders (session, library, roads, profile,
                      settings, auth, admin, …)
  App.tsx             Tab shell + auth gate + admin Users tab
supabase/migrations/  0003_app_schema.sql is THE schema (profiles, sessions,
                      user_state, RLS, super-admin bootstrap, storage bucket).
                      It drops the 0001/0002 prototype tables. 0005 adds the
                      feedback table and repairs the signup trigger.
supabase/functions/   Edge Functions. `feedback-notify` emails a copy of each
                      feedback submission; the destination address is an Edge
                      Function secret, never a VITE_ var, so it stays out of
                      the browser bundle.
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
- RLS is enabled on every table with owner-or-super-admin policies (migration
  `0003`). A disabled account loses all data access at the database layer.
- The same two env vars must be set in Vercel's project settings for deploys.

## Current state (Jul 2026)

**Working full-stack app, live at https://baccarat-punter.vercel.app/.**
Supabase project `xdjjoxrgthaexwtismma` is wired: migrations `0003` + `0004`
applied, `.env` populated locally, env vars set in Vercel. Sign-in gates the
app; the super admin is bootstrapped by email (see `super_admin_email()` in
`0003`) and gets a **Users** tab to promote/disable accounts.

Built and working:
- All 5 Macau roads (`RoadsDisplay.tsx`) with markers, cross-road tile
  highlight, Focus-to-here (Analyse only), predictor table, screen photos.
- Live Session: 3 record modes, My Bets pay engine, real signal engine +
  assistant, **End Session** saves the shoe (hands + bets) to the Library.
- **Stakes are tapped, never typed** (`components/session/BetSlipControls.tsx`,
  shared by Live Session and Practice Play). Stake fields are `<button>`s, not
  `<input>`s, because a focused input opens the virtual keyboard and makes the
  browser zoom/re-flow the page mid-shoe on a phone or tablet. Chips add to
  whichever field is active: the main bet by default, and a side bet only once
  its `$0` has been tapped while the side bets are expanded. Collapsing the
  side bets and Re-bet hand the chips back to the main bet. There is no
  per-chip undo by design — a mistake is Cleared and re-tapped. Do not
  reintroduce a numeric input here. **Clear Bet** empties only the highlighted
  field (`clearActiveBet`); `clearPendingBet` is the full reset and is reserved
  for post-settlement.
- Super admin can **delete** an account (Users tab, type-the-name confirm).
  Deleting an auth user needs rights the client must never hold, so it runs
  through `public.delete_user(uuid)` — SECURITY DEFINER, checks the caller is
  an active super admin, refuses self-delete and the bootstrap admin, clears
  the account's storage objects (no FK there) and lets everything else cascade
  (migration `0006`).
- Session Library: Analyse / Practice per shoe, casino + type filters. Every
  account's library, bets and calls are its own (`sessions` rows keyed by
  `user_id`, RLS owner-or-super-admin). Built-ins split in two:
  `FOUNDATION_SESSIONS` (s1, s2) ship with every account and are deletable;
  `DEMO_SESSIONS` (s1-P1, s3, s4, s5) are fabricated fixtures shown to the
  super admin only. Compose them with `visibleBuiltInSessions(isSuperAdmin)` —
  never import `mockSessions` into a user-facing list.
- Super admin "View data": Users tab → View data enters another account.
  `cloud.ts` tracks own vs acting user and points every read/write at the
  acting one, so all screens work unchanged; a gold banner names the account
  and exits. The acting id lives in sessionStorage (survives the reload that
  re-seeds every store, dies with the tab) and is re-checked against the
  super-admin role on each load. Entering/leaving clears the localStorage
  cache, so any of your own sessions whose cloud push had failed are lost —
  the same pre-existing caveat as sign-out.
- Profile hub (Establish / Calibrate / Upgrade / Review), Settings
  (account, casinos → game types → odds), Stats, Guide.
- Real signal/profile engine in `game/signals.ts` + `game/profile.ts`
  (walk-forward, descriptive of a ruleset — never a prediction claim).
- Responsive across phone/tablet/desktop (verified 375 / 768 / 1366); the nav
  tab strip collapses to a drop-down menu below 700px.
- Upload Session runs the real photo detector — it extracts the shoe and saves
  it to the Library (ids `U1`, `U2`, …), or refuses the photo outright.
- Roads grow columns without limit and scroll sideways; overflow is signalled
  by a small gold dot on the edge that has more columns (no scrollbar, to save
  vertical space). Mock session `s5` "Design Reference" is a deliberately
  wide shoe for reviewing that layout.
- Signed-in users stay signed in until 24h of inactivity (`lib/activity.ts`).
- Feedback tab: Subject/Topic dropdown + free text → `feedback` table (RLS:
  insert your own, read super-admin only) → confirmation screen. The super
  admin gets a Submit / All Submissions toggle on the same tab. An email copy
  goes out via the `feedback-notify` Edge Function when it is deployed; if it
  isn't, the submission still saves and the admin list still shows it.

Open items (nothing blocking):
- Practice saves don't record per-hand bets/calls yet, so their
  "as recorded" lens shows "No recorded bets".
- Live Session state is in-memory — a tab reload loses an unsaved shoe.
- Bundle ~547 KB; code-split `supabase-js` when convenient.
- Touch ergonomics polish (tap-target / keypad sizing) on phones.
- Foundation calibration boards are still simulated placeholders
  (`mock/foundationGames.ts`) — they should become real recorded games.
- The derived-road algorithm (`deriveRoad`) follows the commonly published
  "compare against an earlier column" rule and is unit-tested, but hasn't
  been checked against a real Macau screen — worth a sanity pass.

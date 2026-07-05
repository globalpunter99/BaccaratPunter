# Baccarat Strategy

A Vite + React + TypeScript app for dealing baccarat rounds, tracking outcomes, and testing strategies. Built to host on **Vercel** with **Supabase** as the backend, versioned on **GitHub**. For study and simulation only.

## Tech stack

- **Frontend:** Vite, React 18, TypeScript
- **Backend:** Supabase (Postgres + auth)
- **Hosting/preview:** Vercel
- **Version control:** GitHub

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Other scripts:

- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — serve the production build locally

## Project layout

```
src/
  game/baccarat.ts   Core rules engine (scoring + third-card draw rules)
  game/strategy.ts   Parameterized strategy layer — add your directive here
  game/backtest.ts   Backtest engine (payouts, staking progressions, drawdown)
  lib/supabase.ts    Supabase client (reads env vars)
  lib/db.ts          Boards + strategy-config persistence
  components/        Boards / Backtest / Predict tabs
  App.tsx            Tab shell
supabase/
  migrations/        SQL schema (sessions/rounds, boards, strategy_configs)
vercel.json          Vercel build config
.env.example         Template for Supabase env vars
```

## Connect your accounts

The code is scaffolded and committed locally. These steps need your logins.

### 1. GitHub

```bash
# from this folder, after creating an empty repo on github.com
git remote add origin https://github.com/<you>/baccarat-strategy.git
git branch -M main
git push -u origin main
```

### 2. Supabase

1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL and the `anon` public key.
3. Copy `.env.example` to `.env` and paste them in.
4. Apply the schema: open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, and run it.

### 3. Vercel

1. At https://vercel.com, **Add New → Project** and import the GitHub repo.
2. Framework preset auto-detects as **Vite** (see `vercel.json`).
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Every push to `main` gets a production deploy; every branch/PR gets a preview URL.

## Extending the strategy

`src/game/strategy.ts` exposes a registry. Add your directive as a new entry,
declaring its tunable variables in `params` — they become UI inputs and
backtest variables automatically:

```ts
strategies.myDirective = {
  label: "My directive",
  description: "What it does.",
  params: {
    threshold: { label: "Threshold", min: 1, max: 10, step: 1, default: 3 },
  },
  run: (ctx, p) => ({ bet: "banker", reason: "...", confidence: 0.5 }),
};
```

It shows up in the Backtest and Predict dropdowns with its variables editable.

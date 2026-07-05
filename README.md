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
  game/strategy.ts   Pluggable strategy layer — add your directive here
  lib/supabase.ts    Supabase client (reads env vars)
  App.tsx            UI: deal rounds, history, suggestions
supabase/
  migrations/        SQL schema for sessions + rounds
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

`src/game/strategy.ts` exposes a registry. Add your directive as a new entry:

```ts
strategies.myDirective = {
  label: "My directive",
  run: (ctx) => ({ bet: "banker", reason: "...", confidence: 0.5 }),
};
```

It will show up automatically in the strategy dropdown.

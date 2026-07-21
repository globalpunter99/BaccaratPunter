Continuing work on BaccaratPunter — a baccarat study/scoreboard + prediction-
analysis tool (a discipline tool, not a prediction seller).

Local: C:\Users\micha\Downloads\Claude Work\BaccaratPunter
Repo:  https://github.com/globalpunter99/BaccaratPunter (branch main)
Live:  https://baccarat-punter.vercel.app/

Before doing anything, read CLAUDE.md and my project memory
(project_baccarat.md, baccarat_product_philosophy.md and
baccarat_feedback_and_auth.md) for full context. All are current as of
21 Jul 2026 — trust them over any assumptions. Read once only and remember
for session.

State: working full-stack app. Supabase backend is LIVE (project
xdjjoxrgthaexwtismma). Migrations 0003, 0004 and 0005 are all applied.
.env is set locally and in Vercel. Sign-in gate works; I'm super admin
(cheng_hl@yahoo.com) with Users and Feedback tabs. Working tree is clean
and pushed at commit 234322b.

Landed in the last session:
- Feedback tab — Subject/Topic dropdown + free text, confirmation screen,
  and a submissions list only the super admin can reach. Backed by the
  `feedback` table (RLS: insert your own, read super-admin only).
- Signup repair — the 0003 trigger could raise a NOT NULL violation on
  username and, running inside the signup transaction, rolled the whole
  auth user back. That was the "cannot register regular users" bug.
  Migration 0005 fixes it and backfills missing profile rows.
- Per-user libraries — sessions/bets were already user-specific; the six
  hardcoded demo shoes were not. Now FOUNDATION_SESSIONS (s1, s2) ship
  with every account and are deletable, and DEMO_SESSIONS (s1-P1, s3, s4,
  s5) are super-admin-only fixtures. Use visibleBuiltInSessions(), never
  mockSessions, in any user-facing list.
- Super admin "View data" — Users tab enters another account; cloud.ts
  separates own vs acting user; gold banner names the account and exits.
- Stakes are tapped, never typed (components/session/BetSlipControls.tsx,
  shared by Live Session and Practice Play). No virtual keyboard opens
  during a shoe. Do not reintroduce a numeric stake input.
- Various Live Session and mobile UI fixes (button heights, centred road
  headers with the camera pinned right, 3x4 side-bet counters on phones).

NOT yet verified — please treat as open:
- "View data" has never been run against a real second account. It was
  built and type-checked but could not be tested, because there was only
  one account at the time.
- Regular-user registration has not been confirmed working since
  migration 0005 was applied.
- Feedback submit has not been confirmed end-to-end against the live
  database.

Known outstanding (nothing blocking):
- Feedback email copy to the team address needs the Edge Function
  deployed: supabase secrets set FEEDBACK_NOTIFY_EMAIL / RESEND_API_KEY /
  FEEDBACK_FROM_EMAIL, then supabase functions deploy feedback-notify.
  Until then submissions still save and the admin list still shows them.
  The address must stay a server secret — never a VITE_ var.
- Supabase Auth Site URL should point at the vercel.app domain, and the
  default SMTP only delivers to team addresses, so a real sender is needed
  before outside users can confirm signups.
- Entering/leaving "View data" clears the localStorage cache, so any of my
  own sessions whose cloud push had failed are lost. Same pre-existing
  caveat as sign-out; a push-retry queue would fix it properly.
- Subscription work deliberately not started — packages undecided.
- Practice saves still don't record per-hand bets/calls, so their
  "as recorded" lens shows "No recorded bets".
- Live Session state is in-memory — a tab reload loses an unsaved shoe.
- Bundle ~568 KB; code-split supabase-js when convenient.
- Foundation calibration boards are still simulated placeholders.

Workflow: I request a change → you edit → npm run build (must pass) →
npm test for game logic → commit → push to main → Vercel auto-deploys →
I review on the live URL. Keep commit messages plain — no parentheses,
slashes or fancy characters, they break the PowerShell here-string.

Note: the app sits behind a sign-in gate, so you cannot see it running
without credentials. To verify UI work locally, write a gitignored
.env.local with empty VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY —
that puts the app in its supported local mode with no auth gate — then
delete the file before building and committing.

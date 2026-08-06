Continuing work on BaccaratPunter — a baccarat study/scoreboard + prediction-
analysis tool (a discipline tool, not a prediction seller).

Local: C:\Users\micha\Downloads\Claude Work\BaccaratPunter
Repo:  https://github.com/globalpunter99/BaccaratPunter (branch main)
Live:  https://baccarat-punter.vercel.app/

Before doing anything, read CLAUDE.md and my project memory
(project_baccarat.md, baccarat_product_philosophy.md and
baccarat_feedback_and_auth.md) for full context. All are current — trust them
over any assumptions. Read once only and remember for the session.

State: working full-stack app. Supabase backend is LIVE (project
xdjjoxrgthaexwtismma). Migrations 0003, 0004, 0005 and 0006 are all applied.
.env is set locally and in Vercel. Sign-in gate works; I'm super admin
(cheng_hl@yahoo.com) with Users and Feedback tabs. Working tree is clean and
pushed at commit d1d655d.

Landed in the last sessions (newest first):
- iPad Safari fixes: the bead-plate header eye toggle was pushed past the
  header's right edge and clipped because Safari renders the stat numbers
  wider than Chrome. Header + stats group now wrap so the eye drops to a second
  line rather than overflowing; desktop stays single-row. Also the road scroll
  dot now sits centred ON the card's bottom border line (overflow:clip +
  overflow-clip-margin, dot pulled down half its height).
- Bet slip: stakes are TAP-ONLY (no virtual keyboard) via
  components/session/BetSlipControls.tsx, shared by Live Session and Practice.
  Chips feed the gold-highlighted field: main bet by default, a side bet only
  after its $0 is tapped while side bets are expanded. Action row is three
  buttons — Re-bet / x2 Bet / Clear — filled light blue (#cfe4f2) with dark
  text. x2 Bet doubles the highlighted field only; Clear empties the
  highlighted field only (clearActiveBet); the full reset clearPendingBet is
  post-settlement.
- Per-user libraries: FOUNDATION_SESSIONS (s1, s2) ship with every account and
  are deletable; DEMO_SESSIONS (s1-P1, s3, s4, s5) are super-admin-only
  fixtures. Use visibleBuiltInSessions(isSuperAdmin), never mockSessions, in
  any user-facing list.
- Super admin "View data": Users tab enters another account; cloud.ts tracks
  own vs acting user and targets every read/write at the acting one; gold
  banner names the account and exits. Users tab also has Delete (type-the-name
  confirm) via the delete_user RPC in migration 0006.
- Feedback tab: Subject/Topic dropdown + free text -> feedback table
  (RLS: insert own, read super-admin only) + confirmation screen. Email copy
  is best-effort via the feedback-notify Edge Function (see below).
- Signup repair (migration 0005): fixed the trigger that blocked regular-user
  registration; backfills missing profile rows.
- Various UI: full side-bet names, Medium-mode labels spelled out (Big Tiger
  unified everywhere), Live Session header/button sizing, mobile road-header
  centring, side-bet counters 3x4 on phones, bottom stats/predictor/side-bets
  centred on phone and tablet.

NOT yet verified on a real device — please treat as open, ask me to confirm:
- The iPad Safari eye-wrap fix and the scroll-dot centring were verified by DOM
  measurement only; screenshots would not composite in the tool pane. Needs a
  real iPad check (hard-refresh).
- "View data" (super admin acting as another user) has never been run against a
  real second account.
- Regular-user registration and Feedback submit have not been confirmed
  end-to-end against the live database since migrations 0005/0006 were applied.

Known outstanding (nothing blocking):
- Feedback email copy to the team address needs the Edge Function deployed:
  supabase secrets set FEEDBACK_NOTIFY_EMAIL / RESEND_API_KEY /
  FEEDBACK_FROM_EMAIL, then supabase functions deploy feedback-notify. Until
  then submissions still save and the admin list still shows them. The address
  must stay a server secret — never a VITE_ var.
- Supabase Auth Site URL should point at the vercel.app domain, and the default
  SMTP only delivers to team addresses, so a real sender is needed before
  outside users can confirm signups.
- Entering/leaving "View data" clears the localStorage cache, so any of my own
  sessions whose cloud push had failed are lost (same caveat as sign-out).
- Subscription work deliberately not started — packages undecided; there is a
  future intent that saving session/bet data becomes a paid subscription.
- Practice saves still don't record per-hand bets/calls (as-recorded lens shows
  "No recorded bets").
- Live Session state is in-memory — a tab reload loses an unsaved shoe.
- Bundle ~570 KB; code-split supabase-js when convenient.
- Foundation calibration boards are still simulated placeholders.

Workflow: I request a change -> you edit -> npm run build (must pass) ->
npm test for game logic -> commit -> push to main -> Vercel auto-deploys ->
I review on the live URL. Keep commit messages plain — no parentheses,
slashes or fancy characters, they break the PowerShell here-string.

Verifying UI locally: the app sits behind a sign-in gate, so to preview without
credentials, write a gitignored .env.local with empty VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY (puts the app in supported local mode, no auth gate),
then DELETE it before building and committing. Note: browser-pane screenshots
have been unreliable — verify layout by measuring the DOM with the
javascript_tool (getBoundingClientRect) rather than relying on screenshots.
Emulated tablet widths use the Chrome engine, so they do NOT reproduce iPad
Safari text-metric differences — real-device checks matter for Safari issues.

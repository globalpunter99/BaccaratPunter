// Supabase Edge Function — emails a copy of each feedback submission.
//
// WHY THIS IS A SERVER FUNCTION: the destination address must never appear in
// the app. Vite inlines every VITE_-prefixed var into the browser bundle, so
// the address lives here as an Edge Function secret and is read at runtime.
// Nothing in `src/` knows it, and it is not committed to this repo either.
//
// Deploy:
//   supabase secrets set FEEDBACK_NOTIFY_EMAIL=<destination address>
//   supabase secrets set FEEDBACK_FROM_EMAIL=<verified sender>   # optional
//   supabase secrets set RESEND_API_KEY=<key from resend.com>
//   supabase functions deploy feedback-notify
//
// Until it is deployed the app still works: the submission is written to the
// `feedback` table and the super-admin list shows it. The email copy is a
// best-effort extra, and the client ignores a failure here on purpose.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The caller must be a signed-in user — the function runs with the caller's
  // JWT, so an anonymous request cannot use this as an open mail relay.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  const to = Deno.env.get("FEEDBACK_NOTIFY_EMAIL");
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!to || !apiKey) {
    // Not configured yet — say so plainly rather than pretending to send.
    return json({ sent: false, reason: "notify-not-configured" });
  }

  const body = await req.json().catch(() => ({})) as {
    subject?: string; message?: string; username?: string;
  };
  const subject = String(body.subject ?? "").slice(0, 120) || "No subject";
  const message = String(body.message ?? "").slice(0, 8000);
  const username = String(body.username ?? "").slice(0, 120);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("FEEDBACK_FROM_EMAIL") ?? "onboarding@resend.dev",
      to: [to],
      reply_to: user.email,
      subject: `[BaccaratPunter feedback] ${subject}`,
      html: `
        <p><b>From:</b> ${escapeHtml(username || user.email || user.id)}
           &lt;${escapeHtml(user.email ?? "")}&gt;</p>
        <p><b>Subject:</b> ${escapeHtml(subject)}</p>
        <hr>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    }),
  });

  if (!res.ok) {
    return json({ sent: false, reason: await res.text() }, 502);
  }
  return json({ sent: true });
});

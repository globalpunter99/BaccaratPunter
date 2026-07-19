// Supabase client. Null when the env vars aren't configured — the app then
// runs in "local mode" (no auth gate, localStorage persistence only), which
// keeps dev and demo working without a backend.
//
// Env (in .env locally and in Vercel project settings):
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon public key>
// The anon key ships in the bundle by design; RLS protects the data. Never
// put the service_role key anywhere near client code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** True when the backend is configured (auth gate + cloud sync active). */
export const cloudEnabled = supabase !== null;

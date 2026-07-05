import { createClient } from "@supabase/supabase-js";

// Values come from Vite env vars. Copy .env.example to .env and fill in
// your Supabase project's URL and anon key. In Vercel, set these as
// Environment Variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Guarded so the app still runs locally before Supabase is connected.
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

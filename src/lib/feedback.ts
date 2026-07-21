// Feedback submissions. Writes go to the `feedback` table (RLS: insert your
// own row, read only as super admin); the email copy is sent by the
// `feedback-notify` Edge Function, which holds the destination address as a
// server secret — deliberately unknown to this bundle.

import { supabase } from "./supabase";

export interface FeedbackRow {
  id: string;
  user_id: string;
  username: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

/** The Subject/Topic dropdown. First entry is the unselected placeholder. */
export const FEEDBACK_SUBJECTS = [
  "Bug or something broken",
  "Feature request",
  "Roads and scoreboard display",
  "Live Session recording",
  "Session Library and Practice",
  "Profile and calibration",
  "Settings, casinos and odds",
  "Account and sign-in",
  "General comment",
  "Other",
] as const;

/**
 * Save a submission and (best effort) email a copy. The email is never allowed
 * to fail the submission: if the notify function isn't deployed or errors, the
 * row is still stored and the super-admin list still shows it.
 */
export async function submitFeedback(
  subject: string, message: string,
  who: { userId: string; username: string; email: string },
): Promise<string | null> {
  if (!supabase) return "Feedback needs the backend — sign in first.";

  const { error } = await supabase.from("feedback").insert({
    user_id: who.userId,
    username: who.username,
    email: who.email,
    subject,
    message,
  });
  if (error) return error.message;

  try {
    await supabase.functions.invoke("feedback-notify", {
      body: { subject, message, username: who.username },
    });
  } catch (e) {
    console.warn("[feedback] email copy not sent:", e);
  }
  return null;
}

/** Super admin only — RLS returns nothing for everyone else. */
export async function listFeedback(): Promise<{ rows: FeedbackRow[]; error: string | null }> {
  if (!supabase) return { rows: [], error: "Backend not configured" };
  const { data, error } = await supabase
    .from("feedback").select("*").order("created_at", { ascending: false });
  return { rows: (data as FeedbackRow[]) ?? [], error: error?.message ?? null };
}

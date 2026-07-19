// Player-profile store: the questionnaire answers persisted to localStorage,
// plus the engine config derived from them. Same localStorage pattern as
// `payoutSettings.ts`, to be replaced by Supabase in the backend pass.

import {
  answersToProfile,
  DEFAULT_YOU_CONFIG,
  type Answers,
  type ProfileConfig,
} from "../game/profile";
import { pushUserState } from "./cloud";

const KEY = "bp-player-profile";

/** The saved answers, or null if the player hasn't built a profile yet. */
export function loadAnswers(): Answers | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Answers;
  } catch { /* fall through */ }
  return null;
}

export function saveAnswers(answers: Answers): void {
  localStorage.setItem(KEY, JSON.stringify(answers));
  pushUserState("profile_answers", answers);
}

/** The engine config for "You": derived from saved answers, else the default. */
export function loadYouConfig(): ProfileConfig {
  const answers = loadAnswers();
  return answers ? answersToProfile(answers) : DEFAULT_YOU_CONFIG;
}

export function hasProfile(): boolean {
  return loadAnswers() !== null;
}

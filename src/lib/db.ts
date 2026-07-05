// Data access for boards and strategy configs. Outcomes are stored as a
// compact string (P/B/T, most recent last) in the `boards.outcomes` column.

import type { Outcome } from "../game/baccarat";
import type { Params, StrategyKey } from "../game/strategy";
import { supabase } from "./supabase";

export interface BoardRecord {
  id: string;
  name: string;
  outcomes: Outcome[];
  note: string | null;
  created_at: string;
}

export interface StrategyConfigRecord {
  id: string;
  name: string;
  strategy_key: StrategyKey;
  params: Params;
  created_at: string;
}

const TO_CODE: Record<Outcome, string> = { player: "P", banker: "B", tie: "T" };
const FROM_CODE: Record<string, Outcome> = {
  P: "player",
  B: "banker",
  T: "tie",
};

export function encodeOutcomes(outcomes: Outcome[]): string {
  return outcomes.map((o) => TO_CODE[o]).join("");
}

export function decodeOutcomes(s: string): Outcome[] {
  return [...s].map((c) => FROM_CODE[c]).filter(Boolean);
}

function client() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

export async function listBoards(): Promise<BoardRecord[]> {
  const { data, error } = await client()
    .from("boards")
    .select("id, name, outcomes, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Loading boards failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    outcomes: decodeOutcomes(row.outcomes as string),
  }));
}

export async function saveBoard(
  name: string,
  outcomes: Outcome[],
  note?: string
): Promise<void> {
  const { error } = await client().from("boards").insert({
    name,
    outcomes: encodeOutcomes(outcomes),
    note: note || null,
  });
  if (error) throw new Error(`Saving board failed: ${error.message}`);
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await client().from("boards").delete().eq("id", id);
  if (error) throw new Error(`Deleting board failed: ${error.message}`);
}

export async function listConfigs(): Promise<StrategyConfigRecord[]> {
  const { data, error } = await client()
    .from("strategy_configs")
    .select("id, name, strategy_key, params, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Loading configs failed: ${error.message}`);
  return (data ?? []) as StrategyConfigRecord[];
}

export async function saveConfig(
  name: string,
  strategyKey: StrategyKey,
  params: Params
): Promise<void> {
  const { error } = await client().from("strategy_configs").insert({
    name,
    strategy_key: strategyKey,
    params,
  });
  if (error) throw new Error(`Saving config failed: ${error.message}`);
}

export async function deleteConfig(id: string): Promise<void> {
  const { error } = await client()
    .from("strategy_configs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Deleting config failed: ${error.message}`);
}

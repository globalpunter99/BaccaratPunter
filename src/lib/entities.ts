// Prediction entities shared between the analysis views and the roads.

export type EntityId = "you" | "sniper" | "grinder";

export const ENTITY_LABELS: Record<EntityId, string> = {
  you: "You",
  sniper: "Sniper",
  grinder: "Grinder",
};

// Line colours: bright = correct call, dull = incorrect call.
export const ENTITY_COLOURS: Record<EntityId, { correct: string; wrong: string }> = {
  you:     { correct: "#ffd94a", wrong: "#8a7420" },
  sniper:  { correct: "#3ae8e8", wrong: "#1d7676" },
  grinder: { correct: "#f06bf0", wrong: "#7c3180" },
};

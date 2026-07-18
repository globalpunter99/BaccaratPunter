import { describe, expect, it } from "vitest";
import { assistantNote } from "./assistant";
import type { Signal } from "./signals";

const openWindow: Signal = {
  predictedSide: "banker", confidence: 72, alignment: 3,
  roadVotes: ["aligned", "aligned", "aligned"], window: true,
};
const noWindow: Signal = { ...openWindow, alignment: 1, roadVotes: ["aligned", "against", "against"], window: false };

describe("assistantNote priorities", () => {
  it("tilt outranks an open window", () => {
    const note = assistantNote({
      handCount: 30, betResults: ["win", "loss", "loss", "loss"], signal: openWindow,
    });
    expect(note.tone).toBe("warn");
    expect(note.title).toContain("Tilt");
  });

  it("a long winning run prompts a leave-point reminder", () => {
    const note = assistantNote({
      handCount: 30, betResults: ["loss", "win", "win", "win", "win"], signal: openWindow,
    });
    expect(note.title).toContain("leave point");
  });

  it("late shoe warns even with a window open", () => {
    const note = assistantNote({ handCount: 58, betResults: [], signal: openWindow });
    expect(note.title).toContain("Late in the shoe");
  });

  it("no signal yet says watch first", () => {
    const note = assistantNote({ handCount: 2, betResults: [], signal: null });
    expect(note.tone).toBe("info");
    expect(note.title).toContain("Watch");
  });

  it("window open backs the plan; no window backs the sit-out", () => {
    const open = assistantNote({ handCount: 30, betResults: ["win"], signal: openWindow });
    expect(open.tone).toBe("good");
    expect(open.detail).toContain("3/3");
    const closed = assistantNote({ handCount: 30, betResults: ["win"], signal: noWindow });
    expect(closed.tone).toBe("info");
    expect(closed.title).toContain("No window");
  });

  it("an interrupted loss run does not trigger tilt", () => {
    const note = assistantNote({
      handCount: 30, betResults: ["loss", "loss", "loss", "win"], signal: openWindow,
    });
    expect(note.title).not.toContain("Tilt");
  });
});

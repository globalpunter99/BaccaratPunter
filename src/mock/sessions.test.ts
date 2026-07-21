// Which built-in shoes each kind of account sees. This is a product rule, not
// a display detail: the development fixtures are fabricated history, and a
// paying user must never find them sitting in their library looking real.

import { describe, expect, it } from "vitest";
import { DEMO_SESSIONS, FOUNDATION_SESSIONS, mockSessions, visibleBuiltInSessions } from "./data";

const ids = (list: { id: string }[]) => list.map(s => s.id).sort();

describe("built-in session visibility", () => {
  it("gives every account the two foundation shoes", () => {
    expect(ids(FOUNDATION_SESSIONS)).toEqual(["s1", "s2"]);
  });

  it("shows a regular user the foundation shoes and nothing else", () => {
    expect(ids(visibleBuiltInSessions(false))).toEqual(["s1", "s2"]);
  });

  it("shows the super admin the fixtures as well", () => {
    expect(ids(visibleBuiltInSessions(true))).toEqual(
      ids([...FOUNDATION_SESSIONS, ...DEMO_SESSIONS]),
    );
  });

  it("keeps the fixtures out of the foundation set", () => {
    const foundationIds = new Set(FOUNDATION_SESSIONS.map(s => s.id));
    expect(DEMO_SESSIONS.some(s => foundationIds.has(s.id))).toBe(false);
  });

  it("keeps every built-in id unique, so new session ids can't collide", () => {
    expect(new Set(mockSessions.map(s => s.id)).size).toBe(mockSessions.length);
  });

  it("still exposes all six built-ins for id-collision checks", () => {
    expect(mockSessions).toHaveLength(FOUNDATION_SESSIONS.length + DEMO_SESSIONS.length);
  });

  it("makes the foundation shoes full live shoes, not slices or mockups", () => {
    for (const s of FOUNDATION_SESSIONS) {
      expect(s.type).toBe("live");
      expect(s.hands.length).toBeGreaterThan(40);
      expect(s.practiceOf).toBeUndefined();
    }
  });
});
